import * as THREE from 'three';
import { getSpecies } from '../../data/creatures';
import type { CreatureSpecies } from '../../data/creatures';
import { Sculptor } from './creatures/sculptor';
import { buildSkin, isLegend, sparkles } from './creatures/parts';
import type { Skin } from './creatures/parts';
import { buildBiped, buildDrizzlet, buildEmberkit, buildQuadruped, buildSproutle } from './creatures/bodies';
import { buildBird, buildBug, buildCrustacean, buildFloater, buildMoth, buildMole, buildSerpent } from './creatures/bodies2';

export type CreatureMood = 'idle' | 'attack' | 'hurt' | 'faint' | 'celebrate';

export interface CreatureModel {
  root: THREE.Group;
  update(seconds: number, mood?: CreatureMood): void;
  dispose(): void;
}

/** Glowing ground ring and floating shards that make legendaries read as special. */
function legendAura(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  const s = sc.sway;
  sc.ring(s, 0, 0.04, 0, 1.05, 0.03, skin.halo, Math.PI / 2, 0);
  sc.ring(s, 0, 0.05, 0, 1.3, 0.016, skin.halo, Math.PI / 2, 0);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const h = 0.6 + (i % 3) * 0.5;
    sc.gem(s, Math.cos(a) * 1.05, h, Math.sin(a) * 0.9, 0.05, 0.22 + (i % 2) * 0.1, skin.gem, [0.2 * Math.sin(a), 0, 0.3 * Math.cos(a)]);
  }
  if (sp.element === 'shadow') for (let i = 0; i < 4; i++) sc.ball(s, Math.cos(i * 1.6) * 1.0, 0.5 + i * 0.35, Math.sin(i * 1.6) * 0.8, 0.07, skin.wisp);
}

function buildByPlan(sc: Sculptor, sp: CreatureSpecies, skin: Skin): void {
  if (sp.id === 'emberkit') buildEmberkit(sc, sp, skin);
  else if (sp.id === 'drizzlet') buildDrizzlet(sc, sp, skin);
  else if (sp.id === 'sproutle') buildSproutle(sc, sp, skin);
  else {
    switch (sp.body) {
      case 'quadruped':
        buildQuadruped(sc, sp, skin);
        break;
      case 'biped':
        buildBiped(sc, sp, skin);
        break;
      case 'bird':
        buildBird(sc, sp, skin);
        break;
      case 'serpent':
        buildSerpent(sc, sp, skin);
        break;
      case 'floater':
        buildFloater(sc, sp, skin);
        break;
      case 'bug':
        buildBug(sc, sp, skin);
        break;
      case 'mole':
        buildMole(sc, sp, skin);
        break;
      case 'crustacean':
        buildCrustacean(sc, sp, skin);
        break;
      default:
        buildMoth(sc, sp, skin);
    }
  }
  if (isLegend(sp)) legendAura(sc, sp, skin);
}

function animate(sc: Sculptor, seconds: number, mood: CreatureMood): void {
  const t = Number.isFinite(seconds) ? seconds : 0;
  const b = sc.sway;
  let bob = Math.sin(t * 2.1) * 0.035;
  let yaw = Math.sin(t * 0.9) * 0.035;
  let lunge = 0;
  let pitch = 0;
  let roll = 0;
  let scale = 1;
  let headPitch = Math.sin(t * 2.1 + 0.7) * 0.06;
  let tailAmp = 0.26;
  let tailSpeed = 1.6;
  let wingAmp = 0.16;
  let wingSpeed = 5;
  let wingBias = 0;
  let legAmp = 0.04;
  let armAmp = 0.06;
  if (mood === 'attack') {
    const a = (Math.sin(t * 7) + 1) * 0.5;
    lunge = a * 0.22;
    bob += a * 0.05;
    pitch = -0.18 * a;
    headPitch = -0.3 - a * 0.2;
    tailAmp = 0.5;
    tailSpeed = 9;
    wingAmp = 0.6;
    wingSpeed = 14;
    legAmp = 0.14;
    armAmp = 0.4;
  } else if (mood === 'hurt') {
    lunge = -0.16;
    pitch = 0.22;
    roll = Math.sin(t * 24) * 0.06;
    headPitch = 0.3;
    tailAmp = 0.14;
    tailSpeed = 16;
    wingAmp = 0.08;
    wingSpeed = 18;
    legAmp = 0.02;
    armAmp = 0.03;
  } else if (mood === 'faint') {
    roll = 1.3;
    bob = -0.24;
    scale = 0.88;
    headPitch = 0.5;
    tailAmp = 0.06;
    tailSpeed = 1.2;
    wingBias = 0.55;
    wingAmp = 0.03;
    legAmp = 0.01;
    armAmp = 0.01;
  } else if (mood === 'celebrate') {
    const hop = Math.abs(Math.sin(t * 5.4));
    bob = hop * 0.3;
    yaw = Math.sin(t * 3.2) * 0.34;
    pitch = -hop * 0.1;
    headPitch = -0.22 - hop * 0.12;
    tailAmp = 0.5;
    tailSpeed = 8;
    wingAmp = 0.75;
    wingSpeed = 12;
    legAmp = 0.1;
    armAmp = 0.5;
  }
  b.position.set(0, bob, lunge);
  b.rotation.set(pitch, yaw, roll);
  b.scale.setScalar(scale * sc.baseScale);
  for (let i = 0; i < sc.heads.length; i++) sc.heads[i].rotation.x = headPitch;
  for (let i = 0; i < sc.tails.length; i++) {
    sc.tails[i].rotation.y = Math.sin(t * tailSpeed + i * 0.7) * tailAmp * (1 + i * 0.2);
    sc.tails[i].rotation.x = Math.sin(t * tailSpeed * 0.7 + i) * 0.06;
  }
  for (let i = 0; i < sc.wings.length; i++) sc.wings[i].rotation.z = sc.wingBase[i] + sc.wingSide[i] * (Math.sin(t * wingSpeed + i) * wingAmp - wingBias);
  for (let i = 0; i < sc.legs.length; i++) sc.legs[i].rotation.x = Math.sin(t * 3 + i * 1.6) * legAmp;
  for (let i = 0; i < sc.arms.length; i++) sc.arms[i].rotation.x = Math.sin(t * 2.4 + i * 1.6) * armAmp;
}

export function createCreatureModel(speciesId: string, shiny = false): CreatureModel {
  const sp = getSpecies(speciesId);
  const sc = new Sculptor();
  const skin = buildSkin(sc, sp, shiny);
  sc.baseScale = sp.tier === 'legendary' ? 1.15 : sp.tier === 'mythical' ? 1.1 : 1;
  buildByPlan(sc, sp, skin);
  sc.finalize();
  if (shiny) {
    const size = new THREE.Box3().setFromObject(sc.root).getSize(new THREE.Vector3());
    sparkles(sc, skin, Math.max(size.x, size.z), size.y);
    sc.finalize(0);
  }
  sc.root.name = shiny ? sp.id + '-shiny' : sp.id;
  animate(sc, 0, 'idle');
  return {
    root: sc.root,
    update: (seconds: number, mood: CreatureMood = 'idle'): void => animate(sc, seconds, mood),
    dispose: (): void => sc.dispose(),
  };
}
