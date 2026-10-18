import {
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Object3D,
  type ToneMapping,
  type WebGLRenderer,
} from 'three';
import { createCreatureModel } from './CreatureModels';
import { getThreeRenderer } from './ThreeSurface';

const SIZE = 256;
const MAX_PORTRAITS = 80;
const FOOT_NDC_Y = -0.6;

type Snap = {
  target: WebGLRenderTarget | null;
  clear: Color;
  alpha: number;
  pixelRatio: number;
  width: number;
  height: number;
  shadow: boolean;
  autoClear: boolean;
  toneMapping: ToneMapping;
  exposure: number;
  colorSpace: string;
};

const cache = new Map<string, HTMLCanvasElement>();

function capture(renderer: WebGLRenderer): Snap {
  const clear = new Color();
  const size = renderer.getSize(new Vector2());
  renderer.getClearColor(clear);
  return {
    target: renderer.getRenderTarget(),
    clear,
    alpha: renderer.getClearAlpha(),
    pixelRatio: renderer.getPixelRatio(),
    width: size.x,
    height: size.y,
    shadow: renderer.shadowMap.enabled,
    autoClear: renderer.autoClear,
    toneMapping: renderer.toneMapping,
    exposure: renderer.toneMappingExposure,
    colorSpace: renderer.outputColorSpace,
  };
}

function restore(renderer: WebGLRenderer, snap: Snap): void {
  renderer.setRenderTarget(snap.target);
  renderer.setClearColor(snap.clear, snap.alpha);
  renderer.shadowMap.enabled = snap.shadow;
  if (snap.shadow) renderer.shadowMap.needsUpdate = true;
  renderer.autoClear = snap.autoClear;
  renderer.toneMapping = snap.toneMapping;
  renderer.toneMappingExposure = snap.exposure;
  renderer.outputColorSpace = snap.colorSpace;
  const size = renderer.getSize(new Vector2());
  if (renderer.getPixelRatio() !== snap.pixelRatio || size.x !== snap.width || size.y !== snap.height) {
    renderer.setPixelRatio(snap.pixelRatio);
    renderer.setSize(snap.width, snap.height, false);
  }
}

function frame(root: Object3D, camera: OrthographicCamera): Vector3 {
  root.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(root);
  const look = new Vector3(0, 0.9, 0);
  if (box.isEmpty()) {
    camera.position.set(1.6, 1.25, 2.1);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    camera.updateMatrixWorld(true);
    camera.left = -1.4;
    camera.right = 1.4;
    camera.top = 1.4;
    camera.bottom = -1.4;
    camera.near = 0.05;
    camera.far = 40;
    camera.updateProjectionMatrix();
    return look;
  }
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  look.set(center.x, box.min.y + size.y * 0.42, center.z);
  // Model faces +Z, Y up. Camera sits on the +X/+Y/+Z side (3/4).
  const dir = new Vector3(0.62, 0.36, 0.7).normalize();
  const radius = Math.max(size.x, size.y, size.z) * 0.5;
  const distance = Math.max(4, radius * 4);
  camera.up.set(0, 1, 0);
  camera.position.copy(look).addScaledVector(dir, distance);
  camera.lookAt(look);
  camera.updateMatrixWorld(true);
  camera.near = 0.05;
  camera.far = distance + radius * 4 + 2;
  const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  const corner = new Vector3();
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        corner.set(x, y, z);
        camera.worldToLocal(corner);
        min.min(corner);
        max.max(corner);
      }
    }
  }
  const foot = camera.worldToLocal(new Vector3(center.x, box.min.y, center.z));
  const t = FOOT_NDC_Y;
  const spanX = Math.max(max.x - min.x, 1e-4);
  let half = Math.max(
    spanX * 0.5,
    (foot.y - min.y) / Math.max(1 + t, 1e-4),
    (max.y - foot.y) / Math.max(1 - t, 1e-4),
    0.2,
  );
  half *= 1.12;
  const cy = foot.y - t * half;
  const cx = (min.x + max.x) * 0.5;
  camera.left = cx - half;
  camera.right = cx + half;
  camera.top = cy + half;
  camera.bottom = cy - half;
  camera.updateProjectionMatrix();
  return look;
}

function addLights(scene: Scene, aim: Vector3): void {
  const hemi = new HemisphereLight(0xfff4e4, 0x6d84a6, 1);
  const key = new DirectionalLight(0xffc98a, 2.6);
  key.position.set(aim.x + 2.4, aim.y + 3.8, aim.z + 2.6);
  key.target.position.copy(aim);
  const rim = new DirectionalLight(0x9ec9ff, 1.55);
  rim.position.set(aim.x - 3.2, aim.y + 2.1, aim.z - 2.7);
  rim.target.position.copy(aim);
  scene.add(hemi, key, rim, key.target, rim.target);
}

function targetToCanvas(renderer: WebGLRenderer, target: WebGLRenderTarget): HTMLCanvasElement {
  const gl = renderer.getContext();
  if (!gl || gl.isContextLost()) {
    throw new Error('WebGL context creation failed for the shared 3D renderer.');
  }
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is unavailable for creature portraits.');
  const image = ctx.createImageData(SIZE, SIZE);
  const row = SIZE * 4;
  const data = image.data;
  for (let y = 0; y < SIZE; y += 1) {
    const src = (SIZE - 1 - y) * row;
    const dst = y * row;
    for (let x = 0; x < row; x += 4) {
      const s = src + x;
      const d = dst + x;
      const a = pixels[s + 3];
      let r = pixels[s];
      let g = pixels[s + 1];
      let b = pixels[s + 2];
      if (a === 0) {
        r = 0;
        g = 0;
        b = 0;
      } else if (a < 255) {
        const scale = 255 / a;
        r = Math.min(255, r * scale);
        g = Math.min(255, g * scale);
        b = Math.min(255, b * scale);
      }
      data[d] = r;
      data[d + 1] = g;
      data[d + 2] = b;
      data[d + 3] = a;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function store(key: string, canvas: HTMLCanvasElement): void {
  cache.set(key, canvas);
  while (cache.size > MAX_PORTRAITS) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) return;
    cache.delete(oldest);
  }
}

export function renderCreaturePortrait(speciesId: string, shiny = false): HTMLCanvasElement {
  const key = `${shiny ? '1' : '0'}:${speciesId}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const renderer = getThreeRenderer();
  const model = createCreatureModel(speciesId, shiny);
  let target: WebGLRenderTarget | undefined;
  let snap: Snap | undefined;
  try {
    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.05, 40);
    scene.add(model.root);
    model.update(0.4, 'idle');
    const aim = frame(model.root, camera);
    addLights(scene, aim);
    // alpha:false window canvas cannot keep portrait alpha. Same context, RGBA target.
    target = new WebGLRenderTarget(SIZE, SIZE, {
      depthBuffer: true,
      stencilBuffer: false,
      generateMipmaps: false,
      samples: 0,
      colorSpace: SRGBColorSpace,
    });
    snap = capture(renderer);
    scene.background = null;
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = true;
    renderer.shadowMap.enabled = false;
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    const canvas = targetToCanvas(renderer, target);
    store(key, canvas);
    return canvas;
  } finally {
    if (snap) restore(renderer, snap);
    target?.dispose();
    model.dispose();
  }
}
