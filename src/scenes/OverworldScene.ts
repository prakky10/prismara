/**
 * The overworld: map rendering, grid movement, NPCs, dialogue, encounters,
 * warps, the day/night grade and every story trigger.
 *
 * The scene stays alive while menus and battles are open (they are launched on
 * top and this scene is paused), so returning from a battle costs nothing.
 */

import Phaser from 'phaser';
import { SCENES } from './keys';
import { COLORS, DEPTHS, FONTS } from '../ui/Theme';
import { InputManager } from '../core/InputManager';
import { TextBox } from '../ui/TextBox';
import { Audio } from '../audio/AudioManager';
import { Game } from '../world/GameContext';
import { tileNameFor, type Facing, type MapDef, type NpcDef } from '../world/maps';
import { requireMap } from '../world/maps';
import {
  TILE_INDEX,
  TILE_SIZE,
  TILE_SPECS,
  paintTileset,
  type TileName,
} from '../render/tiles/TilePainter';
import { autotile } from '../render/tiles/autotiler';
import { paintActor, frameFor, stepCycle, ACTOR_H, type Direction } from '../render/actors/ActorPainter';
import { getEncounterZone, rollEncounter } from '../world/encounters';
import { random } from '../core/SeededRNG';
import { tickClock, timeOfDay } from '../core/Time';
import { autosave } from '../core/SaveManager';
import { banner, toast } from '../ui/Popups';
import { buildRivalParty, getTrainer, rivalDialogue, type TrainerDef } from '../world/trainers';
import { isFainted } from '../battle/Creature';
import { World3D, type WorldActor } from '../render/three/World3D';
import { ThreeSurface } from '../render/three/ThreeSurface';
import { finaleLines, storyForMap, TROPHIES, trialLockedReason } from '../world/campaign';
import {
  altarEventAt,
  canWalkTo,
  facingTile,
  hasFieldAbility,
  inSightLine,
  lineOfSightClear,
  rivalTriggerAt,
  whiteOutDestination,
  type FieldAbility,
} from '../world/fieldRules';
import { OverworldHud } from './overworld/OverworldHud';

const SCALE = 3;
const TILE = TILE_SIZE * SCALE;
const MOVE_MS = 200;
const RUN_MS = 120;

interface Actor {
  def: NpcDef;
  sprite: Phaser.GameObjects.Sprite;
  defeated: boolean;
  hidden: boolean;
}

export class OverworldScene extends Phaser.Scene {
  private controls!: InputManager;
  private map!: MapDef;
  private grid: TileName[][] = [];
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private player!: Phaser.GameObjects.Sprite;
  private playerTile = { x: 0, y: 0 };
  private facing: Direction = 'down';
  private moving = false;
  private stepIndex = 0;
  private actors: Actor[] = [];
  private textbox!: TextBox;
  private encounterLock = 0;
  private dialogueActive = false;
  private ambient?: Phaser.GameObjects.Particles.ParticleEmitter;
  private world3d?: World3D;
  private hud!: OverworldHud;
  private touchHintShown = false;
  private running = false;

  private readonly onBattleFinishedEvent = (): void => this.onBattleFinished();
  private readonly onSettingsAppliedEvent = (): void => this.applySettings();
  private readonly onShopClosedEvent = (): void => {
    this.encounterLock = 0;
  };
  private readonly onWakeEvent = (): void => {
    this.encounterLock = 6;
    this.updateHud();
  };
  private readonly onPointerDownEvent = (): void => {
    if (this.dialogueActive && !this.moving) this.textbox.advance();
  };
  private readonly onShutdownEvent = (): void => {
    this.events.off('battle-finished', this.onBattleFinishedEvent);
    this.events.off('settings-applied', this.onSettingsAppliedEvent);
    this.events.off('shop-closed', this.onShopClosedEvent);
    this.events.off(Phaser.Scenes.Events.WAKE, this.onWakeEvent);
    this.events.off(Phaser.Scenes.Events.RESUME, this.onWakeEvent);
    this.input.off('pointerdown', this.onPointerDownEvent);
  };

