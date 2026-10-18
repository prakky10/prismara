/**
 * The field journal: the current chapter and its side quests, the six trophies
 * earned from the Trial keepers, and a schematic region atlas.
 *
 * Launched over the paused overworld from the Pause menu and always returns
 * there on cancel (or a header tab click).
 */

import Phaser from 'phaser';
import { SCENES } from './keys';
import { COLORS, FONTS, VIEW_HEIGHT, VIEW_WIDTH } from '../ui/Theme';
import { InputManager } from '../core/InputManager';
import { Audio } from '../audio/AudioManager';
import { Game } from '../world/GameContext';
import { autosave } from '../core/SaveManager';
import { toast } from '../ui/Popups';
import { ITEMS, type ItemId } from '../data/items';
import { QUESTS, TROPHIES, claimQuest, getChapter, questStatus } from '../world/campaign';

type JournalTab = 'journal' | 'trophies' | 'map';

const TAB_ORDER: JournalTab[] = ['journal', 'trophies', 'map'];
const TAB_LABELS: Record<JournalTab, string> = {
  journal: 'JOURNAL',
  trophies: 'TROPHIES',
  map: 'REGION',
};

const CARD_W = 220;
const CARD_H = 130;
const CARD_COLS = 3;

const FIELD_ABILITY_NAMES: Record<string, string> = {
  cut: 'Cut',
  magnet: 'Magnet Lifts',
  surf: 'Surf',
  light: 'Light Caves',
  smash: 'Smash',
  'night-sight': 'Night Sight',
};

interface RegionNode {
  id: string;
  name: string;
  x: number;
  y: number;
  trophyId?: string;
}

const REGION_NODES: RegionNode[] = [
  { id: 'emberleaf-town', name: 'Emberleaf', x: 110, y: 300 },
  { id: 'whisperwood-forest', name: 'Whisperwood', x: 200, y: 200 },
  { id: 'thistlebrook', name: 'Thistlebrook', x: 280, y: 300, trophyId: 'sigil-grass' },
  { id: 'voltspire-city', name: 'Voltspire', x: 400, y: 210, trophyId: 'sigil-electric' },
  { id: 'tidehaven', name: 'Tidehaven', x: 350, y: 380, trophyId: 'sigil-water' },
  { id: 'ashfall-town', name: 'Ashfall', x: 520, y: 320, trophyId: 'sigil-fire' },
  { id: 'geode-hollow', name: 'Geode', x: 620, y: 400, trophyId: 'sigil-crystal' },
  { id: 'duskmoor-ruins', name: 'Duskmoor', x: 710, y: 250, trophyId: 'sigil-shadow' },
  { id: 'prism-summit', name: 'Summit', x: 835, y: 140 },
];

interface QuestRow {
  bg: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

interface TrophyCard {
  bg: Phaser.GameObjects.Graphics;
  cup: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  keeper: Phaser.GameObjects.Text;
  virtue: Phaser.GameObjects.Text;
  x: number;
  y: number;
  cx: number;
  cy: number;
}

export class JournalScene extends Phaser.Scene {
  private controls!: InputManager;
  private tab: JournalTab = 'journal';
  private returnTo: string = SCENES.pause;

  private headerTexts: Array<{ tab: JournalTab; text: Phaser.GameObjects.Text }> = [];

  private journalGroup!: Phaser.GameObjects.Container;
  private chapterTitle!: Phaser.GameObjects.Text;
  private chapterObjective!: Phaser.GameObjects.Text;
  private questRows: QuestRow[] = [];
  private questCursor = 0;
  private questTitle!: Phaser.GameObjects.Text;
  private questBody!: Phaser.GameObjects.Text;
  private claimBg!: Phaser.GameObjects.Rectangle;
  private claimText!: Phaser.GameObjects.Text;

  private trophyGroup!: Phaser.GameObjects.Container;
  private trophyCards: TrophyCard[] = [];
  private trophyCursor = 0;
  private trophyDetail!: Phaser.GameObjects.Text;

