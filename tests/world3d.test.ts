import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MAPS } from '../src/world/maps';
import { World3D } from '../src/render/three/World3D';

describe('3D region geometry', () => {
  it('builds every authored map and preserves the movement directions on screen', () => {
    expect(Object.keys(MAPS)).toHaveLength(37);
    for (const map of Object.values(MAPS)) {
      const view = new World3D(map, true);
      const player = { id: 'player', x: map.width / 2 + 0.5, y: map.height / 2 + 0.5, facing: 'down' as const, style: { shirt: 0xff6b35, hair: 0x2a1a12, skin: 0xf0c8a0 } };
      view.sync(player, [], 0);
      view.sync({ ...player, x: player.x + 1 }, [], 1);
      view.camera.updateMatrixWorld(true);
      const center = new THREE.Vector3(player.x, 0, player.y).project(view.camera);
      const east = new THREE.Vector3(player.x + 1, 0, player.y).project(view.camera);
      const north = new THREE.Vector3(player.x, 0, player.y - 1).project(view.camera);
      expect(east.x, map.id).toBeGreaterThan(center.x);
      expect(north.y, map.id).toBeGreaterThan(center.y);
      expect(view.camera.projectionMatrix.elements.every(Number.isFinite), map.id).toBe(true);
      let meshes = 0;
      view.scene.updateMatrixWorld(true);
      view.scene.traverse((node) => {
        expect(node.matrixWorld.elements.every(Number.isFinite), map.id).toBe(true);
        if (!(node instanceof THREE.Mesh)) return;
        meshes++;
        if (node instanceof THREE.InstancedMesh) {
          expect(Array.from(node.instanceMatrix.array).every(Number.isFinite), map.id).toBe(true);
        }
      });
      expect(meshes, map.id).toBeGreaterThan(5);
      expect(meshes, map.id).toBeLessThan(2000);
      view.dispose();
      view.dispose();
    }
  });
  it('furnishes every indoor map with decoration', () => {
    const indoor = Object.values(MAPS).filter((m) => m.indoor);
    expect(indoor).toHaveLength(19);
    const count = (map: (typeof indoor)[number]) => {
      const view = new World3D(map, false);
      let meshes = 0;
      let instances = 0;
      let lights = 0;
      view.scene.traverse((node) => {
        if (node instanceof THREE.PointLight) lights++;
        if (!(node instanceof THREE.Mesh)) return;
        meshes++;
        if (node instanceof THREE.InstancedMesh) instances += node.count;
      });
      view.dispose();
      return { meshes, instances, lights };
    };
    for (const map of indoor) {
      const got = count(map);
      // A bare room is the ground plus a handful of wall blocks; decorated rooms add merged furniture and instanced props.
      expect(got.meshes, map.id).toBeGreaterThan(10);
      expect(got.instances, map.id).toBeGreaterThan(20);
      expect(got.lights, map.id).toBeGreaterThan(0);
      expect(got.meshes, map.id).toBeLessThan(120);
    }
    const reduced = new World3D(MAPS['lumen-lab'], true);
    let reducedLights = 0;
    reduced.scene.traverse((node) => { if (node instanceof THREE.PointLight) reducedLights++; });
    expect(reducedLights).toBeLessThanOrEqual(2);
    reduced.dispose();
  });
  it('fades a foreground building without fading instanced foliage or floor', () => {
    const view = new World3D(MAPS['emberleaf-town'], false);
    const opacities = new Map<THREE.InstancedMesh, number>();
    view.scene.traverse((node) => { if (node instanceof THREE.InstancedMesh) opacities.set(node, (node.material as THREE.Material).opacity); });
    view.sync({id:'player',x:10,y:14,facing:'up',style:{shirt:0xff6b35,hair:0x222222,skin:0xe8b68b}},[],0);
    let fadedBuildings = 0;
    view.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const material = node.material as THREE.MeshStandardMaterial;
      if (node instanceof THREE.InstancedMesh) expect(material.opacity).toBe(opacities.get(node));
      else if (material.opacity < 1) fadedBuildings++;
    });
    expect(fadedBuildings).toBeGreaterThan(0);
    view.dispose();
  });

});
