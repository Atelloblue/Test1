import * as THREE from 'three';
import { TerrainGenerator } from './TerrainGenerator';

export class TreeSystem {
  private treeGroup: THREE.Group;
  private foliageMeshes: THREE.Mesh[] = [];
  private trunkMeshes: THREE.Mesh[] = [];
  private originalPositions: THREE.Vector3[] = [];
  private treePhases: number[] = [];

  constructor(scene: THREE.Scene, terrain: TerrainGenerator) {
    this.treeGroup = new THREE.Group();
    this.generateTrees(terrain);
    scene.add(this.treeGroup);
  }

  private generateTrees(terrain: TerrainGenerator) {
    const treeCount = 120;

    for (let i = 0; i < treeCount; i++) {
      const x = (Math.random() - 0.5) * 150;
      const z = (Math.random() - 0.5) * 150;
      const y = terrain.getTerrainHeightAt(x, z);

      // Only place trees on suitable terrain
      if (y < 0.5 || y > 7) continue;

      const tree = this.createTree(x, y, z);
      this.treeGroup.add(tree);
    }
  }

  private createTree(x: number, y: number, z: number): THREE.Group {
    const tree = new THREE.Group();
    tree.position.set(x, y, z);

    const scale = 0.7 + Math.random() * 0.8;
    const trunkHeight = 3 * scale + Math.random() * 2;

    // Trunk
    const trunkGeom = new THREE.CylinderGeometry(0.15 * scale, 0.3 * scale, trunkHeight, 6);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.35 + Math.random() * 0.1, 0.25 + Math.random() * 0.05, 0.15),
      roughness: 0.95,
    });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    tree.add(trunk);
    this.trunkMeshes.push(trunk);

    // Foliage - multiple layers of spheres for a natural look
    const foliageGroup = new THREE.Group();
    foliageGroup.position.y = trunkHeight;

    const foliageColor = new THREE.Color(
      0.15 + Math.random() * 0.15,
      0.4 + Math.random() * 0.2,
      0.1 + Math.random() * 0.1
    );

    // Main canopy
    const mainSize = 2 * scale + Math.random();
    const mainGeom = new THREE.IcosahedronGeometry(mainSize, 1);
    const mainMat = new THREE.MeshStandardMaterial({
      color: foliageColor,
      roughness: 0.8,
      flatShading: true,
    });
    const mainFoliage = new THREE.Mesh(mainGeom, mainMat);
    mainFoliage.position.y = mainSize * 0.5;
    mainFoliage.scale.y = 0.7;
    mainFoliage.castShadow = true;
    foliageGroup.add(mainFoliage);
    this.foliageMeshes.push(mainFoliage);
    this.originalPositions.push(mainFoliage.position.clone());
    this.treePhases.push(Math.random() * Math.PI * 2);

    // Secondary smaller clusters
    for (let j = 0; j < 3; j++) {
      const subSize = mainSize * (0.4 + Math.random() * 0.3);
      const subGeom = new THREE.IcosahedronGeometry(subSize, 1);
      const subMat = new THREE.MeshStandardMaterial({
        color: foliageColor.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.1),
        roughness: 0.8,
        flatShading: true,
      });
      const sub = new THREE.Mesh(subGeom, subMat);
      const angle = (j / 3) * Math.PI * 2 + Math.random();
      sub.position.set(
        Math.cos(angle) * mainSize * 0.6,
        mainSize * (0.2 + Math.random() * 0.4),
        Math.sin(angle) * mainSize * 0.6
      );
      sub.castShadow = true;
      foliageGroup.add(sub);
      this.foliageMeshes.push(sub);
      this.originalPositions.push(sub.position.clone());
      this.treePhases.push(Math.random() * Math.PI * 2);
    }

    tree.add(foliageGroup);

    // Random rotation for variety
    tree.rotation.y = Math.random() * Math.PI * 2;

    return tree;
  }

  update(time: number, windDir: THREE.Vector3, windStrength: number) {
    for (let i = 0; i < this.foliageMeshes.length; i++) {
      const mesh = this.foliageMeshes[i];
      const orig = this.originalPositions[i];
      const phase = this.treePhases[i];

      // Gentle swaying
      const sway = Math.sin(time * 1.5 + phase) * windStrength * 0.3;
      const sway2 = Math.cos(time * 1.1 + phase * 1.3) * windStrength * 0.2;

      mesh.position.x = orig.x + windDir.x * sway;
      mesh.position.z = orig.z + windDir.z * sway;
      mesh.position.y = orig.y + sway2 * 0.1;

      mesh.rotation.x = sway * 0.05;
      mesh.rotation.z = sway2 * 0.05;
    }
  }
}
