/**
 * Turns generated SVG markup into Phaser textures.
 *
 * Each part is rasterised onto a canvas at `devicePixelRatio * supersample`
 * so the vector art stays razor sharp on high-DPI screens, then handed to the
 * texture manager under a stable key. Results are cached, so asking for the
 * same creature twice costs nothing.
 */

import Phaser from 'phaser';

const cache = new Map<string, Promise<void>>();

export interface RasteriseOptions {
  /** Logical size in pixels (the SVG viewBox is assumed square). */
  size: number;
  /** Extra sampling multiplier on top of devicePixelRatio. */
  supersample?: number;
}

/**
 * How many texture pixels to spend per art pixel.
 *
 * Rasterising at a minimum of 2x keeps the vector edges crisp when a rig is
 * scaled up in battle, and never going above 3x keeps boot quick — beyond that
 * the extra pixels cost more time than they show on screen.
 */
function deviceScale(supersample: number): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.max(2, Math.min(3, dpr * supersample));
}

/** True when the texture already exists in the scene's texture manager. */
export function hasTexture(scene: Phaser.Scene, key: string): boolean {
  return scene.textures.exists(key);
}

/**
 * Rasterise `svg` to the texture `key`. Safe to call repeatedly; the in-flight
 * promise is shared. Resolves once the texture is available.
 */
export function svgToTexture(
  scene: Phaser.Scene,
  key: string,
  svg: string,
  options: RasteriseOptions,
): Promise<void> {
  if (scene.textures.exists(key)) return Promise.resolve();

  const existing = cache.get(key);
  if (existing) return existing;

  const { size, supersample = 1 } = options;
  const scale = deviceScale(supersample);
  const pixels = Math.round(size * scale);

  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = 'sync';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = pixels;
        canvas.height = pixels;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, pixels, pixels);
        }
        if (scene.textures.exists(key)) scene.textures.remove(key);
        scene.textures.addCanvas(key, canvas);
        (scene.textures.get(key) as Phaser.Textures.Texture).setFilter(
          Phaser.Textures.FilterMode.LINEAR,
        );
      } catch {
        // A failed raster leaves the key absent; callers fall back to a shape.
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

  cache.set(key, promise);
  promise.then(() => {
    // Keep the promise cached only while the texture manager still holds it.
    if (!scene.textures.exists(key)) cache.delete(key);
  });
  return promise;
}

/** Rasterise many textures in parallel. */
export async function svgBatch(
  scene: Phaser.Scene,
  jobs: Array<{ key: string; svg: string; size: number }>,
  supersample = 2,
): Promise<void> {
  await Promise.all(
    jobs.map((job) => svgToTexture(scene, job.key, job.svg, { size: job.size, supersample })),
  );
}

/** Forget cached promises (used when a scene restarts in a fresh context). */
export function clearTextureCache(): void {
  cache.clear();
}
