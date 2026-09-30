import * as THREE from 'three';
import { TerrainGenerator } from './TerrainGenerator';

const FOLIAGE_VERT = `
  uniform float uTime;
  uniform vec3 uWindDir;
  uniform float uWindStrength;
  
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vHeight;
  
  void main() {
    vec3 pos = position;
    
    // Wind sway for foliage
    float sway = sin(uTime * 1.5 + pos.x * 0.5 + pos.z * 0.3) * uWindStrength * 0.3;
    float sway2 = cos(uTime * 1.1 + pos.z * 0.4) * uWindStrength * 0.2;
    
    // Height-based displacement (more at top)
    float heightFactor = max(0.0, pos.y) * 0.1;
    pos.x += uWindDir.x * sway * heightFactor;
    pos.z += uWindDir.z * sway * heightFactor;
    pos.y += sway2 * heightFactor * 0.1;
    
    vHeight = pos.y;
    
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FOLIAGE_FRAG = `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uTime;
  
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vHeight;
  
  void main() {
    vec3 normal = normalize(vNormal);
    
    // Rich foliage colors
    vec3 baseColor = vec3(0.12, 0.35, 0.08);
    vec3 lightColor = vec3(0.25, 0.5, 0.15);
    vec3 tipColor = vec3(0.35, 0.55, 0.2);
    
    // Variation based on position
    float variation = sin(vWorldPos.x * 0.5) * cos(vWorldPos.z * 0.4) * 0.5 + 0.5;
    vec3 color = mix(baseColor, lightColor, variation);
    
    // Lighter at top
    color = mix(color, tipColor, smoothstep(0.0, 5.0, vHeight) * 0.3);
    
    // Lighting
    float NdotL = max(dot(normal, uSunDir), 0.0);
    
    // Subsurface scattering for leaves
    float backlight = max(dot(-normal, uSunDir), 0.0);
    float sss = pow(backlight, 2.0) * 0.5;
    vec3 sssColor = vec3(0.3, 0.5, 0.1) * sss;
    
    // Ambient occlusion
    float ao = 0.6 + 0.4 * NdotL;
    
    // Combine
    vec3 finalColor = color * (0.3 + NdotL * 0.7) * ao + sssColor;
    finalColor *= uSunColor;
    
    // Fog
    float fogDist = length(vWorldPos - cameraPosition);
    float fogFactor = 1.0 - exp(-fogDist * fogDist * 0.00004);
    vec3 fogColor = vec3(0.56, 0.67, 0.73);
    finalColor = mix(finalColor, fogColor, clamp(fogFactor, 0.0, 1.0));
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export class TreeSystem {
  private treeGroup: THREE.Group;
  private foliageMeshes: THREE.Mesh[] = [];
  private foliageMaterials: THREE.ShaderMaterial[] = [];
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

    // Trunk with better material
    const trunkGeom = new THREE.CylinderGeometry(0.15 * scale, 0.3 * scale, trunkHeight, 8);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.3 + Math.random() * 0.1, 0.2 + Math.random() * 0.05, 0.12),
      roughness: 0.95,
      metalness: 0.0,
    });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);
    this.trunkMeshes.push(trunk);

    // Foliage with custom shader
    const foliageGroup = new THREE.Group();
    foliageGroup.position.y = trunkHeight;

    const foliageMaterial = new THREE.ShaderMaterial({
      vertexShader: FOLIAGE_VERT,
      fragmentShader: FOLIAGE_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uWindDir: { value: new THREE.Vector3(1, 0, 0) },
        uWindStrength: { value: 0.5 },
        uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
        uSunColor: { value: new THREE.Color(1.0, 0.95, 0.85) },
      },
    });

    // Main canopy
    const mainSize = 2 * scale + Math.random();
    const mainGeom = new THREE.IcosahedronGeometry(mainSize, 2);
    // Deform for organic look
    const positions = mainGeom.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i);
      const py = positions.getY(i);
      const pz = positions.getZ(i);
      const noise = 0.85 + Math.random() * 0.3;
      positions.setXYZ(i, px * noise, py * noise * 0.7, pz * noise);
    }
    mainGeom.computeVertexNormals();

    const mainFoliage = new THREE.Mesh(mainGeom, foliageMaterial);
    mainFoliage.position.y = mainSize * 0.5;
    mainFoliage.castShadow = true;
    mainFoliage.receiveShadow = true;
    foliageGroup.add(mainFoliage);
    this.foliageMeshes.push(mainFoliage);
    this.foliageMaterials.push(foliageMaterial);
    this.originalPositions.push(mainFoliage.position.clone());
    this.treePhases.push(Math.random() * Math.PI * 2);

    // Secondary clusters
    for (let j = 0; j < 3; j++) {
      const subSize = mainSize * (0.4 + Math.random() * 0.3);
      const subGeom = new THREE.IcosahedronGeometry(subSize, 1);
      
      const subMat = foliageMaterial.clone();
      const sub = new THREE.Mesh(subGeom, subMat);
      const angle = (j / 3) * Math.PI * 2 + Math.random();
      sub.position.set(
        Math.cos(angle) * mainSize * 0.6,
        mainSize * (0.2 + Math.random() * 0.4),
        Math.sin(angle) * mainSize * 0.6
      );
      sub.castShadow = true;
      sub.receiveShadow = true;
      foliageGroup.add(sub);
      this.foliageMeshes.push(sub);
      this.foliageMaterials.push(subMat);
      this.originalPositions.push(sub.position.clone());
      this.treePhases.push(Math.random() * Math.PI * 2);
    }

    tree.add(foliageGroup);
    tree.rotation.y = Math.random() * Math.PI * 2;

    return tree;
  }

  update(time: number, windDir: THREE.Vector3, windStrength: number, sunDir?: THREE.Vector3) {
    // Update all foliage materials
    for (const material of this.foliageMaterials) {
      material.uniforms.uTime.value = time;
      material.uniforms.uWindDir.value.copy(windDir);
      material.uniforms.uWindStrength.value = windStrength;
      if (sunDir) {
        material.uniforms.uSunDir.value.copy(sunDir);
      }
    }

    // Gentle swaying of entire foliage groups
    for (let i = 0; i < this.foliageMeshes.length; i++) {
      const mesh = this.foliageMeshes[i];
      const orig = this.originalPositions[i];
      const phase = this.treePhases[i];

      const sway = Math.sin(time * 1.5 + phase) * windStrength * 0.2;
      const sway2 = Math.cos(time * 1.1 + phase * 1.3) * windStrength * 0.15;

      mesh.position.x = orig.x + windDir.x * sway;
      mesh.position.z = orig.z + windDir.z * sway;
      mesh.position.y = orig.y + sway2 * 0.05;

      mesh.rotation.x = sway * 0.03;
      mesh.rotation.z = sway2 * 0.03;
    }
  }
}