  private regionGroup!: Phaser.GameObjects.Container;
  private regionDetail!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.journal);
  }

  init(data: object = {}): void {
    const payload = data as { tab?: JournalTab; returnTo?: string };
    this.tab = payload.tab ?? 'journal';
    this.returnTo = payload.returnTo ?? SCENES.pause;
  }

  create(): void {
    this.questCursor = 0;
    this.trophyCursor = 0;
    this.headerTexts = [];
    this.questRows = [];
    this.trophyCards = [];

    this.controls = new InputManager(this);
    this.cameras.main.setBackgroundColor('#0b1020');

    this.buildBackdrop();
    this.buildHeader();

    this.journalGroup = this.add.container(0, 0);
    this.trophyGroup = this.add.container(0, 0);
    this.regionGroup = this.add.container(0, 0);

    this.buildJournalTab();
    this.buildTrophyTab();
    this.buildRegionTab();

    if (this.scene.isActive(SCENES.overworld)) this.scene.pause(SCENES.overworld);
    this.applyTab();
  }

  /* ------------------------------------------------------------ chrome -- */

  private buildBackdrop(): void {
    this.add.rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 0x0b1020, 1).setOrigin(0, 0);
    const paper = this.add.graphics();
    paper.fillStyle(0x151f38, 0.6);
    paper.fillRoundedRect(16, 76, VIEW_WIDTH - 32, VIEW_HEIGHT - 92, 14);
    paper.lineStyle(1, 0x3d5480, 0.5);
    paper.strokeRoundedRect(16, 76, VIEW_WIDTH - 32, VIEW_HEIGHT - 92, 14);
  }

  private buildHeader(): void {
    this.add.rectangle(0, 0, VIEW_WIDTH, 64, 0x101a30, 0.96).setOrigin(0, 0);

    this.add
      .text(24, 30, 'FIELD JOURNAL', {
        fontFamily: FONTS.body,
        fontSize: '18px',
        color: '#f2f6ff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    this.add
      .text(24, 48, 'Chapters \u00b7 Quests \u00b7 Trophies \u00b7 Region', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        color: '#6d7d99',
      })
      .setOrigin(0, 0.5);

    TAB_ORDER.forEach((tab, index) => {
      const x = VIEW_WIDTH / 2 - 130 + index * 130;
      const text = this.add
        .text(x, 32, TAB_LABELS[tab], {
          fontFamily: FONTS.body,
          fontSize: '15px',
          color: '#7c8aa5',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      const zone = this.add
        .zone(x, 32, 120, 44)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.setTab(tab);
        Audio.playSfx('select');
      });
      this.headerTexts.push({ tab, text });
    });

    this.add
      .text(VIEW_WIDTH - 24, 32, 'Esc', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        color: '#6d7d99',
      })
      .setOrigin(1, 0.5);
  }

  private drawPanel(x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(0x0f1730, 0.9);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(1, 0x3d5480, 0.6);
    g.strokeRoundedRect(x, y, w, h, 10);
    return g;
  }

  /* ----------------------------------------------------------- journal -- */

  private buildJournalTab(): void {
    this.chapterTitle = this.add.text(40, 96, '', {
      fontFamily: FONTS.body,
      fontSize: '20px',
      color: '#ffd60a',
      fontStyle: 'bold',
    });
    this.journalGroup.add(this.chapterTitle);

    this.chapterObjective = this.add.text(40, 126, '', {
      fontFamily: FONTS.body,
      fontSize: '14px',
      color: '#dce6f7',
      wordWrap: { width: 880 },
      lineSpacing: 4,
    });
    this.journalGroup.add(this.chapterObjective);

    const listX = 40;
    const listW = 300;
    const rowH = 44;
    const listTop = 178;

    this.journalGroup.add(
      this.drawPanel(listX - 6, listTop - 10, listW + 12, rowH * QUESTS.length + 20),
    );

    QUESTS.forEach((quest, index) => {
      const y = listTop + index * rowH + rowH / 2;
      const bg = this.add.rectangle(listX + listW / 2, y, listW, rowH - 6, COLORS.panelGlow, 0);
      const title = this.add
        .text(listX + 14, y, quest.title, {
          fontFamily: FONTS.body,
          fontSize: '15px',
          color: '#f2f6ff',
        })
        .setOrigin(0, 0.5);
      const status = this.add
        .text(listX + listW - 14, y, '', {
          fontFamily: FONTS.body,
          fontSize: '11px',
          color: '#9fb0cc',
        })
        .setOrigin(1, 0.5);
      const zone = this.add
        .zone(listX + listW / 2, y, listW, rowH - 6)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        if (this.tab === 'journal') this.setQuestCursor(index);
      });
      zone.on('pointerdown', () => {
        if (this.tab === 'journal') this.setQuestCursor(index);
      });
      this.journalGroup.add([bg, title, status, zone]);
      this.questRows.push({ bg, title, status });
    });

    const detailX = 366;
    const detailW = 460;

    this.questTitle = this.add.text(detailX, listTop + 6, '', {
      fontFamily: FONTS.body,
      fontSize: '18px',
      color: '#7fffe5',
      fontStyle: 'bold',
    });
    this.questBody = this.add.text(detailX, listTop + 42, '', {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: '#dce6f7',
      wordWrap: { width: detailW },
      lineSpacing: 6,
    });
    this.journalGroup.add([this.questTitle, this.questBody]);

    const claimX = detailX + detailW / 2;
    const claimY = 470;
    this.claimBg = this.add
      .rectangle(claimX, claimY, 200, 42, COLORS.panelGlow, 0.2)
      .setStrokeStyle(2, COLORS.panelGlow, 0.7);
    this.claimText = this.add
      .text(claimX, claimY, 'Claim Reward', {
        fontFamily: FONTS.body,
        fontSize: '15px',
        color: '#7fffe5',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const claimZone = this.add
      .zone(claimX, claimY, 200, 42)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    claimZone.on('pointerdown', () => {
      if (this.tab === 'journal') this.tryClaim();
    });
    this.journalGroup.add([this.claimBg, this.claimText, claimZone]);

    this.refreshJournal();
  }

  private refreshJournal(): void {
    const chapter = getChapter(Game.state);
    this.chapterTitle.setText('Chapter ' + chapter.number + ' \u00b7 ' + chapter.title);
    this.chapterObjective.setText(chapter.objective);

    QUESTS.forEach((quest, index) => {
      const row = this.questRows[index];
      if (!row) return;
      const status = questStatus(Game.state, quest);
      const selected = index === this.questCursor;
      row.title.setColor(status === 'claimed' ? '#7c8aa5' : selected ? '#7fffe5' : '#f2f6ff');
      row.status.setText(status === 'ready' ? 'READY' : status === 'claimed' ? 'DONE' : '');
      row.status.setColor(status === 'ready' ? '#ffd60a' : '#7fffe5');
      row.bg.setFillStyle(COLORS.panelGlow, selected ? 0.12 : 0);
    });

    this.refreshQuestDetail();
  }

  private refreshQuestDetail(): void {
    const quest = QUESTS[this.questCursor];
    if (!quest) return;
    const status = questStatus(Game.state, quest);
    this.questTitle.setText(quest.title);
    this.questBody.setText(
      [
        quest.description,
        '',
        'Location: ' + quest.location,
        'Reward: ' + quest.rewardLabel,
        'Status: ' +
          (status === 'ready' ? 'Ready to claim' : status === 'claimed' ? 'Claimed' : 'In progress'),
      ].join('\n'),
    );

    const ready = status === 'ready';
    this.claimBg.setFillStyle(COLORS.panelGlow, ready ? 0.28 : 0.06);
    this.claimBg.setStrokeStyle(2, ready ? COLORS.panelGlow : COLORS.textMuted, ready ? 0.9 : 0.4);
    this.claimText.setText(status === 'claimed' ? 'Claimed' : 'Claim Reward');
    this.claimText.setColor(ready ? '#7fffe5' : '#6d7d99');
  }

  private setQuestCursor(index: number): void {
    if (index < 0 || index >= QUESTS.length) return;
    this.questCursor = index;
    this.refreshJournal();
  }

  private tryClaim(): void {
    const quest = QUESTS[this.questCursor];
    if (!quest) return;
    if (questStatus(Game.state, quest) !== 'ready') {
      Audio.playSfx('denied');
      return;
    }
    const lines = claimQuest(Game.state, quest.id);
    if (lines.length === 0) return;
    autosave(Game.state);
    Audio.playSfx('save');
    toast(this, lines[0], COLORS.gold, 2400);
    this.refreshJournal();
  }

  /* ----------------------------------------------------------- trophies -- */

  private buildTrophyTab(): void {
    const gapX = 40;
    const gapY = 20;
    const totalW = CARD_COLS * CARD_W + (CARD_COLS - 1) * gapX;
    const startX = (VIEW_WIDTH - totalW) / 2;
    const startY = 92;

    TROPHIES.forEach((trophy, index) => {
      const col = index % CARD_COLS;
      const row = Math.floor(index / CARD_COLS);
      const x = startX + col * (CARD_W + gapX);
      const y = startY + row * (CARD_H + gapY);
      const cx = x + CARD_W / 2;
      const cy = y + CARD_H / 2;

      const bg = this.add.graphics();
      const cup = this.add.graphics();
      const name = this.add
        .text(cx, cy + 20, trophy.name, {
          fontFamily: FONTS.body,
          fontSize: '13px',
          color: '#f2f6ff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      const keeper = this.add
        .text(cx, cy + 38, 'Keeper ' + trophy.keeper, {
          fontFamily: FONTS.body,
          fontSize: '11px',
          color: '#9fb0cc',
        })
        .setOrigin(0.5);
      const virtue = this.add
        .text(cx, cy + 54, trophy.virtue, {
          fontFamily: FONTS.body,
          fontSize: '11px',
          color: '#ffd60a',
        })
        .setOrigin(0.5);

      const zone = this.add
        .zone(cx, cy, CARD_W, CARD_H)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        if (this.tab === 'trophies') this.setTrophyCursor(index);
      });
      zone.on('pointerdown', () => {
        if (this.tab === 'trophies') this.setTrophyCursor(index);
      });

      this.trophyGroup.add([bg, cup, name, keeper, virtue, zone]);
      this.trophyCards.push({ bg, cup, name, keeper, virtue, x, y, cx, cy });
    });

    this.trophyDetail = this.add.text(40, 404, '', {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: '#dce6f7',
      wordWrap: { width: 880 },
      lineSpacing: 6,
    });
    this.trophyGroup.add(this.trophyDetail);

    this.refreshTrophies();
  }

  private drawCardBg(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    color: number,
    earned: boolean,
    selected: boolean,
  ): void {
    g.clear();
    g.fillStyle(0x0f1730, 0.92);
    g.fillRoundedRect(x, y, CARD_W, CARD_H, 12);
    if (earned) {
      g.fillStyle(color, 0.1);
      g.fillRoundedRect(x + 2, y + 2, CARD_W - 4, CARD_H - 4, 10);
    }
    const edge = selected ? COLORS.cursor : earned ? color : 0x3d5480;
    g.lineStyle(selected ? 3 : 2, edge, selected ? 1 : 0.75);
    g.strokeRoundedRect(x, y, CARD_W, CARD_H, 12);
  }

  private drawTrophy(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    color: number,
    earned: boolean,
  ): void {
    const tint = earned ? color : 0x36445f;
    const alpha = earned ? 1 : 0.7;
    g.clear();
    g.lineStyle(4, tint, alpha);
    g.strokeEllipse(cx - 25, cy - 12, 20, 24);
    g.strokeEllipse(cx + 25, cy - 12, 20, 24);
    g.fillStyle(tint, alpha);
    g.fillRoundedRect(cx - 22, cy - 26, 44, 34, 10);
    g.fillRect(cx - 5, cy + 8, 10, 10);
    g.fillRoundedRect(cx - 18, cy + 18, 36, 8, 3);
    g.fillStyle(earned ? 0xffffff : 0x1b2437, earned ? 0.85 : 0.5);
    g.fillCircle(cx, cy - 10, 7);
  }

  private refreshTrophies(): void {
    TROPHIES.forEach((trophy, index) => {
      const card = this.trophyCards[index];
      if (!card) return;
      const earned = Game.state.hasSigil(trophy.id);
      const selected = index === this.trophyCursor;
      this.drawCardBg(card.bg, card.x, card.y, trophy.color, earned, selected);
      this.drawTrophy(card.cup, card.cx, card.cy - 16, trophy.color, earned);
      card.name.setColor(earned ? '#f2f6ff' : '#7c8aa5');
      card.keeper.setColor(earned ? '#9fb0cc' : '#5c6b85');
      card.virtue.setColor(earned ? '#ffd60a' : '#5c6b85');
    });
    this.refreshTrophyDetail();
  }

  private refreshTrophyDetail(): void {
    const trophy = TROPHIES[this.trophyCursor];
    if (!trophy) return;
    const earned = Game.state.hasSigil(trophy.id);
    if (earned) {
      this.trophyDetail.setText(
        [
          trophy.name + ' \u00b7 Keeper ' + trophy.keeper + ' \u00b7 ' + trophy.virtue,
          trophy.memory,
          'Field ability unlocked: ' + this.fieldAbilityOf(trophy.id) + '.',
        ].join('\n'),
      );
    } else {
      this.trophyDetail.setText(
        trophy.name +
          ' \u00b7 locked\nDefeat ' +
          trophy.keeper +
          ' in ' +
          this.placeName(trophy.mapId) +
          ' to earn this trophy and recall its memory.',
      );
    }
  }

  private fieldAbilityOf(sigilId: string): string {
    const item = ITEMS[sigilId as ItemId];
    if (!item || item.effect.kind !== 'field') return 'a new field ability';
    return FIELD_ABILITY_NAMES[item.effect.ability] ?? item.effect.ability;
  }

  private placeName(mapId: string): string {
    const node = REGION_NODES.find((n) => n.id === mapId);
    return node ? node.name : mapId;
  }

  private setTrophyCursor(index: number): void {
    if (index < 0 || index >= TROPHIES.length) return;
    this.trophyCursor = index;
    this.refreshTrophies();
  }

  /* ------------------------------------------------------------- region -- */

  private buildRegionTab(): void {
    const g = this.add.graphics();
    g.fillStyle(0x0f1730, 0.9);
    g.fillRoundedRect(40, 84, VIEW_WIDTH - 80, 340, 12);
    g.lineStyle(2, 0x3d5480, 0.7);
    g.strokeRoundedRect(40, 84, VIEW_WIDTH - 80, 340, 12);

    g.lineStyle(3, 0x3d5480, 0.9);
    g.beginPath();
    g.moveTo(REGION_NODES[0].x, REGION_NODES[0].y);
    for (let i = 1; i < REGION_NODES.length; i++) {
      g.lineTo(REGION_NODES[i].x, REGION_NODES[i].y);
    }
    g.strokePath();
    this.regionGroup.add(g);

    const currentMap = Game.state.position.mapId;
    for (const node of REGION_NODES) {
      const isCurrent = node.id === currentMap;
      const marker = this.add.graphics();
      marker.fillStyle(isCurrent ? 0xffd60a : 0x1b2437, 1);
      marker.fillCircle(node.x, node.y, 9);
      marker.lineStyle(2, isCurrent ? 0xffffff : 0x7fffe5, isCurrent ? 1 : 0.7);
      marker.strokeCircle(node.x, node.y, 9);
      if (node.trophyId) {
        const earned = Game.state.hasSigil(node.trophyId);
        marker.fillStyle(earned ? 0xffd60a : 0x36445f, 1);
        marker.fillCircle(node.x + 14, node.y - 14, 5);
        marker.lineStyle(1, 0x0b1020, 1);
        marker.strokeCircle(node.x + 14, node.y - 14, 5);
      }
      this.regionGroup.add(marker);

      const label = this.add
        .text(node.x, node.y + 15, node.name, {
          fontFamily: FONTS.body,
          fontSize: '11px',
          color: isCurrent ? '#ffd60a' : '#dce6f7',
        })
        .setOrigin(0.5, 0);
      this.regionGroup.add(label);
    }

    this.regionDetail = this.add.text(40, 438, '', {
      fontFamily: FONTS.body,
      fontSize: '13px',
      color: '#dce6f7',
      wordWrap: { width: 880 },
    });
    this.regionGroup.add(this.regionDetail);
    this.refreshRegion();
  }

  private refreshRegion(): void {
    const currentMap = Game.state.position.mapId;
    const node = REGION_NODES.find((n) => n.id === currentMap);
    const earned = TROPHIES.filter((t) => Game.state.hasSigil(t.id)).length;
    this.regionDetail.setText(
      (node ? 'You are in ' + node.name + '.' : 'Somewhere in Prismara.') +
        '  Trophies earned: ' +
        earned +
        '/6. Gold nodes and dots mark completed trials.',
    );
  }

  /* --------------------------------------------------------------- flow -- */

  private applyTab(): void {
    this.journalGroup.setVisible(this.tab === 'journal');
    this.trophyGroup.setVisible(this.tab === 'trophies');
    this.regionGroup.setVisible(this.tab === 'map');
    for (const entry of this.headerTexts) {
      entry.text.setColor(entry.tab === this.tab ? '#ffd60a' : '#7c8aa5');
    }
  }

  private setTab(tab: JournalTab): void {
    this.tab = tab;
    this.applyTab();
  }

  private close(): void {
    Audio.playSfx('back');
    this.scene.start(this.returnTo);
  }

  override update(time: number): void {
    this.controls.update();

    if (this.controls.justPressed('cancel') || this.controls.justPressed('menu')) {
      this.close();
      return;
    }

    const horizontal = this.controls.horizontalNav(time);
    if (horizontal !== 0) {
      const current = TAB_ORDER.indexOf(this.tab);
      const next = (current + horizontal + TAB_ORDER.length) % TAB_ORDER.length;
      if (next !== current) {
        this.setTab(TAB_ORDER[next]);
        Audio.playSfx('cursor');
      }
    }

    const vertical = this.controls.verticalNav(time);
    if (vertical !== 0) {
      if (this.tab === 'journal') {
        this.setQuestCursor((this.questCursor + vertical + QUESTS.length) % QUESTS.length);
        Audio.playSfx('cursor');
      } else if (this.tab === 'trophies') {
        this.setTrophyCursor((this.trophyCursor + vertical + TROPHIES.length) % TROPHIES.length);
        Audio.playSfx('cursor');
      }
    }

    if (this.controls.justPressed('confirm') && this.tab === 'journal') {
      this.tryClaim();
    }
  }
}
