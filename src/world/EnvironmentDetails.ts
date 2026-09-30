import * as THREE from 'three';
import { TerrainGenerator } from './TerrainGenerator';

export class EnvironmentDetails {
  private flowerMeshes: THREE.InstancedMesh;
  private rockMeshes: THREE.InstancedMesh;
  private butterflyGroup: THREE.Group;
  private butterflies: { mesh: THREE.Mesh; phase: number; speed: number; center: THREE.Vector3; radius: number }[] = [];

  constructor(scene: THREE.Scene, terrain: TerrainGenerator) {
    // Flowers
    this.flowerMeshes = this.createFlowers(scene, terrain);
    
    // Rocks
    this.rockMeshes = this.createRocks(scene, terrain);
    
    // Butterflies
    this.butterflyGroup = new THREE.Group();
    this.createButterflies(scene, terrain);
    scene.add(this.butterflyGroup);
  }

  private createFlowers(scene: THREE.Scene, terrain: TerrainGenerator): THREE.InstancedMesh {
    const count = 500;
    
    // Simple flower geometry - small colored spheres on stems
    const flowerGeom = new THREE.SphereGeometry(0.12, 6, 4);
    const flowerMat = new THREE.MeshStandardMaterial({
      roughness: 0.6,
      metalness: 0,
    });

    const mesh = new THREE.InstancedMesh(flowerGeom, flowerMat, count);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    const flowerColors = [
      new THREE.Color(0.9, 0.3, 0.4),  // Red
      new THREE.Color(0.9, 0.8, 0.2),  // Yellow
      new THREE.Color(0.7, 0.4, 0.9),  // Purple
      new THREE.Color(1.0, 0.6, 0.8),  // Pink
      new THREE.Color(0.4, 0.6, 1.0),  // Blue
      new THREE.Color(1.0, 1.0, 1.0),  // White
    ];

    let placed = 0;
    for (let i = 0; i < count * 2 && placed < count; i++) {
      const x = (Math.random() - 0.5) * 140;
      const z = (Math.random() - 0.5) * 140;
      const y = terrain.getTerrainHeightAt(x, z);

      if (y < 0 || y > 5) continue;

      const scale = 0.5 + Math.random() * 1.0;
      matrix.makeScale(scale, scale, scale);
      matrix.setPosition(x, y + 0.3 * scale, z);
      mesh.setMatrixAt(placed, matrix);
      
      color.copy(flowerColors[Math.floor(Math.random() * flowerColors.length)]);
      mesh.setColorAt(placed, color);
      
      placed++;
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = placed;
    scene.add(mesh);

    return mesh;
  }

  private createRocks(scene: THREE.Scene, terrain: TerrainGenerator): THREE.InstancedMesh {
    const count = 80;
    
    const rockGeom = new THREE.IcosahedronGeometry(1, 0);
    // Deform vertices for natural look
    const positions = rockGeom.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const noise = 0.7 + Math.random() * 0.6;
      positions.setXYZ(i, x * noise, y * noise * 0.6, z * noise);
    }
    rockGeom.computeVertexNormals();

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    });

    const mesh = new THREE.InstancedMesh(rockGeom, rockMat, count);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    let placed = 0;
    for (let i = 0; i < count * 2 && placed < count; i++) {
      const x = (Math.random() - 0.5) * 160;
      const z = (Math.random() - 0.5) * 160;
      const y = terrain.getTerrainHeightAt(x, z);

      if (y < -1) continue;

      const scale = 0.3 + Math.random() * 1.5;
      const rotY = Math.random() * Math.PI * 2;
      
      matrix.makeRotationY(rotY);
      matrix.scale(new THREE.Vector3(scale, scale * (0.5 + Math.random() * 0.5), scale));
      matrix.setPosition(x, y - 0.1, z);
      mesh.setMatrixAt(placed, matrix);

      const shade = 0.3 + Math.random() * 0.3;
      color.setRGB(shade, shade * 0.95, shade * 0.9);
      mesh.setColorAt(placed, color);

      placed++;
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = placed;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    return mesh;
  }

  private createButterflies(scene: THREE.Scene, terrain: TerrainGenerator) {
    const count = 12;
    
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;
      const y = terrain.getTerrainHeightAt(x, z) + 2 + Math.random() * 3;

      // Butterfly wings
      const wingGeom = new THREE.PlaneGeometry(0.3, 0.2);
      const wingColor = new THREE.Color().setHSL(Math.random(), 0.6, 0.6);
      const wingMat = new THREE.MeshBasicMaterial({
        color: wingColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });

      const butterfly = new THREE.Group();
      
      const leftWing = new THREE.Mesh(wingGeom, wingMat);
      leftWing.position.x = -0.1;
      butterfly.add(leftWing);

      const rightWing = new THREE.Mesh(wingGeom, wingMat);
      rightWing.position.x = 0.1;
      butterfly.add(rightWing);

      butterfly.position.set(x, y, z);
      this.butterflyGroup.add(butterfly);

      this.butterflies.push({
        mesh: butterfly as any,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1,
        center: new THREE.Vector3(x, y, z),
        radius: 3 + Math.random() * 5,
      });
    }
  }

  update(time: number) {
    // Animate butterflies
    for (const b of this.butterflies) {
      const t = time * b.speed;
      const x = b.center.x + Math.sin(t + b.phase) * b.radius;
      const z = b.center.z + Math.cos(t * 0.7 + b.phase) * b.radius;
      const y = b.center.y + Math.sin(t * 2 + b.phase) * 1;

      b.mesh.position.set(x, y, z);
      
      // Face direction of movement
      b.mesh.rotation.y = t + b.phase + Math.PI / 2;
      
      // Wing flapping
      const wingAngle = Math.sin(time * 12 + b.phase) * 0.5;
      if (b.mesh.children[0]) {
        b.mesh.children[0].rotation.y = wingAngle;
      }
      if (b.mesh.children[1]) {
        b.mesh.children[1].rotation.y = -wingAngle;
      }
    }
  }
}
