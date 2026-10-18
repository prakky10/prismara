/**
 * Options: volumes, mute, text speed, battle animations, reduced effects,
 * damage numbers, colourblind-friendly type icons and touch controls.
 */

import Phaser from 'phaser';
import { SCENES, type SceneKey } from './keys';
import { COLORS, DEPTHS, FONTS, VIEW_HEIGHT, VIEW_WIDTH } from '../ui/Theme';
import { InputManager } from '../core/InputManager';
import { Audio } from '../audio/AudioManager';
import { Panel } from '../ui/Panel';
import { Game } from '../world/GameContext';
import type { GameSettings } from '../core/SaveManager';

type Row =
  | { kind: 'slider'; key: 'musicVolume' | 'sfxVolume'; label: string }
  | { kind: 'toggle'; key: keyof GameSettings; label: string }
  | { kind: 'choice'; key: 'textSpeed'; label: string; options: string[] }
  | { kind: 'action'; key: 'back'; label: string };

const ROWS: Row[] = [
  { kind: 'slider', key: 'musicVolume', label: 'Music volume' },
  { kind: 'slider', key: 'sfxVolume', label: 'Sound effects volume' },
  { kind: 'toggle', key: 'muted', label: 'Mute everything' },
  { kind: 'choice', key: 'textSpeed', label: 'Text speed', options: ['slow', 'normal', 'fast', 'instant'] },
  { kind: 'toggle', key: 'battleAnimations', label: 'Battle animations' },
  { kind: 'toggle', key: 'reducedEffects', label: 'Reduced effects' },
  { kind: 'toggle', key: 'damageNumbers', label: 'Damage numbers' },
  { kind: 'toggle', key: 'colorblindTypeIcons', label: 'Colourblind-friendly type icons' },
  { kind: 'toggle', key: 'showTouchControls', label: 'On-screen controls' },
  { kind: 'action', key: 'back', label: 'Back' },
];

export class SettingsScene extends Phaser.Scene {
  private controls!: InputManager;
  private cursor = 0;
  private rows: Phaser.GameObjects.Text[] = [];
  private returnTo: SceneKey = SCENES.title;

  constructor() {
    super(SCENES.settings);
  }

  init(data: { returnTo?: SceneKey }): void {
    this.returnTo = data?.returnTo ?? SCENES.title;
  }

  create(): void {
    this.controls = new InputManager(this);
    this.cursor = 0;
    this.rows = [];
    this.cameras.main.setBackgroundColor('#05070f');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x121a33, 0x121a33, 0x05070f, 0x05070f, 1);
    bg.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    const panel = new Panel(this, VIEW_WIDTH / 2, VIEW_HEIGHT / 2, {
      width: VIEW_WIDTH - 120,
      height: VIEW_HEIGHT - 90,
      glow: COLORS.panelGlow,
    });
    panel.setDepth(DEPTHS.ui);

    this.add
      .text(VIEW_WIDTH / 2, 58, 'OPTIONS', {
        fontFamily: FONTS.body,
        fontSize: '26px',
        color: '#f2f6ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.ui + 1);

    this.buildRows();

    this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT - 34, '\u2191 \u2193 to move \u00b7 \u2190 \u2192 to change \u00b7 Z to confirm \u00b7 X to go back', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: '#6d7d99',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.ui + 1);

    this.refresh();
  }

  private buildRows(): void {
    const startY = 110;
    ROWS.forEach((row, index) => {
      const label = this.add
        .text(110, startY + index * 34, '', {
          fontFamily: FONTS.body,
          fontSize: '16px',
          color: '#f2f6ff',
        })
        .setOrigin(0, 0.5)
        .setDepth(DEPTHS.ui + 1);
      this.rows.push(label);
      void row;
    });
  }

  private valueLabel(row: Row): string {
    const settings = Game.settings;
    switch (row.kind) {
      case 'slider': {
        const value = settings[row.key];
        const bars = Math.round(value * 10);
        return `${'\u2588'.repeat(bars)}${'\u2591'.repeat(10 - bars)}  ${Math.round(value * 100)}%`;
      }
      case 'choice':
        return `\u25c0 ${settings[row.key]} \u25b6`;
      case 'toggle':
        return settings[row.key] ? 'ON' : 'OFF';
      case 'action':
        return '\u25b6';
      default:
        return '';
    }
  }

  private refresh(): void {
    ROWS.forEach((row, index) => {
      const selected = index === this.cursor;
      const text = this.rows[index];
      const marker = selected ? '\u25b6 ' : '  ';
      const value = this.valueLabel(row);
      text.setText(`${marker}${row.label.padEnd(30, ' ')}${value}`);
      text.setColor(selected ? '#7fffe5' : '#f2f6ff');
    });
  }

  private change(delta: number): void {
    const row = ROWS[this.cursor];
    if (!row) return;
    const settings = { ...Game.settings };

    if (row.kind === 'slider') {
      const next = Phaser.Math.Clamp(settings[row.key] + delta * 0.1, 0, 1);
      settings[row.key] = Math.round(next * 10) / 10;
      if (row.key === 'musicVolume') Audio.setMusicVolume(settings.musicVolume);
      else Audio.setSfxVolume(settings.sfxVolume);
      Audio.playSfx('cursor');
    } else if (row.kind === 'choice') {
      const index = row.options.indexOf(settings[row.key]);
      const next = (index + delta + row.options.length) % row.options.length;
      settings[row.key] = row.options[next] as GameSettings['textSpeed'];
      Audio.playSfx('cursor');
    }

    Game.applySettings(settings);
    this.refresh();
  }

  private confirm(): void {
    const row = ROWS[this.cursor];
    if (!row) return;
    if (row.kind === 'toggle') {
      const settings = { ...Game.settings };
      const next = !settings[row.key];
      (settings[row.key] as boolean) = next;
      Game.applySettings(settings);
      Audio.playSfx(next ? 'select' : 'back');
      this.refresh();
      return;
    }
    if (row.kind === 'action' && row.key === 'back') this.goBack();
  }

  private goBack(): void {
    Audio.playSfx('back');
    const from = this.returnTo;
    if (from === SCENES.overworld) {
      this.scene.stop(SCENES.settings);
      this.scene.resume(SCENES.overworld);
      this.scene.get(SCENES.overworld)?.events.emit('settings-applied');
      return;
    }
    this.scene.start(from);
  }

  override update(time: number): void {
    this.controls.update();

    const vertical = this.controls.verticalNav(time);
    if (vertical !== 0) {
      this.cursor = (this.cursor + vertical + ROWS.length) % ROWS.length;
      Audio.playSfx('cursor');
      this.refresh();
    }

    const horizontal = this.controls.horizontalNav(time);
    if (horizontal !== 0) this.change(horizontal);

    if (this.controls.justPressed('confirm')) this.confirm();
    if (this.controls.justPressed('cancel')) this.goBack();
  }
}
