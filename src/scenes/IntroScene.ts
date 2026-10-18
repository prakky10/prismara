/**
 * New-game intro: a five-page story hook, the player's name, and the choice of
 * starter. Ends by writing a fresh `GameState` and dropping into the overworld.
 */

import Phaser from 'phaser';
import { SCENES } from './keys';
import { COLORS, DEPTHS, FONTS, VIEW_HEIGHT, VIEW_WIDTH } from '../ui/Theme';
import { InputManager } from '../core/InputManager';
import { Audio } from '../audio/AudioManager';
import { Game } from '../world/GameContext';
import { STARTER_ORDER } from '../world/maps';
import { getSpecies, rivalStarterFor } from '../data/creatures';
import { CreatureRig } from '../render/CreatureRig';
import { createScenicVista } from '../render/ScenicVista';
import { promptName } from '../ui/NamePrompt';
import { Panel } from '../ui/Panel';
import { TypeBadge } from '../ui/TypeBadge';
import { toast } from '../ui/Popups';
import { autosave } from '../core/SaveManager';

type Stage = 'story' | 'naming' | 'starter' | 'confirm' | 'done';

const STORY: string[] = [
  // The naming screen comes after these pages, so the companion is not named here.
  'Every night for a hundred years, the lighthouse above Emberleaf turned the sky prism’s light into six beacons. Your mother kept it.',
  'Then, one midnight last winter, the prism cracked. The beacons went dark, the sea rose, and your mother was gone. Only her journal washed ashore.',
  'Professor Lumen of the Emberleaf Lab has kept it safe. Its pages name six Keepers, six Trophies, and a seventh light he cannot read.',
  'Your oldest friend’s brother, Soren, left that week to join Team Eclipse. Their leader, Voss, once a keeper himself, waits at the Duskmoor altar, holding the whole world in twilight.',
  'Six Trophies can wake six beacons. Follow her journal, light them one by one, and the last light may bring her home.',
];

const CARD_X = [260, 480, 700];

const IVORY = '#f4efe2';
const BRASS = '#c9a227';
const NAVY = '#0b1020';

export class IntroScene extends Phaser.Scene {
  private controls!: InputManager;
  private stage: Stage = 'story';
  private storyIndex = 0;
  private playerName = 'Rowan';
  private rivalName = 'Kai';
  private starterIndex = 0;
  private storyPanel?: Panel;
  private storyText!: Phaser.GameObjects.Text;
  private pageText!: Phaser.GameObjects.Text;
  private starterTitle!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private starterRigs: CreatureRig[] = [];
  private cardFrames: Panel[] = [];

  constructor() {
    super(SCENES.intro);
  }

  create(): void {
    // Reset EVERY field so a repeated new-game run is identical to the first.
    this.stage = 'story';
    this.storyIndex = 0;
    this.playerName = 'Rowan';
    this.rivalName = 'Kai';
    this.starterIndex = 0;
    this.starterRigs = [];
    this.cardFrames = [];
    this.storyPanel = undefined;

    this.controls = new InputManager(this);
    this.cameras.main.transparent = true;
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    this.registry.set('reducedEffects', Game.settings.reducedEffects);
    createScenicVista(this);

    this.storyPanel = new Panel(this, VIEW_WIDTH / 2, 300, {
      width: VIEW_WIDTH - 160,
      height: 200,
      glow: COLORS.panelGlow,
    });
    this.storyPanel.setDepth(DEPTHS.ui);

    this.storyText = this.add
      .text(VIEW_WIDTH / 2, 294, '', {
        fontFamily: FONTS.body,
        fontSize: '20px',
        color: IVORY,
        align: 'center',
        wordWrap: { width: VIEW_WIDTH - 260 },
        lineSpacing: 10,
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.ui + 1);

    this.pageText = this.add
      .text(VIEW_WIDTH - 92, VIEW_HEIGHT - 44, '', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        color: BRASS,
      })
      .setOrigin(1, 0.5)
      .setDepth(DEPTHS.ui + 1);

    this.starterTitle = this.add
      .text(VIEW_WIDTH / 2, 84, '', {
        fontFamily: FONTS.body,
        fontSize: '26px',
        color: IVORY,
        fontStyle: 'bold',
        stroke: NAVY,
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.ui + 1)
      .setVisible(false);

    this.hint = this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT - 30, 'Press Z or Enter to continue', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        color: '#6d7d99',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.ui + 1);

    Audio.playMusic('title');
    this.showStoryPage();
  }

  private showStoryPage(): void {
    this.storyText.setText(STORY[this.storyIndex] ?? '');
    this.storyText.setAlpha(0);
    this.pageText.setText(`${this.storyIndex + 1} / ${STORY.length}`);
    this.tweens.add({ targets: this.storyText, alpha: 1, duration: 240 });
  }

