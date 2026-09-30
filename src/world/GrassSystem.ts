import * as THREE from 'three';
import { TerrainGenerator } from './TerrainGenerator';

const GRASS_VERT = `
  uniform float uTime;
  uniform vec3 uWindDir;
  uniform float uWindStrength;
  
  attribute float aRandom;
  attribute float aHeight;
  
  varying float vHeight;
  varying vec3 vWorldPos;
  varying float vRandom;
  
  void main() {
    vRandom = aRandom;
    vHeight = aHeight;
    
    vec3 pos = position;
    
    // Wind displacement - stronger at top of blade
    float heightFactor = pow(aHeight, 2.0);
    float windPhase = dot(vec3(pos.x, 0.0, pos.z), uWindDir) * 0.5 + uTime * 2.0;
    float windDisp = sin(windPhase + aRandom * 6.28) * heightFactor * uWindStrength * 1.5;
    float windDisp2 = sin(windPhase * 0.7 + aRandom * 3.14) * heightFactor * uWindStrength * 0.8;
    
    pos.x += uWindDir.x * windDisp + uWindDir.z * windDisp2;
    pos.z += uWindDir.z * windDisp - uWindDir.x * windDisp2;
    pos.y += windDisp * 0.1;
    
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const GRASS_FRAG = `
  uniform float uTime;
  
  varying float vHeight;
  varying vec3 vWorldPos;
  varying float vRandom;
  
  void main() {
    // Base green color with variation
    vec3 baseColor = mix(
      vec3(0.15, 0.35, 0.1),
      vec3(0.3, 0.55, 0.15),
      vRandom
    );
    
    // Darken at base, lighten at tip
    vec3 color = mix(baseColor * 0.5, baseColor * 1.3, vHeight);
    
    // Subtle color variation based on position
    float posNoise = sin(vWorldPos.x * 0.3) * cos(vWorldPos.z * 0.3) * 0.05;
    color += posNoise;
    
    // Slight yellow tint at tips (sun-lit)
    color = mix(color, vec3(0.5, 0.6, 0.2), vHeight * 0.3);
    
    // Fog
    float fogDist = length(vWorldPos - cameraPosition);
    float fogFactor = 1.0 - exp(-fogDist * fogDist * 0.00005);
    vec3 fogColor = vec3(0.56, 0.67, 0.71);
    color = mix(color, fogColor, clamp(fogFactor, 0.0, 1.0));
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

export class GrassSystem {
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private bladeCount = 80000;

  constructor(scene: THREE.Scene, terrain: TerrainGenerator) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: GRASS_VERT,
      fragmentShader: GRASS_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uWindDir: { value: new THREE.Vector3(1, 0, 0) },
        uWindStrength: { value: 0.5 },
      },
      side: THREE.DoubleSide,
    });

    const geometry = this.createGrassGeometry(terrain);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  private createGrassGeometry(terrain: TerrainGenerator): THREE.BufferGeometry {
    const positions: number[] = [];
    const randoms: number[] = [];
    const heights: number[] = [];
    const indices: number[] = [];

    let vertexOffset = 0;

    for (let i = 0; i < this.bladeCount; i++) {
      const x = (Math.random() - 0.5) * 160;
      const z = (Math.random() - 0.5) * 160;
      const y = terrain.getTerrainHeightAt(x, z);

      // Only place grass on suitable terrain
      if (y < -0.5 || y > 8) continue;

      const bladeHeight = 0.4 + Math.random() * 0.8;
      const bladeWidth = 0.04 + Math.random() * 0.04;
      const angle = Math.random() * Math.PI * 2;
      const random = Math.random();

      // Each blade is a quad (2 triangles, 4 vertices)
      const cos = Math.cos(angle) * bladeWidth;
      const sin = Math.sin(angle) * bladeWidth;

      // Bottom left
      positions.push(x - cos, y, z - sin);
      randoms.push(random);
      heights.push(0);

      // Bottom right
      positions.push(x + cos, y, z + sin);
      randoms.push(random);
      heights.push(0);

      // Top right (slightly narrower)
      const topWidth = bladeWidth * 0.3;
      const topCos = Math.cos(angle) * topWidth;
      const topSin = Math.sin(angle) * topWidth;
      positions.push(x + topCos, y + bladeHeight, z + topSin);
      randoms.push(random);
      heights.push(1);

      // Top left
      positions.push(x - topCos, y + bladeHeight, z - topSin);
      randoms.push(random);
      heights.push(1);

      // Indices for two triangles
      indices.push(
        vertexOffset, vertexOffset + 1, vertexOffset + 2,
        vertexOffset, vertexOffset + 2, vertexOffset + 3
      );

      vertexOffset += 4;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new THREE.Float32BufferAttribute(randoms, 1));
    geometry.setAttribute('aHeight', new THREE.Float32BufferAttribute(heights, 1));
    geometry.setIndex(indices);

    return geometry;
  }

  update(time: number, windDir: THREE.Vector3, windStrength: number) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uWindDir.value.copy(windDir);
    this.material.uniforms.uWindStrength.value = windStrength;
  }
}
