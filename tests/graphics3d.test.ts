import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CREATURE_IDS } from '../src/data/creatures';
import { createCreatureModel } from '../src/render/three/CreatureModels';

describe('3D creature assets', () => {
  it('builds all 40 species with finite geometry and independent world transforms', () => {
    expect(CREATURE_IDS).toHaveLength(40);
    for (const id of CREATURE_IDS) {
      const model = createCreatureModel(id);
      let meshCount = 0;
      model.root.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        meshCount++;
        expect(node.castShadow && node.receiveShadow, id).toBe(true);
        const p = node.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i++) {
          expect(Number.isFinite(p.getX(i)) && Number.isFinite(p.getY(i)) && Number.isFinite(p.getZ(i)), id).toBe(true);
        }
      });
      expect(meshCount, id).toBeGreaterThan(15);
      expect(meshCount, id).toBeLessThan(130);
      const bounds = new THREE.Box3().setFromObject(model.root);
      const size = bounds.getSize(new THREE.Vector3());
      expect(size.y, id).toBeGreaterThan(0.5);
      expect(size.y, id).toBeLessThan(3.5);
      expect(size.x, id).toBeLessThan(4);
      expect(size.z, id).toBeLessThan(4);
      model.root.position.set(5, 2, -7);
      model.root.rotation.set(0, 0.8, 0);
      model.root.scale.setScalar(1.3);
      for (const mood of ['idle', 'attack', 'hurt', 'faint', 'celebrate'] as const) {
        model.update(10, mood);
        model.update(10, mood);
        expect(model.root.position.toArray()).toEqual([5, 2, -7]);
        expect(model.root.rotation.y).toBe(0.8);
        expect(model.root.scale.toArray()).toEqual([1.3, 1.3, 1.3]);
      }
      model.dispose();
      model.dispose();
      expect(model.root.children).toHaveLength(0);
    }
  });

  it('gives each starter distinct geometry and lets clones dispose independently', () => {
    const silhouettes = ['emberkit', 'drizzlet', 'sproutle'].map((id) => {
      const model = createCreatureModel(id);
      const size = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3());
      const silhouette = size.toArray().map((v) => v.toFixed(2)).join(',');
      model.dispose();
      return silhouette;
    });
    expect(new Set(silhouettes).size).toBe(3);
    const first = createCreatureModel('emberkit');
    const second = createCreatureModel('emberkit', true);
    first.dispose();
    second.update(2);
    expect(new THREE.Box3().setFromObject(second.root).isEmpty()).toBe(false);
    second.dispose();
  });
});