  private async advanceStory(): Promise<void> {
    this.storyIndex += 1;
    if (this.storyIndex < STORY.length) {
      Audio.playSfx('blip');
      this.showStoryPage();
      return;
    }

    this.stage = 'naming';
    this.storyText.setText('');
    this.pageText.setText('');
    this.hint.setText('');
    Audio.playSfx('select');
    this.playerName = await promptName(this, 'What is your name?', 'Rowan');
    this.rivalName = await promptName(this, 'Name your companion?', 'Kai');
    this.buildStarterScreen();
  }

  private buildStarterScreen(): void {
    this.stage = 'starter';

    // Hide the story panel so the card art is completely unobscured.
    this.storyPanel?.setVisible(false);
    this.storyText.setVisible(false);
    this.pageText.setVisible(false);

    this.starterTitle.setVisible(true).setText('Choose your partner');
    this.hint.setText('← → to browse  ·  click to select  ·  click again or Z to confirm');

    STARTER_ORDER.forEach((id, index) => {
      const species = getSpecies(id);
      const x = CARD_X[index] ?? CARD_X[CARD_X.length - 1];

      const frame = new Panel(this, x, 300, { width: 180, height: 300, glow: 0xd4af37 });
      frame.setDepth(DEPTHS.actors);
      this.cardFrames.push(frame);

      const badge = new TypeBadge(this, x, 186, species.element);
      badge.setDepth(DEPTHS.actors + 2);

      this.add
        .text(x, 216, species.name, {
          fontFamily: FONTS.body,
          fontSize: '20px',
          color: IVORY,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(DEPTHS.actors + 2);

      const rig = new CreatureRig(this, id, { scale: 0.55 });
      rig.setPosition(x, 368);
      rig.setDepth(DEPTHS.actors + 1);
      this.starterRigs.push(rig);

      this.add
        .text(x, 424, species.role, {
          fontFamily: FONTS.body,
          fontSize: '12px',
          color: '#9fb0cc',
        })
        .setOrigin(0.5)
        .setDepth(DEPTHS.actors + 2);

      this.add
        .zone(x, 300, 180, 300)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTHS.actors + 3)
        .on('pointerdown', () => this.pickStarter(index));
    });

    this.highlightStarter();
  }

  private pickStarter(index: number): void {
    if (index === this.starterIndex) {
      this.confirmStarter();
      return;
    }
    this.starterIndex = index;
    Audio.playSfx('cursor');
    this.highlightStarter();
  }

  private highlightStarter(): void {
    this.cardFrames.forEach((frame, index) => {
      const selected = index === this.starterIndex;
      frame.setAlpha(selected ? 1 : 0.5);
      frame.setGlow(selected ? 0xd4af37 : 0x1b2440);
    });
    this.starterRigs.forEach((rig, index) => {
      this.tweens.add({
        targets: rig,
        alpha: index === this.starterIndex ? 1 : 0.45,
        duration: 160,
      });
    });
  }

  private confirmStarter(): void {
    if (this.stage !== 'starter') return;
    const starter = STARTER_ORDER[this.starterIndex];
    const rivalPick = rivalStarterFor(starter);
    this.stage = 'confirm';
    Audio.playSfx('select');
    this.hint.setText(`You: ${getSpecies(starter).name}   ·   ${this.rivalName}: ${getSpecies(rivalPick).name}`);
    void this.beginAdventure(starter);
  }

  private async beginAdventure(starter: string): Promise<void> {
    Game.state.beginAdventure(this.playerName, this.rivalName, starter);
    Game.state.setFlag('intro-complete');
    Game.slot = 0;
    autosave(Game.state);

    toast(this, `${getSpecies(starter).name} joined your party!`, COLORS.gold, 2200);
    await wait(this, 900);

    this.stage = 'done';
    Audio.playSfx('victory');
    this.cameras.main.fadeOut(500, 5, 7, 15);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      Audio.playMusic('town');
      this.scene.stop(SCENES.intro);
      this.scene.start(SCENES.overworld);
    });
  }

  override update(time: number): void {
    this.controls.update();
    if (this.stage === 'done') return;

    if (this.stage === 'story') {
      if (this.controls.justPressed('confirm')) void this.advanceStory();
      return;
    }

    if (this.stage === 'starter') {
      const horizontal = this.controls.horizontalNav(time);
      if (horizontal !== 0) {
        this.starterIndex =
          (this.starterIndex + horizontal + STARTER_ORDER.length) % STARTER_ORDER.length;
        Audio.playSfx('cursor');
        this.highlightStarter();
      }
      if (this.controls.justPressed('confirm')) this.confirmStarter();
    }
  }
}

function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => scene.time.delayedCall(ms, () => resolve()));
}
