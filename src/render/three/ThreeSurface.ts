import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  type Camera,
  type Scene,
} from 'three';
import type Phaser from 'phaser';

const VIEW_W = 960;
const VIEW_H = 540;
const MAX_DPR = 1.5;
const MAX_STEP = 0.05;

type SurfaceEntry = {
  owner: Phaser.Scene;
  world: Scene;
  camera: Camera;
  animate?: (seconds: number) => void;
  cleanup?: () => void;
  /** Absolute seconds; advances only while this entry is the shown surface. */
  elapsed: number;
  ended: boolean;
};

const entries: SurfaceEntry[] = [];
const sizeScratch = new Vector2();

let renderer: WebGLRenderer | undefined;
let appliedDpr = 0;
let raf = 0;
let lastNow = 0;

function shown(scene: Phaser.Scene): boolean {
  const sys = scene.sys;
  if (sys.settings.visible === false) return false;
  return sys.isActive() || sys.isPaused();
}

function pick(): SurfaceEntry | undefined {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (!entry.ended && shown(entry.owner)) return entry;
  }
  return undefined;
}

function assertCanMount(scene: Phaser.Scene): void {
  const sys = scene.sys;
  // START=2 during init. CREATING=4 for all of create() — isActive() is false until RUNNING=5.
  const status = sys.settings.status;
  if (sys.isActive() || sys.isPaused() || status === 4 || status === 2) return;
  throw new Error(`ThreeSurface: scene "${sys.settings.key}" is not active.`);
}

export function getThreeRenderer(): WebGLRenderer {
  if (renderer) return renderer;
  if (typeof document === 'undefined' || !document.body) {
    throw new Error('WebGL context creation failed for the shared 3D renderer: no document.');
  }
  let created: WebGLRenderer;
  try {
    created = new WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`WebGL context creation failed for the shared 3D renderer: ${detail}`);
  }
  const gl = created.getContext();
  if (!gl || gl.isContextLost()) {
    created.dispose();
    throw new Error('WebGL context creation failed for the shared 3D renderer.');
  }
  created.outputColorSpace = SRGBColorSpace;
  created.toneMapping = ACESFilmicToneMapping;
  created.toneMappingExposure = 1.15;
  created.shadowMap.enabled = true;
  created.shadowMap.type = PCFShadowMap;
  created.autoClear = true;
  created.setClearColor(0x000000, 1);
  const dpr = Math.min(globalThis.devicePixelRatio || 1, MAX_DPR);
  created.setPixelRatio(dpr);
  created.setSize(VIEW_W, VIEW_H, false);
  appliedDpr = dpr;
  const canvas = created.domElement;
  canvas.setAttribute('data-renderer', 'three');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.position = 'fixed';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '0';
  canvas.style.display = 'none';
  document.body.appendChild(canvas);
  renderer = created;
  return created;
}

function syncCanvas(game: Phaser.Game): void {
  const gl = getThreeRenderer();
  const rect = game.canvas.getBoundingClientRect();
  const el = gl.domElement;
  const left = `${rect.left}px`;
  const top = `${rect.top}px`;
  const width = `${rect.width}px`;
  const height = `${rect.height}px`;
  if (el.style.left !== left) el.style.left = left;
  if (el.style.top !== top) el.style.top = top;
  if (el.style.width !== width) el.style.width = width;
  if (el.style.height !== height) el.style.height = height;
  const dpr = Math.min(globalThis.devicePixelRatio || 1, MAX_DPR);
  gl.getSize(sizeScratch);
  if (dpr !== appliedDpr || sizeScratch.x !== VIEW_W || sizeScratch.y !== VIEW_H) {
    gl.setPixelRatio(dpr);
    gl.setSize(VIEW_W, VIEW_H, false);
    appliedDpr = dpr;
  }
}

function halt(): void {
  if (raf !== 0) cancelAnimationFrame(raf);
  raf = 0;
  lastNow = 0;
  if (renderer) renderer.domElement.style.display = 'none';
}

function startLoop(): void {
  if (entries.length === 0) return;
  getThreeRenderer();
  if (raf !== 0) return;
  lastNow = 0;
  raf = requestAnimationFrame(tick);
}

function tick(now: number): void {
  if (entries.length === 0 || !renderer) {
    halt();
    return;
  }
  const entry = pick();
  if (!entry) {
    renderer.domElement.style.display = 'none';
    raf = requestAnimationFrame(tick);
    return;
  }
  const step = lastNow === 0 ? 1 / 60 : Math.min(MAX_STEP, (now - lastNow) / 1000);
  lastNow = now;
  renderer.domElement.style.display = 'block';
  syncCanvas(entry.owner.game);
  // Absolute elapsed. Hidden/paused entries are not stepped, so their elapsed is kept.
  entry.elapsed += step;
  entry.animate?.(entry.elapsed);
  const draw = entries.length > 0 ? pick() : undefined;
  if (renderer && draw) {
    syncCanvas(draw.owner.game);
    renderer.render(draw.world, draw.camera);
  }
  if (entries.length === 0 || !renderer) {
    halt();
    return;
  }
  raf = requestAnimationFrame(tick);
}

export class ThreeSurface {
  private entry: SurfaceEntry | undefined;
  private readonly onEnd = (): void => {
    this.dispose();
  };

  constructor(
    owner: Phaser.Scene,
    world: Scene,
    camera: Camera,
    animate?: (seconds: number) => void,
    cleanup?: () => void,
  ) {
    assertCanMount(owner);
    const entry: SurfaceEntry = { owner, world, camera, animate, cleanup, elapsed: 0, ended: false };
    this.entry = entry;
    owner.events.on('shutdown', this.onEnd);
    owner.events.on('destroy', this.onEnd);
    entries.push(entry);
    try {
      startLoop();
    } catch (error) {
      this.release(false);
      throw error;
    }
  }

  dispose(): void {
    this.release(true);
  }

  private release(runCleanup: boolean): void {
    const entry = this.entry;
    if (!entry || entry.ended) return;
    entry.ended = true;
    this.entry = undefined;
    entry.owner.events.off('shutdown', this.onEnd);
    entry.owner.events.off('destroy', this.onEnd);
    const index = entries.indexOf(entry);
    if (index >= 0) entries.splice(index, 1);
    try {
      if (runCleanup) entry.cleanup?.();
    } finally {
      if (entries.length > 0) startLoop();
      else halt();
    }
  }
}
