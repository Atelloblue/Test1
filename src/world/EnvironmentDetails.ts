import * as THREE from 'three';
import { TerrainGenerator } from './TerrainGenerator';

export class EnvironmentDetails {
  private flowerMeshes: THREE.InstancedMesh;
  private rockMeshes: THREE.InstancedMesh;
  private butterflyGroup: THREE.Group;
  private butterflies: { mesh: THREE.Group; phase: number; speed: number; center: THREE.Vector3; radius: number }[] = [];

  constructor(scene: THREE.Scene, terrain: TerrainGenerator) {
    this.flowerMeshes = this.createFlowers(scene, terrain);
    this.rockMeshes = this.createRocks(scene, terrain);
    this.butterflyGroup = new THREE.Group();
    this.createButterflies(scene, terrain);
    scene.add(this.butterflyGroup);
  }

  private createFlowers(scene: THREE.Scene, terrain: TerrainGenerator): THREE.InstancedMesh {
    const count = 600;
    
    // Flower head geometry
    const flowerGeom = new THREE.SphereGeometry(0.1, 8, 6);
    const flowerMat = new THREE.MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0,
      emissive: new THREE.Color(0.05, 0.02, 0.02),
      emissiveIntensity: 0.3,
    });

    const mesh = new THREE.InstancedMesh(flowerGeom, flowerMat, count);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    const flowerColors = [
      new THREE.Color(0.9, 0.2, 0.3),   // Red
      new THREE.Color(0.95, 0.85, 0.1),  // Yellow
      new THREE.Color(0.6, 0.3, 0.9),    // Purple
      new THREE.Color(1.0, 0.5, 0.7),    // Pink
      new THREE.Color(0.3, 0.5, 1.0),    // Blue
      new THREE.Color(1.0, 1.0, 0.95),   // White
      new THREE.Color(1.0, 0.6, 0.2),    // Orange
    ];

    let placed = 0;
    for (let i = 0; i < count * 3 && placed < count; i++) {
      const x = (Math.random() - 0.5) * 140;
      const z = (Math.random() - 0.5) * 140;
      const y = terrain.getTerrainHeightAt(x, z);

      if (y < 0 || y > 5) continue;

      const scale = 0.4 + Math.random() * 1.2;
      matrix.makeScale(scale, scale * 0.8, scale);
      matrix.setPosition(x, y + 0.25 * scale, z);
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
    const count = 100;
    
    const rockGeom = new THREE.IcosahedronGeometry(1, 1);
    // Deform vertices for natural look
    const positions = rockGeom.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const noise = 0.6 + Math.random() * 0.8;
      positions.setXYZ(i, x * noise, y * noise * 0.5, z * noise);
    }
    rockGeom.computeVertexNormals();

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
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

      const scale = 0.2 + Math.random() * 1.8;
      const rotY = Math.random() * Math.PI * 2;
      const rotX = (Math.random() - 0.5) * 0.3;
      
      matrix.makeRotationY(rotY);
      matrix.multiply(new THREE.Matrix4().makeRotationX(rotX));
      matrix.scale(new THREE.Vector3(scale, scale * (0.4 + Math.random() * 0.6), scale));
      matrix.setPosition(x, y - 0.15, z);
      mesh.setMatrixAt(placed, matrix);

      const shade = 0.25 + Math.random() * 0.35;
      const warmth = Math.random() * 0.05;
      color.setRGB(shade + warmth, shade, shade - warmth * 0.5);
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
    const count = 15;
    
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;
      const y = terrain.getTerrainHeightAt(x, z) + 2 + Math.random() * 4;

      const butterfly = new THREE.Group();
      
      // Wing geometry
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.quadraticCurveTo(0.15, 0.1, 0.2, 0);
      wingShape.quadraticCurveTo(0.15, -0.08, 0, 0);
      
      const wingGeom = new THREE.ShapeGeometry(wingShape);
      const hue = Math.random();
      const wingColor = new THREE.Color().setHSL(hue, 0.7, 0.6);
      const wingMat = new THREE.MeshStandardMaterial({
        color: wingColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        emissive: wingColor,
        emissiveIntensity: 0.1,
      });

      const leftWing = new THREE.Mesh(wingGeom, wingMat);
      leftWing.position.x = -0.02;
      butterfly.add(leftWing);

      const rightWing = new THREE.Mesh(wingGeom, wingMat.clone());
      rightWing.scale.x = -1;
      rightWing.position.x = 0.02;
      butterfly.add(rightWing);

      // Body
      const bodyGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.rotation.z = Math.PI / 2;
      butterfly.add(body);

      butterfly.position.set(x, y, z);
      butterfly.scale.setScalar(0.8 + Math.random() * 0.5);
      this.butterflyGroup.add(butterfly);

      this.butterflies.push({
        mesh: butterfly,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.8,
        center: new THREE.Vector3(x, y, z),
        radius: 3 + Math.random() * 6,
      });
    }
  }

  update(time: number) {
    // Animate butterflies with more natural movement
    for (const b of this.butterflies) {
      const t = time * b.speed;
      
      // Figure-8 pattern for more natural flight
      const x = b.center.x + Math.sin(t + b.phase) * b.radius;
      const z = b.center.z + Math.sin(t * 2 + b.phase) * b.radius * 0.5;
      const y = b.center.y + Math.sin(t * 1.5 + b.phase) * 1.5 + Math.cos(t * 0.5) * 0.5;

      b.mesh.position.set(x, y, z);
      
      // Face direction of movement
      const dx = Math.cos(t + b.phase) * b.radius;
      const dz = Math.cos(t * 2 + b.phase) * b.radius;
      b.mesh.rotation.y = Math.atan2(dz, dx);
      
      // Slight banking
      b.mesh.rotation.z = Math.sin(t * 2) * 0.2;
      
      // Wing flapping - faster and more natural
      const wingAngle = Math.sin(time * 15 + b.phase) * 0.6;
      if (b.mesh.children[0]) {
        b.mesh.children[0].rotation.y = wingAngle;
      }
      if (b.mesh.children[1]) {
        b.mesh.children[1].rotation.y = -wingAngle;
      }
    }
  }
}
