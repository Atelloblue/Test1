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
  varying vec3 vNormal;
  varying float vRandom;
  varying float vFog;
  
  void main() {
    vRandom = aRandom;
    vHeight = aHeight;
    
    vec3 pos = position;
    
    // Multi-layered wind animation
    float heightFactor = pow(aHeight, 1.8);
    
    // Primary wind wave
    float windPhase1 = dot(vec3(pos.x, 0.0, pos.z), uWindDir) * 0.4 + uTime * 2.2;
    float wind1 = sin(windPhase1 + aRandom * 6.28) * heightFactor * uWindStrength * 1.8;
    
    // Secondary gusts
    float gustPhase = uTime * 0.8 + pos.x * 0.02 + pos.z * 0.03;
    float gust = sin(gustPhase) * 0.5 + 0.5;
    gust = pow(gust, 3.0) * uWindStrength;
    
    // Tertiary micro-movement
    float micro = sin(uTime * 4.0 + aRandom * 20.0) * heightFactor * 0.1;
    
    // Apply displacement
    float totalWind = wind1 + gust * heightFactor * 2.0 + micro;
    pos.x += uWindDir.x * totalWind;
    pos.z += uWindDir.z * totalWind;
    pos.y += totalWind * 0.05; // Slight upward lift
    
    // Bend effect - grass leans in wind direction
    float bendAmount = totalWind * 0.3;
    pos.x += uWindDir.x * bendAmount * aHeight;
    pos.z += uWindDir.z * bendAmount * aHeight;
    
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    
    // Approximate normal (pointing up, tilted by wind)
    vNormal = normalize(vec3(-uWindDir.x * totalWind * 0.5, 1.0, -uWindDir.z * totalWind * 0.5));
    
    // Fog calculation
    float fogDist = length(worldPos.xyz - cameraPosition);
    vFog = 1.0 - exp(-fogDist * fogDist * 0.00004);
    
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const GRASS_FRAG = `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  
  varying float vHeight;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vRandom;
  varying float vFog;
  
  void main() {
    // Rich grass coloring with variation
    vec3 baseGreen = vec3(0.15, 0.38, 0.08);
    vec3 tipGreen = vec3(0.35, 0.55, 0.15);
    vec3 yellowTip = vec3(0.5, 0.55, 0.15);
    vec3 darkBase = vec3(0.05, 0.12, 0.03);
    
    // Color gradient from base to tip
    vec3 color = mix(darkBase, baseGreen, smoothstep(0.0, 0.3, vHeight));
    color = mix(color, tipGreen, smoothstep(0.3, 0.7, vHeight));
    color = mix(color, yellowTip, smoothstep(0.7, 1.0, vHeight) * 0.5);
    
    // Per-blade variation
    float variation = sin(vRandom * 50.0) * 0.1;
    color *= 0.9 + variation;
    
    // Position-based color variation (patches of different grass)
    float patchNoise = sin(vWorldPos.x * 0.15) * cos(vWorldPos.z * 0.12) * 0.5 + 0.5;
    color = mix(color, color * vec3(1.1, 0.9, 0.8), patchNoise * 0.2);
    
    // Lighting
    vec3 normal = normalize(vNormal);
    float NdotL = max(dot(normal, uSunDir), 0.0);
    
    // Subsurface scattering - light passing through grass blades
    float backlight = max(dot(-normal, uSunDir), 0.0);
    float sss = pow(backlight, 2.0) * vHeight;
    vec3 sssColor = vec3(0.3, 0.5, 0.1) * sss * 0.6;
    
    // Ambient occlusion at base
    float ao = smoothstep(0.0, 0.3, vHeight) * 0.6 + 0.4;
    
    // Diffuse lighting
    float diffuse = NdotL * 0.6 + 0.4;
    
    // Rim light for backlit grass
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.0);
    vec3 rimColor = uSunColor * rim * 0.15 * vHeight;
    
    // Combine
    vec3 finalColor = color * diffuse * ao + sssColor + rimColor;
    
    // Ambient light
    finalColor += color * vec3(0.1, 0.12, 0.15) * ao;
    
    // Apply sun color tint
    finalColor *= mix(vec3(1.0), uSunColor, 0.3);
    
    // Fog
    vec3 fogColor = vec3(0.56, 0.67, 0.73);
    finalColor = mix(finalColor, fogColor, clamp(vFog, 0.0, 1.0));
    
    gl_FragColor = vec4(finalColor, 1.0);
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
        uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
        uSunColor: { value: new THREE.Color(1.0, 0.95, 0.85) },
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

      if (y < -0.5 || y > 8) continue;

      const bladeHeight = 0.4 + Math.random() * 0.9;
      const bladeWidth = 0.03 + Math.random() * 0.05;
      const angle = Math.random() * Math.PI * 2;
      const random = Math.random();

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

      // Top right (tapered)
      const topWidth = bladeWidth * 0.15;
      const topCos = Math.cos(angle) * topWidth;
      const topSin = Math.sin(angle) * topWidth;
      positions.push(x + topCos, y + bladeHeight, z + topSin);
      randoms.push(random);
      heights.push(1);

      // Top left
      positions.push(x - topCos, y + bladeHeight, z - topSin);
      randoms.push(random);
      heights.push(1);

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

  update(time: number, windDir: THREE.Vector3, windStrength: number, sunDir: THREE.Vector3) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uWindDir.value.copy(windDir);
    this.material.uniforms.uWindStrength.value = windStrength;
    this.material.uniforms.uSunDir.value.copy(sunDir);
  }
}
