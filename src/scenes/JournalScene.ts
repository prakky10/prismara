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
import { JOURNAL_PAGES, knownLore } from '../world/story/journal';

const PAGE_LABELS = ['Page 1', 'Page 2', 'Page 3', 'Page 4', 'Page 5', 'Page 6', 'Page 7', 'Last entry'];

/** Deterministic ragged tear for locked pages. */
function tornEdge(seed: number, steps: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const n = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    out.push((n - Math.floor(n)) * 5 - 1);
  }
  return out;
}

type JournalTab = 'journal' | 'pages' | 'trophies' | 'map';

const TAB_ORDER: JournalTab[] = ['journal', 'pages', 'trophies', 'map'];
const TAB_LABELS: Record<JournalTab, string> = {
  journal: 'JOURNAL',
  pages: 'PAGES',
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

  private pagesGroup!: Phaser.GameObjects.Container;
  private pageRows: Array<{ bg: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; found: boolean }> = [];
  private pageCursor = 0;
  private pageTitle!: Phaser.GameObjects.Text;
  private pageBody!: Phaser.GameObjects.Text;
  private pageLore!: Phaser.GameObjects.Text;
  private pageCount!: Phaser.GameObjects.Text;

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
    this.pageRows = [];
    this.pageCursor = 0;

    this.controls = new InputManager(this);
    this.cameras.main.setBackgroundColor('#0b1020');

    this.buildBackdrop();
    this.buildHeader();

    this.journalGroup = this.add.container(0, 0);
    this.trophyGroup = this.add.container(0, 0);
    this.regionGroup = this.add.container(0, 0);
    this.pagesGroup = this.add.container(0, 0);

    this.buildJournalTab();
    this.buildPagesTab();
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
      const x = VIEW_WIDTH / 2 - 180 + index * 120;
      const text = this.add
        .text(x, 32, TAB_LABELS[tab], {
          fontFamily: FONTS.body,
          fontSize: '15px',
          color: '#7c8aa5',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      const zone = this.add
        .zone(x, 32, 110, 44)
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
          (status === 'ready'
            ? 'Ready to claim'
            : status === 'claimed'
              ? 'Claimed'
              : 'In progress'),
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
    element = 'grass',
  ): void {
    type Pt = { x: number; y: number };
    const lerp = (a: number, b: number, t: number): number => {
      const ar = (a >> 16) & 255;
      const ag = (a >> 8) & 255;
      const ab = a & 255;
      const r = Math.round(ar + (((b >> 16) & 255) - ar) * t);
      const gr = Math.round(ag + (((b >> 8) & 255) - ag) * t);
      const bl = Math.round(ab + ((b & 255) - ab) * t);
      return (r << 16) | (gr << 8) | bl;
    };
    // Earned trophies shine in brass and their element colour; locked ones sit
    // in cold slate.
    const metalL = earned ? 0xf3dc8a : 0x5d6c8a;
    const metalM = earned ? 0xc9a227 : 0x46547a;
    const metalD = earned ? 0x7a6420 : 0x2d3752;
    const body = earned ? color : 0x3a4866;
    const bodyL = earned ? lerp(color, 0xffffff, 0.45) : 0x4a5877;
    const bodyD = earned ? lerp(color, 0x000000, 0.35) : 0x2c3750;
    const ex = cx;
    const ey = cy - 8;

    const poly = (pts: Pt[], fill: number, alpha = 1): void => {
      g.fillStyle(fill, alpha);
      g.fillPoints(pts as Phaser.Types.Math.Vector2Like[], true, true);
    };
    const outline = (pts: Pt[], width = 1.5, c = metalD): void => {
      g.lineStyle(width, c, earned ? 0.95 : 0.8);
      g.strokePoints(pts as Phaser.Types.Math.Vector2Like[], true, true);
    };
    const shift = (pts: Pt[], dx: number, dy: number): Pt[] =>
      pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    const abs = (pts: Array<[number, number]>, ox = ex, oy = ey, k = 1): Pt[] =>
      pts.map(([x, y]) => ({ x: ox + x * k, y: oy + y * k }));
    // A pointed leaf along an axis (angle in degrees, 0 = pointing right).
    const lens = (x: number, y: number, len: number, wid: number, deg: number): Pt[] => {
      const a = (deg * Math.PI) / 180;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const n = 10;
      const out: Pt[] = [];
      const at = (u: number, v: number): Pt => ({
        x: x + u * ca - v * sa,
        y: y + u * sa + v * ca,
      });
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        out.push(at(-len / 2 + len * t, (-wid / 2) * Math.sin(Math.PI * t) ** 0.8));
      }
      for (let i = n - 1; i > 0; i--) {
        const t = i / n;
        out.push(at(-len / 2 + len * t, (wid / 2) * Math.sin(Math.PI * t) ** 0.8));
      }
      return out;
    };

    g.clear();

    // Glow behind earned trophies.
    if (earned) {
      g.fillStyle(color, 0.05);
      g.fillCircle(ex, ey, 38);
      g.fillStyle(color, 0.07);
      g.fillCircle(ex, ey, 30);
      g.fillStyle(color, 0.1);
      g.fillCircle(ex, ey, 22);
    }

    // Plinth: two brass steps.
    g.fillStyle(metalD, 1);
    g.fillRoundedRect(cx - 22, cy + 19, 44, 9, 3);
    g.fillStyle(metalM, 1);
    g.fillRoundedRect(cx - 22, cy + 18, 44, 8, 3);
    g.fillStyle(metalL, earned ? 0.9 : 0.6);
    g.fillRect(cx - 19, cy + 18, 38, 1.5);
    g.fillStyle(metalD, 1);
    g.fillRoundedRect(cx - 15, cy + 12, 30, 8, 2);
    g.fillStyle(metalM, 1);
    g.fillRoundedRect(cx - 15, cy + 11, 30, 7, 2);
    g.fillStyle(metalL, earned ? 0.8 : 0.5);
    g.fillRect(cx - 13, cy + 11, 26, 1.2);

    switch (element) {
      case 'electric': {
        const hex: Array<[number, number]> = [];
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 2;
          hex.push([Math.cos(a) * 19, Math.sin(a) * 19]);
        }
        const outer = abs(hex);
        poly(shift(outer, 1, 2), 0x000000, 0.35);
        poly(outer, metalM);
        outline(outer, 1.5, metalD);
        poly(abs(hex, ex, ey, 0.82), bodyD);
        const bolt = abs([
          [4, -14],
          [-8, 2],
          [-1, 2],
          [-4, 14],
          [8, -3],
          [1, -3],
        ]);
        poly(bolt, body);
        poly(
          abs([
            [4, -14],
            [-8, 2],
            [-2, 2],
          ]),
          bodyL,
          0.9,
        );
        outline(bolt, 1, metalL);
        break;
      }
      case 'water': {
        // A chalice cradling a droplet.
        const cup = abs([
          [-18, -2],
          [18, -2],
          [14, 8],
          [4, 12],
          [-4, 12],
          [-14, 8],
        ]);
        poly(shift(cup, 1, 2), 0x000000, 0.35);
        poly(cup, metalM);
        outline(cup, 1.5, metalD);
        poly(
          abs([
            [-14, -1],
            [-6, -1],
            [-3, 9],
            [-8, 8],
          ]),
          metalL,
          earned ? 0.7 : 0.4,
        );
        const drop: Pt[] = [{ x: ex, y: ey - 20 }];
        const cyD = ey - 3;
        const start = (-34.4 * Math.PI) / 180;
        const end = (214.4 * Math.PI) / 180;
        for (let i = 0; i <= 14; i++) {
          const a = start + ((end - start) * i) / 14;
          drop.push({ x: ex + Math.cos(a) * 12, y: cyD + Math.sin(a) * 12 });
        }
        poly(drop, body);
        outline(drop, 1.2, metalD);
        poly(
          abs([
            [-6, -4],
            [-3, -4],
            [-3, 4],
            [-7, 2],
          ]),
          bodyL,
          0.85,
        );
        break;
      }
      case 'fire': {
        const flame = abs([
          [1, -26],
          [8, -14],
          [14, -2],
          [12, 8],
          [4, 14],
          [-6, 14],
          [-13, 8],
          [-14, -2],
          [-8, -9],
          [-4, -14],
          [-3, -20],
        ]);
        poly(shift(flame, 1, 2), 0x000000, 0.35);
        poly(flame, bodyD);
        poly(
          abs(
            flame.map((p) => [p.x - ex, p.y - ey] as [number, number]),
            ex,
            ey,
            0.88,
          ),
          body,
        );
        outline(flame, 1.3, metalD);
        const core = abs(
          [
            [1, -10],
            [6, -1],
            [6, 7],
            [0, 11],
            [-6, 7],
            [-6, 0],
            [-2, -4],
          ],
          ex,
          ey + 2,
        );
        poly(core, earned ? lerp(color, 0xffe680, 0.7) : bodyL);
        poly(
          abs(
            [
              [0, -4],
              [3, 2],
              [2, 7],
              [-2, 7],
              [-3, 2],
            ],
            ex,
            ey + 3,
          ),
          earned ? 0xfff6c8 : bodyL,
          0.9,
        );
        break;
      }
      case 'crystal': {
        const mid = abs([
          [0, -27],
          [-10, -14],
          [-10, 6],
          [0, 13],
          [10, 6],
          [10, -14],
        ]);
        poly(shift(mid, 1, 2), 0x000000, 0.35);
        const left = abs(
          [
            [-18, -3],
            [-12, -12],
            [-6, -3],
            [-6, 8],
            [-17, 8],
          ],
          ex - 3,
          ey + 1,
        );
        const right = abs(
          [
            [18, -3],
            [12, -12],
            [6, -3],
            [6, 8],
            [17, 8],
          ],
          ex + 3,
          ey + 1,
        );
        poly(left, bodyD);
        poly(right, bodyD);
        poly(
          abs([
            [0, -27],
            [-10, -14],
            [-10, 6],
            [0, 13],
          ]),
          body,
        );
        poly(
          abs([
            [0, -27],
            [10, -14],
            [10, 6],
            [0, 13],
          ]),
          bodyL,
        );
        poly(
          abs([
            [0, -27],
            [-10, -14],
            [0, -10],
          ]),
          earned ? 0xffffff : bodyL,
          earned ? 0.5 : 0.4,
        );
        outline(mid, 1.3, metalD);
        outline(left, 1, metalD);
        outline(right, 1, metalD);
        g.lineStyle(1, metalL, earned ? 0.7 : 0.4);
        g.lineBetween(ex, ey - 27, ex, ey + 13);
        break;
      }
      case 'shadow': {
        // A crescent moon with a few stars.
        const R = 19;
        const r = 15;
        const dx = 9;
        const outerPts: Pt[] = [];
        const innerPts: Pt[] = [];
        for (let i = 0; i <= 48; i++) {
          const t = (i / 48) * Math.PI * 2;
          const px = Math.cos(t) * R;
          const py = Math.sin(t) * R;
          if (Math.hypot(px - dx, py) > r) outerPts.push({ x: ex + px, y: ey + py });
          const qx = dx + Math.cos(t) * r;
          const qy = Math.sin(t) * r;
          if (Math.hypot(qx, qy) < R) innerPts.push({ x: ex + qx, y: ey + qy });
        }
        innerPts.sort((a, b) => a.y - b.y);
        const moon = [...outerPts, ...innerPts];
        poly(shift(moon, 1, 2), 0x000000, 0.35);
        poly(moon, body);
        poly(
          moon.filter((p) => p.x < ex - 4),
          bodyL,
          0.55,
        );
        outline(moon, 1.3, metalD);
        const star = (sx: number, sy: number, k: number): void => {
          const pts = abs(
            [
              [0, -4],
              [1, -1],
              [4, 0],
              [1, 1],
              [0, 4],
              [-1, 1],
              [-4, 0],
              [-1, -1],
            ],
            sx,
            sy,
            k,
          );
          poly(pts, earned ? 0xf4efe2 : bodyL);
        };
        star(ex + 12, ey - 10, 1);
        star(ex + 16, ey + 3, 0.7);
        star(ex + 6, ey + 8, 0.5);
        break;
      }
      default: {
        // Grass: a sprig of three leaves on a stem.
        g.fillStyle(metalD, 1);
        g.fillRect(ex - 1.5, ey, 3, 14);
        const centre = lens(ex, ey - 8, 36, 15, -90);
        const leftLeaf = lens(ex - 9, ey - 1, 28, 12, -148);
        const rightLeaf = lens(ex + 9, ey - 1, 28, 12, -32);
        for (const leaf of [leftLeaf, rightLeaf, centre]) {
          poly(shift(leaf, 1, 2), 0x000000, 0.3);
        }
        poly(leftLeaf, bodyD);
        poly(rightLeaf, bodyD);
        poly(centre, body);
        poly(lens(ex - 9, ey - 2, 22, 7, -148), body);
        poly(lens(ex + 9, ey - 2, 22, 7, -32), body);
        poly(lens(ex - 2, ey - 10, 24, 6, -90), bodyL, 0.8);
        outline(leftLeaf, 1, metalD);
        outline(rightLeaf, 1, metalD);
        outline(centre, 1.2, metalD);
        break;
      }
    }

    // The gem set into the plinth, in the trophy's colour.
    const gy = cy + 22;
    const gem: Pt[] = [
      { x: cx, y: gy - 5 },
      { x: cx + 6, y: gy },
      { x: cx, y: gy + 5 },
      { x: cx - 6, y: gy },
    ];
    g.fillStyle(metalD, 1);
    g.fillCircle(cx, gy, 7);
    g.lineStyle(1.5, metalL, earned ? 0.9 : 0.5);
    g.strokeCircle(cx, gy, 7);
    poly(gem, earned ? color : 0x2a3550);
    poly(
      [
        { x: cx, y: gy - 5 },
        { x: cx + 6, y: gy },
        { x: cx, y: gy },
      ],
      earned ? lerp(color, 0xffffff, 0.5) : 0x35425f,
    );
    poly(
      [
        { x: cx, y: gy - 5 },
        { x: cx - 6, y: gy },
        { x: cx - 1, y: gy - 1 },
      ],
      earned ? 0xffffff : 0x3d4b6b,
      earned ? 0.65 : 0.5,
    );
    if (earned) {
      // Sparkles around the earned trophy.
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(cx + 26, cy - 24, 1.5, 7);
      g.fillRect(cx + 23.25, cy - 21.25, 7, 1.5);
      g.fillStyle(0xffffff, 0.7);
      g.fillRect(cx - 28, cy - 8, 1, 5);
      g.fillRect(cx - 30, cy - 6, 5, 1);
    }
  }

  private refreshTrophies(): void {
    TROPHIES.forEach((trophy, index) => {
      const card = this.trophyCards[index];
      if (!card) return;
      const earned = Game.state.hasSigil(trophy.id);
      const selected = index === this.trophyCursor;
      this.drawCardBg(card.bg, card.x, card.y, trophy.color, earned, selected);
      this.drawTrophy(card.cup, card.cx, card.cy - 16, trophy.color, earned, trophy.element);
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

  /* -------------------------------------------------------------- pages -- */

  private buildPagesTab(): void {
    const listX = 40;
    const listW = 250;
    const rowH = 44;
    const top = 92;
    const detailX = 312;
    const detailW = VIEW_WIDTH - detailX - 40;

    const rows = this.add.graphics();
    this.pagesGroup.add(rows);
    this.pagesGroup.add(this.drawPanel(detailX, top - 8, detailW, 262));

    JOURNAL_PAGES.forEach((_, index) => {
      const y = top + index * rowH;
      const bg = this.add.graphics();
      const label = this.add
        .text(listX + 48, y + rowH / 2 - 3, '', { fontFamily: FONTS.display, fontSize: '16px', color: '#dce6f7' })
        .setOrigin(0, 0.5);
      const zone = this.add
        .zone(listX + listW / 2, y + rowH / 2 - 3, listW, rowH - 6)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        if (this.tab === 'pages') this.setPageCursor(index);
      });
      zone.on('pointerdown', () => {
        if (this.tab === 'pages') this.setPageCursor(index);
      });
      this.pagesGroup.add([bg, label, zone]);
      this.pageRows.push({ bg, label, found: false });
    });

    this.pageCount = this.add
      .text(listX, top + JOURNAL_PAGES.length * rowH + 2, '', { fontFamily: FONTS.body, fontSize: '12px', color: '#9fb0cc' });
    this.pageTitle = this.add.text(detailX + 20, top + 6, '', {
      fontFamily: FONTS.display,
      fontSize: '20px',
      color: '#ffd60a',
    });
    this.pageBody = this.add.text(detailX + 20, top + 44, '', {
      fontFamily: FONTS.body,
      fontSize: '19px',
      fontStyle: 'italic',
      color: '#f2f6ff',
      lineSpacing: 6,
      wordWrap: { width: detailW - 40 },
    });
    const loreHead = this.add.text(detailX, top + 270, 'WHAT WE KNOW', {
      fontFamily: FONTS.body,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#7fffe5',
    });
    this.pageLore = this.add.text(detailX, top + 290, '', {
      fontFamily: FONTS.body,
      fontSize: '12px',
      color: '#9fb0cc',
      lineSpacing: 3,
      wordWrap: { width: detailW },
    });
    this.pagesGroup.add([this.pageCount, this.pageTitle, this.pageBody, loreHead, this.pageLore]);
    this.refreshPages();
  }

  private refreshPages(): void {
    const top = 92;
    const listX = 40;
    const listW = 250;
    const rowH = 44;
    let found = 0;
    JOURNAL_PAGES.forEach((page, index) => {
      const row = this.pageRows[index];
      if (!row) return;
      row.found = Game.state.getFlag(page.flag);
      if (row.found) found++;
      const y = top + index * rowH;
      const selected = index === this.pageCursor;
      const g = row.bg;
      g.clear();
      if (row.found) {
        g.fillStyle(selected ? 0x2a3a64 : 0x18213b, 0.95);
        g.fillRoundedRect(listX, y, listW, rowH - 6, 6);
        g.lineStyle(selected ? 2 : 1, selected ? 0xffd60a : 0x3d5480, 0.9);
        g.strokeRoundedRect(listX, y, listW, rowH - 6, 6);
        g.fillStyle(0xf1e4be, 1);
        g.fillRect(listX + 12, y + 8, 22, 24);
        g.fillStyle(0x7a6a44, 1);
        for (let l = 0; l < 4; l++) g.fillRect(listX + 15, y + 12 + l * 5, 16, 1);
      } else {
        // Torn placeholder: a jagged strip of paper.
        const edge = tornEdge(index, 10);
        g.fillStyle(selected ? 0x2a2f44 : 0x161c2e, 0.95);
        g.beginPath();
        g.moveTo(listX, y);
        edge.forEach((e, i) => g.lineTo(listX + (i / 10) * listW, y + e));
        g.lineTo(listX + listW, y + rowH - 6);
        for (let i = 10; i >= 0; i--) g.lineTo(listX + (i / 10) * listW, y + rowH - 6 - edge[10 - i] * 0.8);
        g.closePath();
        g.fillPath();
        g.lineStyle(selected ? 2 : 1, selected ? 0xffd60a : 0x36445f, 0.9);
        g.strokePath();
        g.fillStyle(0x4a4f63, 1);
        g.fillTriangle(listX + 12, y + 32, listX + 34, y + 30, listX + 22, y + 10);
      }
      row.label.setText(row.found ? PAGE_LABELS[index] : 'Torn page');
      row.label.setColor(row.found ? (selected ? '#ffd60a' : '#dce6f7') : '#6d7d99');
    });
    this.pageCount.setText(`${found}/${JOURNAL_PAGES.length} pages found`);

    const page = JOURNAL_PAGES[this.pageCursor];
    const open = page && Game.state.getFlag(page.flag);
    this.pageTitle.setText(open ? `${PAGE_LABELS[this.pageCursor]} — Edda’s journal` : 'A torn page');
    this.pageBody.setText(
      open
        ? `“${page.text}”`
        : 'The paper is ripped away here. Something in Prismara is still holding this page.',
    );
    this.pageBody.setColor(open ? '#f2f6ff' : '#6d7d99');
    const lore = knownLore(Game.state).slice(-4);
    this.pageLore.setText(lore.length ? lore.map((l) => '• ' + l).join('\n') : 'Nothing yet. Keep exploring.');
  }

  private setPageCursor(index: number): void {
    if (index === this.pageCursor) return;
    this.pageCursor = index;
    this.refreshPages();
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
    this.pagesGroup.setVisible(this.tab === 'pages');
    if (this.tab === 'pages') this.refreshPages();
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
      } else if (this.tab === 'pages') {
        this.setPageCursor((this.pageCursor + vertical + JOURNAL_PAGES.length) % JOURNAL_PAGES.length);
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
