/**
 * The Prismadex: all forty creatures with Seen/Caught status, an animated
 * viewer, type filters, habitat hints, cry playback and completion percentage.
 */

import Phaser from 'phaser';
import { SCENES, type SceneKey } from './keys';
import { COLORS, DEPTHS, FONTS, VIEW_HEIGHT, VIEW_WIDTH } from '../ui/Theme';
import { InputManager } from '../core/InputManager';
import { Panel } from '../ui/Panel';
import { MenuList } from '../ui/MenuList';
import { TypeBadge } from '../ui/TypeBadge';
import { Audio } from '../audio/AudioManager';
import { Game } from '../world/GameContext';
import { CREATURE_IDS, bst, getSpecies } from '../data/creatures';
import { CreatureRig } from '../render/CreatureRig';
import { ELEMENTS, ELEMENT_INFO, STRONG_AGAINST, WEAK_TO, type Element } from '../data/types';
import { wildHabitats } from '../world/encounters';
import { trainerLocation } from '../world/trainers';

type Filter = 'all' | Element | 'caught';

const FILTERS: Filter[] = ['all', ...ELEMENTS, 'caught'];

export class DexScene extends Phaser.Scene {
  private controls!: InputManager;
  private returnTo: SceneKey = SCENES.pause;
  private filter: Filter = 'all';
  private list!: MenuList;
  private detail!: Phaser.GameObjects.Container;
  private filterText!: Phaser.GameObjects.Text;
  private habitats = wildHabitats();

  constructor() {
    super(SCENES.dex);
  }

  init(data: { returnTo?: SceneKey }): void {
    this.returnTo = data?.returnTo ?? SCENES.pause;
  }

  create(): void {
    this.filter = 'all';
    this.controls = new InputManager(this);
    this.cameras.main.setBackgroundColor('#05070f');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x101a30, 0x101a30, 0x05070f, 0x05070f, 1);
    bg.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    this.add
      .text(48, 28, 'PRISMADEX', {
        fontFamily: FONTS.body,
        fontSize: '24px',
        color: '#f2f6ff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.ui);

    this.filterText = this.add
      .text(VIEW_WIDTH - 48, 28, '', {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: '#9fb0cc',
      })
      .setOrigin(1, 0.5)
      .setDepth(DEPTHS.ui);

    new Panel(this, 235, 306, { width: 350, height: 400, glow: COLORS.panelEdge }).setDepth(DEPTHS.ui);
    new Panel(this, 690, 306, { width: 470, height: 400, glow: COLORS.panelGlow }).setDepth(DEPTHS.ui);

    this.list = new MenuList(this, 80, 122, {
      items: [],
      width: 320,
      rowHeight: 26,
      fontSize: 14,
      visibleRows: 12,
      onSelect: () => Audio.playSfx('cry-preview'),
      onHighlight: () => {
        Audio.playSfx('cursor');
        this.drawDetail();
      },
    });
    this.list.setDepth(DEPTHS.ui + 1);

    this.detail = this.add.container(0, 0).setDepth(DEPTHS.ui + 1);

    this.refreshList();

    this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT - 22, 'X back \u00b7 \u2190 \u2192 filter \u00b7 Z play cry', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: '#6d7d99',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.overlay);
  }

  private refreshList(): void {
    const entries = CREATURE_IDS.filter((id) => {
      const species = getSpecies(id);
      if (this.filter === 'all') return true;
      if (this.filter === 'caught') return Game.state.isCaught(id);
      return species.element === this.filter;
    });

    this.list.setItems(
      entries.map((id) => {
        const species = getSpecies(id);
        const seen = Game.state.isSeen(id);
        const caught = Game.state.isCaught(id);
        return {
          value: id,
          label: seen ? species.name : '?????',
          sublabel: `#${String(species.dexNumber).padStart(3, '0')}`,
          color: caught ? 0x7fffe5 : seen ? 0xf2f6ff : 0x5c6b85,
          trailing: caught ? '\u2713' : seen ? '\u00b7' : '',
        };
      }),
    );

    const caught = Game.state.caughtCount();
    const seen = Game.state.seenCount();
    const pct = Math.round((caught / CREATURE_IDS.length) * 100);
    this.filterText.setText(
      `Filter: ${this.filter.toUpperCase()}   Caught ${caught}/40   Seen ${seen}/40   ${pct}%`,
    );
    this.drawDetail();
  }

