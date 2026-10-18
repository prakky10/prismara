/**
 * Entry point: build the Phaser game and mount it into #game-root.
 *
 * The canvas runs at a fixed 960x540 logical resolution and is letterboxed to
 * any screen with FIT + CENTER_BOTH, so every layout in the game can assume
 * those coordinates.
 */

import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from './ui/Theme';
import { SCENES } from './scenes/keys';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { OverworldScene } from './scenes/OverworldScene';
import { BattleScene } from './scenes/BattleScene';
import { PartyScene } from './scenes/PartyScene';
import { BagScene } from './scenes/BagScene';
import { DexScene } from './scenes/DexScene';
import { StorageScene } from './scenes/StorageScene';
import { ShopScene } from './scenes/ShopScene';
import { EvolutionScene } from './scenes/EvolutionScene';
import { SettingsScene } from './scenes/SettingsScene';
import { CreditsScene } from './scenes/CreditsScene';
import { IntroScene } from './scenes/IntroScene';
import { PauseScene } from './scenes/PauseScene';
import { JournalScene } from './scenes/JournalScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  backgroundColor: '#05070f',
  transparent: true,
  // Smooth filtering: the creatures are vector art rasterised at 2x, so we want
  // interpolation on them. The overworld explicitly sets NEAREST on its tileset.
  pixelArt: false,
  roundPixels: false,
  antialias: true,
  scale: {
    // FIT sizes the canvas; the CSS flexbox on #game-root centres it. Using
    // Phaser's own centring *as well* double-offsets the canvas.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
  },
  render: {
    powerPreference: 'high-performance',
    antialias: true,
    desynchronized: true,
  },
  input: {
    gamepad: true,
    activePointers: 3,
  },
  audio: {
    // The game synthesises its own audio through the Web Audio API, so Phaser's
    // sound manager is only kept alive for lifecycle events.
    disableWebAudio: false,
  },
  fps: { target: 60, min: 30 },
  scene: [
    BootScene,
    PreloadScene,
    IntroScene,
    TitleScene,
    OverworldScene,
    BattleScene,
    PauseScene,
    JournalScene,
    PartyScene,
    BagScene,
    DexScene,
    StorageScene,
    ShopScene,
    EvolutionScene,
    SettingsScene,
    CreditsScene,
  ],
};

// Phaser bakes text into textures at creation time, so wait (briefly) for the
// web fonts before the first scene draws anything.
async function fontsReady(): Promise<void> {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('700 16px "Nunito"'),
        document.fonts.load('700 16px "Baloo 2"'),
      ]).then(() => document.fonts.ready),
      new Promise((resolve) => window.setTimeout(resolve, 2500)),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

function boot(): void {
  const game = new Phaser.Game(config);

  // Dev-only introspection: a console handle for the running game and a
  // `data-scene` attribute on <body> that always names the active scene. Both
  // make debugging (and the headless smoke test) much easier.
  if (import.meta.env.DEV) {
    (window as unknown as { __PRISMARA__?: Phaser.Game }).__PRISMARA__ = game;
    game.events.once(Phaser.Core.Events.READY, () => {
      for (const scene of game.scene.scenes) {
        scene.events.on(Phaser.Scenes.Events.START, () => {
          document.body.dataset.scene = scene.scene.key;
        });
        scene.events.on(Phaser.Scenes.Events.RESUME, () => {
          document.body.dataset.scene = scene.scene.key;
        });
      }
    });
  }

  // Hide the HTML splash once the game has booted.
  game.events.once(Phaser.Core.Events.READY, () => {
    const splash = document.getElementById('boot-splash');
    if (splash) {
      splash.classList.add('hidden');
      window.setTimeout(() => splash.remove(), 600);
    }
  });

  // If anything throws during boot, surface it in the splash instead of a blank
  // screen so the failure is diagnosable.
  const splash = document.getElementById('boot-splash');
  const status = document.getElementById('boot-status');
  window.addEventListener('error', (event) => {
    if (!splash || !status) return;
    splash.classList.remove('hidden');
    splash.classList.add('failed');
    status.textContent = `Prismara failed to start: ${event.message}`;
  });
}

void fontsReady().then(boot);

document.title = 'PRISMARA — The Last Light';

export { SCENES };