  constructor() {
    super(SCENES.overworld);
  }

  create(): void {
    this.controls = new InputManager(this);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    this.actors = [];
    this.moving = false;
    this.running = false;
    this.dialogueActive = false;
    this.encounterLock = 6;
    this.touchHintShown = false;
    this.stepIndex = 0;
    this.ambient = undefined;

    this.map = requireMap(Game.state.position.mapId);
    this.buildTilemap();
    this.buildPlayer();
    this.buildActors();
    this.buildUi();
    this.buildWorld3D();

    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    this.cameras.main.setBounds(0, 0, this.map.width * TILE, this.map.height * TILE);
    this.cameras.main.setZoom(1);
    this.physics?.world?.setBounds?.(0, 0, this.map.width * TILE, this.map.height * TILE);

    // Named callbacks so a scene restart cannot stack duplicates on the shared
    // emitter; they are removed again on shutdown.
    this.events.on('battle-finished', this.onBattleFinishedEvent);
    this.events.on('settings-applied', this.onSettingsAppliedEvent);
    this.events.on('shop-closed', this.onShopClosedEvent);
    this.input.on('pointerdown', this.onPointerDownEvent);

    Audio.playMusic(this.map.music ?? this.musicForMap());
    this.hud.showAreaBanner();
    this.applySettings();
    this.updateHud();

    this.events.on(Phaser.Scenes.Events.WAKE, this.onWakeEvent);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onWakeEvent);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdownEvent);

    // Map stories play once, after the area banner; evolutions, trophies, the
    // battle outcome and the finale resume once it finishes.
    this.running = true;
    this.time.delayedCall(760, () => {
      this.running = false;
      const pages = storyForMap(Game.state, this.map.id);
      if (pages && !this.dialogueActive) {
        this.say(pages, () => this.resumeAfterStory());
      } else {
        this.resumeAfterStory();
      }
    });
  }

  /* ----------------------------------------------------------- rendering -- */

  private buildTilemap(): void {
    const textureKey = paintTileset(this, this.map.biome);

    // Character grid -> tile names -> autotiled tile names -> indices.
    const named: TileName[][] = this.map.tiles.map((row) =>
      [...row].map((char) => tileNameFor(char, this.map.biome)),
    );
    this.grid = autotile(named, this.map.id.length);
    const data = this.grid.map((row) => row.map((name) => TILE_INDEX[name] ?? 0));

    const tilemap = this.make.tilemap({
      data,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = tilemap.addTilesetImage('tiles', textureKey, TILE_SIZE, TILE_SIZE);
    if (!tileset) return;

    this.layer = tilemap.createLayer(0, tileset, 0, 0)!;
    this.layer.setScale(SCALE);
    this.layer.setDepth(DEPTHS.tiles);
    this.layer.setVisible(false);
    // Crisp pixels for the tileset only; creatures keep their smooth filtering.
    const texture = this.textures.get(textureKey);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  private buildPlayer(): void {
    const state = Game.state;
    const style = { shirt: 0xff6b35, hair: 0x2a1a12, skin: 0xf0c8a0 };
    const key = paintActor(this, 'player', style);
    this.player = this.add.sprite(0, 0, key, frameFor(state.position.facing as Direction, 0));
    this.player.setOrigin(0.5, 1);
    this.player.setScale(SCALE);
    this.player.setDepth(DEPTHS.actors);
    this.player.setVisible(false);
    this.playerTile = { x: state.position.x, y: state.position.y };
    this.facing = (state.position.facing as Direction) ?? 'down';
    this.placePlayer();
  }

  private placePlayer(): void {
    this.player.setPosition(
      this.playerTile.x * TILE + TILE / 2,
      this.playerTile.y * TILE + TILE,
    );
    this.player.setFrame(frameFor(this.facing, 0));
  }

  private buildActors(): void {
    for (const def of this.map.npcs) {
      if (def.hideWhenFlag && Game.state.getFlag(def.hideWhenFlag)) continue;
      if (def.showWhenFlag && !Game.state.getFlag(def.showWhenFlag)) continue;

      const key = paintActor(this, def.id, def.sprite);
      const sprite = this.add.sprite(
        def.x * TILE + TILE / 2,
        def.y * TILE + TILE,
        key,
        frameFor(def.facing as Direction, 0),
      );
      sprite.setOrigin(0.5, 1).setScale(SCALE).setDepth(DEPTHS.actors - 1);
      sprite.setVisible(false);

      const actor: Actor = {
        def,
        sprite,
        defeated: this.isTrainerDefeated(def),
        hidden: false,
      };
      this.actors.push(actor);

      // Idle bob so the world feels alive.
      this.tweens.add({
        targets: sprite,
        y: sprite.y - 1.5,
        duration: 1700 + random.int(0, 400),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private isTrainerDefeated(def: NpcDef): boolean {
    if (!def.trainerId) return false;
    const trainer = getTrainer(def.trainerId);
    if (!trainer) return false;
    if (trainer.setsFlag && Game.state.getFlag(trainer.setsFlag)) return true;
    return Game.state.getFlag(`defeated-${def.trainerId}`);
  }

  private buildUi(): void {
    this.textbox = new TextBox(this);
    this.textbox.setScrollFactor(0);
    this.hud = new OverworldHud(this, this.map);
  }

  private buildWorld3D(): void {
    const view = new World3D(this.map, Game.settings.reducedEffects);
    this.world3d = view;
    new ThreeSurface(
      this,
      view.scene,
      view.camera,
      (seconds) => this.world3d?.sync(this.playerDto(), this.npcDtos(), seconds),
      () => {
        this.world3d?.dispose();
        this.world3d = undefined;
      },
    );
  }

  private playerDto(): WorldActor {
    return {
      id: 'player',
      x: this.player.x / TILE - 0.5,
      y: this.player.y / TILE - 1,
      facing: this.facing as Facing,
      style: { shirt: 0xff6b35, hair: 0x2a1a12, skin: 0xf0c8a0 },
      kind: 'player',
    };
  }

  private npcDtos(): WorldActor[] {
    return this.actors.map((actor) => ({
      id: actor.def.id,
      x: actor.sprite.x / TILE - 0.5,
      y: actor.sprite.y / TILE - 1,
      facing: actor.def.facing,
      hidden: actor.hidden,
      style: actor.def.sprite,
      kind: actor.def.kind,
    }));
  }

  private applySettings(): void {
    const settings = Game.settings;
    if (this.ambient) {
      this.ambient.setVisible(!settings.reducedEffects);
    }
  }

  private musicForMap(): string {
    switch (this.map.biome) {
      case 'forest':
        return 'forest';
      case 'city':
        return 'city';
      case 'beach':
        return 'beach';
      case 'volcano':
        return 'volcano';
      case 'cave':
        return 'cave';
      case 'ruins':
        return 'ruins';
      case 'summit':
        return 'summit';
      default:
        return timeOfDay(Game.state.clock) === 'night' ? 'forest' : 'route';
    }
  }

  private updateHud(): void {
    this.hud.update();
  }

  /* ------------------------------------------------------------ movement -- */

  private canWalkTo(x: number, y: number): boolean {
    // NPCs block their tile.
    return canWalkTo(
      this.map,
      this.grid,
      x,
      y,
      (ability) => this.hasFieldAbility(ability),
      (tx, ty) => this.actors.some((actor) => !actor.hidden && actor.def.x === tx && actor.def.y === ty),
    );
  }

  private hasFieldAbility(ability: FieldAbility): boolean {
    return hasFieldAbility(Game.state, ability);
  }

  private tryMove(dx: number, dy: number, running: boolean): void {
    if (this.moving || this.dialogueActive || this.running) return;

    const targetX = this.playerTile.x + dx;
    const targetY = this.playerTile.y + dy;
    const direction: Direction = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';

    if (this.facing !== direction) {
      this.facing = direction;
      this.player.setFrame(frameFor(direction, 0));
    }

    // Ledge hop: moving down onto a ledge is one-way, and the player lands on
    // the row two tiles down — the sprite and the tile must move together.
    const tileBelow = this.grid[this.playerTile.y + 1]?.[targetX];
    const hopping = dy > 0 && tileBelow === 'ledge';
    const landingY = hopping ? this.playerTile.y + 2 : targetY;

    if (!this.canWalkTo(targetX, landingY)) {
      Audio.playSfx('denied', 1.4);
      return;
    }

    this.moving = true;
    this.stepIndex = (this.stepIndex + 1) % 4;
    this.player.setFrame(frameFor(direction, stepCycle(this.stepIndex)));

    const duration = hopping ? MOVE_MS * 1.7 : running ? RUN_MS : MOVE_MS;
    const targetWorldY = this.player.y + (hopping ? TILE * 2 : dy * TILE);

    this.tweens.add({
      targets: this.player,
      x: this.player.x + dx * TILE,
      y: targetWorldY,
      duration,
      ease: hopping ? 'Quad.easeIn' : 'Linear',
      onComplete: () => {
        this.moving = false;
        this.playerTile = { x: targetX, y: landingY };
        this.player.setFrame(frameFor(direction, 0));
        this.onStepComplete(running);
      },
    });

    if (!running && !hopping) {
      // Footstep every other tile keeps the audio busy without being noisy.
      if (this.stepIndex % 2 === 0) Audio.playSfx('step', 0.9 + (this.stepIndex % 3) * 0.1);
    }

  }

  private onStepComplete(running: boolean): void {
    Game.state.registerStep(running ? 2 : 1);
    Game.state.position = {
      mapId: this.map.id,
      x: this.playerTile.x,
      y: this.playerTile.y,
      facing: this.facing,
    };

    if (this.checkWarp()) return;

    this.checkStoryTiles();
    if (this.dialogueActive || this.running) return;

    // No encounters for the first six completed steps.
    if (this.encounterLock > 0) this.encounterLock -= 1;
    else this.checkEncounter(running);
    if (this.dialogueActive || this.running) return;

    this.checkTrainerSight();
  }

  /* --------------------------------------------------------------- warps -- */

  private checkWarp(): boolean {
    for (const warp of this.map.warps) {
      const w = warp.width ?? 1;
      const h = warp.height ?? 1;
      const inside =
        this.playerTile.x >= warp.x &&
        this.playerTile.x < warp.x + w &&
        this.playerTile.y >= warp.y &&
        this.playerTile.y < warp.y + h;
      if (!inside) continue;

      if (warp.requires && !this.hasFieldAbility(warp.requires)) {
        this.say([warp.lockedMessage ?? 'You need a field ability to go that way.']);
        return true;
      }

      this.running = true;
      this.travelTo(warp.to.mapId, warp.to.x, warp.to.y, warp.to.facing);
      return true;
    }
    return false;
  }

  private travelTo(mapId: string, x: number, y: number, facing?: Facing): void {
    Game.state.position = { mapId, x, y, facing: facing ?? 'down' };
    Audio.playSfx('door');
    this.cameras.main.fadeOut(220, 5, 7, 15);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop();
      this.scene.start(SCENES.overworld);
    });
  }

  /* ----------------------------------------------------------- encounters -- */

  private checkEncounter(running: boolean): void {
    const tile = this.grid[this.playerTile.y]?.[this.playerTile.x];
    if (!tile) return;
    const spec = TILE_SPECS[tile];
    if (!spec?.encounter) return;

    const zone = getEncounterZone(this.map.encounterZone ?? '');
    if (!zone) return;

    const rate = zone.rate * (running ? 1.25 : 1);
    if (!random.chance(rate)) return;

    const wild = rollEncounter(zone, timeOfDay(Game.state.clock), random);
    if (!wild) return;

    // A small chance for the encounter to be a shiny.
    const shiny = random.chance(1 / 256);

    this.encounterLock = 6;
    this.startWildBattle(wild.speciesId, wild.level, shiny);
  }

  private startWildBattle(speciesId: string, level: number, shiny: boolean): void {
    Audio.playSfx('encounter');
    this.running = true;
    Game.pendingBattle = { kind: 'wild', speciesId, level, shiny };
    // Stash the built creature so the battle uses the exact same instance.
    Game.pendingWildCreature = Game.createWild(speciesId, level, shiny);
    Game.returnPosition = { ...Game.state.position };

    this.cameras.main.flash(220, 255, 255, 255);
    this.cameras.main.shake(200, 0.006);
    this.time.delayedCall(260, () => {
      this.scene.pause();
      this.scene.launch(SCENES.battle);
    });
  }

  /* ----------------------------------------------------------- trainers -- */

  private checkTrainerSight(): void {
    if (this.dialogueActive || this.running) return;
    for (const actor of this.actors) {
      if (actor.hidden || (actor.def.kind !== 'trainer' && actor.def.kind !== 'trial')) continue;
      if (actor.def.kind === 'trainer' && actor.def.sight === undefined) continue;
      const sight = actor.def.sight ?? 0;
      if (sight <= 0) continue;
      if (actor.def.kind === 'trainer' && actor.def.trainerId && this.isTrainerDefeated(actor.def)) {
        continue;
      }
      if (this.isTrainerDefeated(actor.def)) continue;

      if (!inSightLine(actor.def, sight, this.playerTile)) continue;

      // Clear line of sight (no solid tiles between).
      if (!lineOfSightClear(this.grid, actor.def.x, actor.def.y, this.playerTile.x, this.playerTile.y)) {
        continue;
      }

      const sightTrainer = actor.def.trainerId ? getTrainer(actor.def.trainerId) : undefined;
      if (sightTrainer?.requiresFlag && !Game.state.getFlag(sightTrainer.requiresFlag)) continue;
      if (actor.def.kind === 'trial' && sightTrainer && trialLockedReason(Game.state, sightTrainer.id)) {
        continue;
      }

      Audio.playSfx('encounter');
      const alert = this.add
        .text(actor.sprite.x, actor.sprite.y - ACTOR_H * SCALE, '!', {
          fontFamily: FONTS.body,
          fontSize: '20px',
          color: '#ffd60a',
          fontStyle: 'bold',
          stroke: '#0b1020',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(DEPTHS.overlay);
      this.tweens.add({ targets: alert, y: alert.y - 8, alpha: 0, duration: 700 });

      this.startTrainerBattle(actor);
      return;
    }
  }

  private startTrainerBattle(actor: Actor): void {
    const def = actor.def;

    // The rival is generated at battle time.
    if (def.id.startsWith('rival_')) {
      this.startRivalBattle(Number(def.id.split('_')[1] ?? 1));
      return;
    }

    const trainer = def.trainerId ? getTrainer(def.trainerId) : undefined;
    if (!trainer) return;
    if (trainer.requiresFlag && !Game.state.getFlag(trainer.requiresFlag)) return;
    if (def.kind === 'trial' && trialLockedReason(Game.state, trainer.id)) return;

    this.running = true;
    Game.pendingBattle = { kind: 'trainer', trainer, trainerName: trainer.name };
    Game.returnPosition = { ...Game.state.position };

    this.say(trainer.dialogue.intro, () => {
      this.launchBattle();
    });
  }

  private startRivalBattle(index: number): void {
    const starter = Game.state.starterChosen;
    if (!starter) return;
    const party = buildRivalParty(index, starter);
    const dialogue = rivalDialogue(index, Game.state.playerName, starter);
    const trainer: TrainerDef = {
      id: `rival-${index}`,
      name: Game.state.rivalName,
      trainerClass: 'Rival',
      tier: index >= 3 ? 'master' : 'trainer',
      party,
      purse: 200 * index,
      color: 0x8e5cff,
      dialogue,
      setsFlag: `rival-${index}-defeated`,
    };
    this.running = true;
    Game.pendingBattle = { kind: 'trainer', trainer, trainerName: trainer.name, isRival: true };
    Game.returnPosition = { ...Game.state.position };

    this.say(dialogue.intro, () => this.launchBattle());
  }

  private launchBattle(): void {
    this.scene.pause();
    this.scene.launch(SCENES.battle);
  }

  /* ---------------------------------------------------------- interaction -- */

  private interact(): void {
    if (this.dialogueActive || this.running) return;

    const facingTile = this.facingTile();
    const actor = this.actors.find(
      (a) => !a.hidden && a.def.x === facingTile.x && a.def.y === facingTile.y,
    );
    if (actor) {
      this.talkTo(actor);
      return;
    }

    // Signs are tiles rather than actors in some maps.
    const tile = this.grid[facingTile.y]?.[facingTile.x];
    if (tile === 'sign') {
      const sign = this.map.npcs.find(
        (n) => n.kind === 'sign' && n.x === facingTile.x && n.y === facingTile.y,
      );
      this.say(sign?.dialogue ?? ['The sign is weathered and unreadable.']);
      return;
    }

    this.checkAltarInteraction();
  }

  private facingTile(): { x: number; y: number } {
    return facingTile(this.playerTile, this.facing as Facing);
  }

  private talkTo(actor: Actor): void {
    const def = actor.def;

    // Face the player.
    const dir: Direction =
      def.x < this.playerTile.x ? 'right' : def.x > this.playerTile.x ? 'left' : def.y < this.playerTile.y ? 'down' : 'up';
    actor.sprite.setFrame(frameFor(dir, 0));

    switch (def.kind) {
      case 'heal':
        this.say(def.dialogue ?? ['Welcome!'], () => this.healParty());
        break;
      case 'shop':
        this.say(def.dialogue ?? ['Welcome!'], () => {
          this.scene.pause();
          this.scene.launch(SCENES.shop);
        });
        break;
      case 'trainer':
      case 'trial': {
        if (this.isTrainerDefeated(def)) {
          const trainer = def.trainerId ? getTrainer(def.trainerId) : undefined;
          this.say(trainer?.dialogue.after ?? ['Good battle!']);
          return;
        }
        const trainer = def.trainerId ? getTrainer(def.trainerId) : undefined;
        if (!trainer) return;
        if (trainer.requiresFlag && !Game.state.getFlag(trainer.requiresFlag)) {
          this.say(['Come back when you are ready.']);
          return;
        }
        if (def.kind === 'trial') {
          const lock = trialLockedReason(Game.state, trainer.id);
          if (lock) {
            this.say([lock]);
            return;
          }
        }
        this.running = true;
        Game.pendingBattle = { kind: 'trainer', trainer, trainerName: trainer.name };
        Game.returnPosition = { ...Game.state.position };
        this.say(trainer.dialogue.intro, () => this.launchBattle());
        break;
      }
      case 'sign':
        this.say(def.dialogue ?? ['...']);
        break;
      default: {
        const lines = def.chatter ?? def.dialogue ?? ['...'];
        const line = lines[random.int(0, lines.length - 1)] ?? '...';
        this.say([line]);
        break;
      }
    }
  }

  private healParty(): void {
    const hadFainted = Game.state.party.some((c) => isFainted(c));
    Game.state.healParty();
    Audio.playSfx('heal');
    const nurse = this.actors.find((a) => a.def.kind === 'heal');
    void nurse;
    this.say(
      hadFainted
        ? ['Your creatures are fighting fit again!', 'Come back any time.']
        : ['Your creatures are already in perfect health.'],
    );
    autosave(Game.state);
  }

  /* --------------------------------------------------------------- altars -- */

  private checkAltarInteraction(): void {
    const event = altarEventAt(Game.state, this.map, this.playerTile);

    if (event.kind === 'legendary') {
      this.say(event.lines, () => this.startLegendaryBattle(event.speciesId, event.level, event.flag));
      return;
    }

    // The Champion — only once the main story has actually unlocked the challenge.
    if (event.kind === 'champion') {
      const lock = trialLockedReason(Game.state, 'champion-aurelia');
      if (lock) {
        this.say([lock]);
        return;
      }
      this.say(['Aurelia waits at the summit.'], () => {
        const champion = getTrainer('champion-aurelia');
        if (!champion) return;
        this.running = true;
        Game.pendingBattle = { kind: 'trainer', trainer: champion, trainerName: 'Champion Aurelia' };
        Game.returnPosition = { ...Game.state.position };
        this.launchBattle();
      });
      return;
    }

    this.say(['There is nothing here.']);
  }

  private startLegendaryBattle(speciesId: string, level: number, flag: string): void {
    void flag;
    this.running = true;
    Audio.playMusic('battle-legendary');
    Game.pendingBattle = { kind: 'wild', speciesId, level, shiny: false };
    Game.pendingWildCreature = Game.createWild(speciesId, level, false);
    Game.returnPosition = { ...Game.state.position };
    this.launchBattle();
  }

  /* --------------------------------------------------------------- story -- */

  private checkStoryTiles(): void {
    if (this.dialogueActive || this.running) return;
    const rival = rivalTriggerAt(Game.state, this.map.id, this.playerTile);
    if (rival !== null) this.startRivalBattle(rival);
  }

  /* ------------------------------------------------------------ dialogue -- */

  private say(lines: string[], onDone?: () => void): void {
    if (this.dialogueActive) return;
    this.dialogueActive = true;
    this.textbox.show(lines, () => {
      this.dialogueActive = false;
      onDone?.();
    });
  }

  /* ------------------------------------------------------------- battle end -- */

  private onBattleFinished(): void {
    // Returning from a battle must clear the busy flag, or movement stays stuck.
    this.running = false;
    this.encounterLock = 6;
    this.updateHud();
    this.refreshActors();

    // Evolutions queued by the battle run first; Game.lastOutcome is kept so the
    // outcome is never discarded while the chain is still going.
    if (this.chainEvolution()) return;

    this.celebrateTrophies(() => this.resolveBattleOutcome());
  }

  /**
   * Launch one queued evolution, if any. The evolution scene restarts this
   * scene when it ends, so create() resumes the chain until none are left.
   * Returns true when a cinematic was launched (this scene stays paused for it).
   */
  private chainEvolution(): boolean {
    while (Game.pendingEvolutions.length > 0) {
      const uid = Game.pendingEvolutions.shift()!;
      const creature = Game.state.party.find((c) => c.uid === uid);
      const into = creature?.pendingEvolution;
      if (!into) continue;
      this.scene.pause();
      this.scene.launch(SCENES.evolution, { uid, into });
      return true;
    }
    return false;
  }

  /** Resume the post-story flow: evolutions, trophies, outcome, then finale. */
  private resumeAfterStory(): void {
    if (this.chainEvolution()) return;
    this.celebrateTrophies(() => this.resolveBattleOutcome());
  }

  /**
   * Celebrate every Trophy that has been earned but not yet shown, each exactly
   * once. The flag and the reward are recorded before the dialogue so a reload
   * cannot hand out the reward twice.
   */
  private celebrateTrophies(onDone: () => void): void {
    const pending = TROPHIES.filter(
      (trophy) =>
        Game.state.hasSigil(trophy.id) &&
        !Game.state.getFlag(`trophy-celebrated-${trophy.id}`),
    );

    const next = (index: number): void => {
      const trophy = pending[index];
      if (!trophy) {
        onDone();
        return;
      }
      Game.state.setFlag(`trophy-celebrated-${trophy.id}`);
      Game.state.addItem(trophy.reward, 3);
      autosave(Game.state);
      banner(this, trophy.name, trophy.color, 1800);
      this.say(
        [
          `${trophy.name} - ${trophy.virtue}`,
          trophy.memory,
          `${trophy.keeper} gives you 3 of the Trophy's signature items.`,
        ],
        () => next(index + 1),
      );
    };

    next(0);
  }

  /** Handle the last battle's outcome, if any, then schedule the finale. */
  private resolveBattleOutcome(): void {
    const outcome = Game.lastOutcome;
    Game.lastOutcome = null;

    if (!outcome) {
      this.scheduleFinale();
      return;
    }

    if (outcome.reason === 'faint' && outcome.winner === 'enemy') {
      // A white-out: return to the last Healing Center, fully healed.
      this.say(
        ['You have no creatures left...', 'You scrambled back to safety.'],
        () => this.whiteOut(),
      );
      return;
    }

    autosave(Game.state);
    this.scheduleFinale();
  }

  /**
   * The finale plays once, after the Champion falls: the finale lines, then the
   * single Master Prism reward. story-finale-seen guards it and is set before the
   * dialogue so it cannot replay.
   */
  private scheduleFinale(): void {
    if (!Game.state.getFlag('champion-defeated')) return;
    if (Game.state.getFlag('story-finale-seen')) return;
    Game.state.setFlag('story-finale-seen');
    this.say(finaleLines(Game.state), () => {
      Game.state.addItem('master-prism', 1);
      autosave(Game.state);
      this.say(['The last beacon burns again: a Master Prism is yours.']);
    });
  }

  private whiteOut(): void {
    Game.state.healParty();
    const home = whiteOutDestination(Game.state);
    Game.state.position = { mapId: home.mapId, x: home.x, y: home.y, facing: 'down' };
    Audio.playSfx('warp');
    this.cameras.main.fadeOut(400, 5, 7, 15);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop();
      this.scene.start(SCENES.overworld);
    });
  }

  private refreshActors(): void {
    // Hide defeated trainers' "!" and update their sprites' state.
    for (const actor of this.actors) {
      actor.defeated = this.isTrainerDefeated(actor.def);
    }
  }

  /* ------------------------------------------------------------- update -- */

  override update(time: number, delta: number): void {
    this.controls.update();

    // Clock and playtime advance with real time.
    tickClock(Game.state.clock, delta);
    Game.state.playtimeMinutes += delta / 60000;
    this.hud.applyDayNightGrade();
    if (Math.floor(time / 1000) % 5 === 0) this.updateHud();

    if (this.dialogueActive) {
      if (this.controls.justPressed('confirm') || this.controls.justPressed('cancel')) {
        this.textbox.advance();
      }
      return;
    }

    if (!this.running && this.controls.justPressed('menu')) {
      Audio.playSfx('select');
      this.scene.pause();
      this.scene.launch(SCENES.pause);
      return;
    }

    if (this.controls.justPressed('confirm') || this.controls.justPressed('interact')) {
      this.interact();
      return;
    }

    const running = this.controls.isDown('run');
    if (this.controls.isDown('up')) this.tryMove(0, -1, running);
    else if (this.controls.isDown('down')) this.tryMove(0, 1, running);
    else if (this.controls.isDown('left')) this.tryMove(-1, 0, running);
    else if (this.controls.isDown('right')) this.tryMove(1, 0, running);

    if (!this.touchHintShown && Game.settings.showTouchControls) {
      this.touchHintShown = true;
      toast(this, 'Use the on-screen controls to move.', COLORS.panelGlow);
    }
  }
}
