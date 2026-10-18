import type Phaser from 'phaser';
import type { MapDef } from '../world/maps';

function mix(n: number): number {
  let x = n >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

export function addWorldPolish(
  scene: Phaser.Scene,
  map: MapDef,
  tileSize: number,
  reducedEffects: boolean,
): void {
  const shadow = scene.add.graphics().setDepth(2);
  const ground = scene.add.graphics().setDepth(3);
  const water = scene.add.graphics().setDepth(4);
  const canopy = scene.add.graphics().setDepth(6);
  const lamp = scene.add.graphics().setDepth(8);
  const biome = map.biome.toLowerCase();
  const cave = biome.includes('cave');
  const snow = biome.includes('snow') || biome.includes('ice');
  const dry = biome.includes('desert') || biome.includes('sand');
  const leaf = cave ? 0x24302a : snow ? 0xc5d5d8 : dry ? 0x6d7a3a : 0x1c6e34;
  const hi = snow ? 0xf2f7f4 : dry ? 0xc2b15a : 0x8ed67a;
  const t = tileSize;
  let glints = 0;

  for (let y = 0; y < map.height; y++) {
    const row = map.tiles[y] ?? '';
    for (let x = 0; x < map.width; x++) {
      const ch = row.charAt(x);
      const px = x * t;
      const py = y * t;
      const n = mix(x * 374761393 + y * 668265263 + map.width);
      if (ch === '#' || ch === 'P') {
        shadow.fillStyle(0x061008, 0.4);
        shadow.fillRect(px + t * 0.2, py + t * 0.74, t * 0.68, Math.max(2, t * 0.1));
        canopy.fillStyle(0x3a2a1a, 1);
        canopy.fillRect(px + t * 0.44, py + t * 0.5, Math.max(2, t * 0.12), t * 0.26);
        canopy.fillStyle(leaf, 1);
        canopy.fillTriangle(px + t * 0.5, py + t * 0.08, px + t * 0.18, py + t * 0.5, px + t * 0.82, py + t * 0.5);
        canopy.fillTriangle(px + t * 0.5, py + t * 0.24, px + t * 0.24, py + t * 0.68, px + t * 0.76, py + t * 0.68);
        canopy.fillStyle(hi, 0.8);
        canopy.fillTriangle(px + t * 0.5, py + t * 0.14, px + t * 0.38, py + t * 0.34, px + t * 0.54, py + t * 0.34);
      } else if (ch === '.') {
        ground.fillStyle(cave ? 0x1c2820 : snow ? 0xd5e4df : dry ? 0xb0a45a : 0x2e8a42, 0.95);
        ground.fillRect(px + 2 + (n % 5), py + t - 5, 2, 4);
        ground.fillRect(px + t - 6 - (n % 3), py + t - 4, 2, 3);
        if (!cave && !snow && n % 6 === 0) {
          ground.fillStyle(n % 2 === 0 ? 0xe0b44a : 0xd45b78, 1);
          ground.fillRect(px + 4 + (n % 7), py + t - 7, 2, 2);
        }
      } else if (ch === '=') {
        ground.fillStyle(0x6e655c, 0.95);
        ground.fillRect(px + 2, py + t - 3, 4, 2);
        ground.fillRect(px + t - 6, py + 2, 3, 2);
      } else if (ch === '~') {
        const gx = px + 3 + (n % Math.max(1, t - 8));
        const gy = py + 3 + ((n >>> 8) % Math.max(1, t - 6));
        water.fillStyle(0xd7f6ff, 0.4);
        water.fillRect(gx, gy, 5, 1);
        if (!reducedEffects && glints < 24 && n % 4 === 0) {
          const spark = scene.add.rectangle(gx, gy, 4, 1, 0xf4fbff, 0.3).setDepth(5);
          scene.tweens.add({
            targets: spark,
            alpha: 0.85,
            duration: 680 + (n % 480),
            delay: n % 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
          glints += 1;
        }
      } else if (ch === 'D') {
        lamp.fillStyle(0xffb040, 0.2);
        lamp.fillCircle(px + t * 0.5, py + t * 0.2, Math.max(4, t * 0.26));
        lamp.fillStyle(0xffd080, 1);
        lamp.fillRect(px + t * 0.4, py + t * 0.1, Math.max(3, t * 0.18), Math.max(2, t * 0.08));
      }
    }
  }

  if (map.indoor === true || cave || biome.includes('indoor')) return;
  const wash = scene.add.graphics().setDepth(79).setScrollFactor(0);
  wash.fillStyle(0xffd8a0, 0.055);
  wash.fillRect(0, 0, scene.scale.width, scene.scale.height);
  wash.fillStyle(0xffe6b8, 0.045);
  wash.fillTriangle(scene.scale.width, 0, scene.scale.width * 0.5, 0, scene.scale.width, scene.scale.height * 0.5);
}