  private drawDetail(): void {
    this.detail.removeAll(true);
    const id = this.list.selectedValue;
    if (!id) return;

    const species = getSpecies(id);
    const caught = Game.state.isCaught(id);
    const seen = Game.state.isSeen(id);

    const rig = new CreatureRig(this, id, { scale: 0.55, facing: -1 });
    rig.setPosition(790, 450);
    this.detail.add(rig);

    const name = this.add
      .text(500, 116, seen ? species.name : '?????', {
        fontFamily: FONTS.body,
        fontSize: '24px',
        color: '#f2f6ff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    this.detail.add(name);

    const meta = this.add
      .text(
        500,
        142,
        `#${String(species.dexNumber).padStart(3, '0')}  \u00b7  ${species.role}  \u00b7  BST ${bst(species)}`,
        { fontFamily: FONTS.body, fontSize: '12px', color: '#9fb0cc' },
      )
      .setOrigin(0, 0.5);
    this.detail.add(meta);

    const badge = new TypeBadge(this, 880, 116, species.element);
    this.detail.add(badge);

    const stats = species.baseStats;
    const statLines = [
      `HP  ${stats.hp}    Atk ${stats.attack}    Def ${stats.defense}`,
      `SpA ${stats.spPower}    SpD ${stats.spGuard}    Spe ${stats.speed}`,
    ];

    const bodyText = caught
      ? [
          species.concept,
          '',
          statLines.join('\n'),
          '',
          `Ability: ${species.ability.replace(/-/g, ' ')}`,
          `Signature: ${species.signatureMove ? species.signatureMove.replace(/-/g, ' ') : '\u2014'}`,
          `Habitat: ${this.habitats[id]?.slice(0, 2).join(', ') ?? 'Unknown'}`,
          species.encounterNote ?? '',
        ]
      : [seen ? 'Seen, but not yet caught.' : 'Not yet seen.', '', 'Catch or evolve this creature to record it.'];

    const body = this.add
      .text(500, 176, bodyText.filter(Boolean).join('\n'), {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: '#dce6f7',
        wordWrap: { width: 400 },
        lineSpacing: 6,
      })
      .setOrigin(0, 0);
    this.detail.add(body);

    // Matchups strip along the bottom.
    const strong = STRONG_AGAINST[species.element]
      .map((element) => `${ELEMENT_INFO[element].glyph}${element}`)
      .join('  ');
    const weak = WEAK_TO[species.element]
      .map((element) => `${ELEMENT_INFO[element].glyph}${element}`)
      .join('  ');
    const matchups = this.add
      .text(500, 470, `Strong vs: ${strong}\nWeak to:  ${weak}`, {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: '#9fb0cc',
        lineSpacing: 6,
      })
      .setOrigin(0, 0);
    this.detail.add(matchups);

    void trainerLocation;
  }

  private playCry(): void {
    const id = this.list.selectedValue;
    if (!id) return;
    if (!Game.state.isSeen(id)) {
      Audio.playSfx('denied');
      return;
    }
    const species = getSpecies(id);
    Audio.playCry(id, species.dexNumber, species.tier);
  }

  private goBack(): void {
    Audio.playSfx('back');
    const target = this.returnTo;
    const paused = this.scene.isPaused(target);
    const sleeping = this.scene.isSleeping(target);
    this.scene.stop(SCENES.dex);
    if (paused) this.scene.resume(target);
    else if (sleeping) this.scene.wake(target);
    else this.scene.start(target);
  }

  override update(time: number): void {
    this.controls.update();

    const v = this.controls.verticalNav(time, 300, 90);
    if (v !== 0) this.list.moveCursor(v);

    const h = this.controls.horizontalNav(time, 320, 160);
    if (h !== 0) {
      const index = FILTERS.indexOf(this.filter);
      this.filter = FILTERS[(index + h + FILTERS.length) % FILTERS.length];
      Audio.playSfx('cursor');
      this.refreshList();
    }

    if (this.controls.justPressed('confirm')) this.playCry();
    if (this.controls.justPressed('cancel')) this.goBack();
  }
}
