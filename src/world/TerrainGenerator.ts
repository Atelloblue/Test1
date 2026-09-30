import * as THREE from 'three';

// Simplex-like noise implementation
class SimplexNoise {
  private perm: number[] = [];

  constructor(seed = 42) {
    const p: number[] = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const A = this.perm[X] + Y;
    const B = this.perm[X + 1] + Y;
    
    return this.lerp(
      this.lerp(this.grad(this.perm[A], x, y), this.grad(this.perm[B], x - 1, y), u),
      this.lerp(this.grad(this.perm[A + 1], x, y - 1), this.grad(this.perm[B + 1], x - 1, y - 1), u),
      v
    );
  }

  fbm(x: number, y: number, octaves: number = 6, lacunarity: number = 2, gain: number = 0.5): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }
}

const TERRAIN_VERT = `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying float vHeight;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vHeight = position.y;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const TERRAIN_FRAG = `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uTime;
  
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying float vHeight;
  
  // Noise functions for detail
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  
  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return value;
  }
  
  void main() {
    vec3 normal = normalize(vNormal);
    
    // Procedural detail texturing
    float detail = fbm(vWorldPos.xz * 0.5);
    float microDetail = fbm(vWorldPos.xz * 2.0);
    
    // Height-based coloring with smooth transitions
    vec3 deepGrass = vec3(0.12, 0.28, 0.08);
    vec3 lightGrass = vec3(0.25, 0.45, 0.12);
    vec3 dryGrass = vec3(0.4, 0.42, 0.15);
    vec3 sand = vec3(0.72, 0.65, 0.45);
    vec3 rock = vec3(0.35, 0.32, 0.28);
    vec3 darkRock = vec3(0.2, 0.18, 0.15);
    
    // Slope detection
    float slope = 1.0 - normal.y;
    
    // Base color based on height
    vec3 color;
    if (vHeight < -0.5) {
      color = sand;
    } else if (vHeight < 1.5) {
      float t = smoothstep(-0.5, 1.5, vHeight);
      color = mix(sand, deepGrass, t);
    } else if (vHeight < 4.0) {
      float t = smoothstep(1.5, 4.0, vHeight);
      color = mix(deepGrass, lightGrass, t);
    } else if (vHeight < 7.0) {
      float t = smoothstep(4.0, 7.0, vHeight);
      color = mix(lightGrass, dryGrass, t);
    } else {
      float t = smoothstep(7.0, 10.0, vHeight);
      color = mix(dryGrass, rock, t);
    }
    
    // Add noise variation
    color *= 0.85 + detail * 0.3;
    color += (microDetail - 0.5) * 0.05;
    
    // Slope-based rock blending
    float rockBlend = smoothstep(0.4, 0.7, slope);
    color = mix(color, mix(rock, darkRock, microDetail), rockBlend);
    
    // Lighting
    float NdotL = max(dot(normal, uSunDir), 0.0);
    
    // Wrap lighting for softer shadows
    float wrapNdotL = max((dot(normal, uSunDir) + 0.4) / 1.4, 0.0);
    
    // Ambient occlusion approximation based on height
    float ao = smoothstep(-2.0, 3.0, vHeight) * 0.5 + 0.5;
    ao *= 0.7 + 0.3 * wrapNdotL;
    
    // Ambient
    vec3 ambient = vec3(0.15, 0.18, 0.22) * ao;
    
    // Diffuse
    vec3 diffuse = uSunColor * NdotL * 0.8;
    
    // Subsurface scattering approximation for grass
    float sss = max(0.0, dot(-normal, uSunDir)) * 0.15;
    vec3 sssColor = vec3(0.2, 0.35, 0.05) * sss;
    
    // Specular (wet look for low areas)
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 halfDir = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);
    float wetness = smoothstep(0.0, -0.5, vHeight);
    vec3 specular = uSunColor * spec * wetness * 0.3;
    
    // Rim light
    float rim = 1.0 - max(dot(viewDir, normal), 0.0);
    rim = pow(rim, 3.0) * 0.15;
    vec3 rimColor = uSunColor * rim;
    
    // Final color
    vec3 finalColor = color * (ambient + diffuse) + sssColor + specular + rimColor;
    
    // Atmospheric fog
    float fogDist = length(vWorldPos - cameraPosition);
    float fogFactor = 1.0 - exp(-fogDist * fogDist * 0.00003);
    vec3 fogColor = vec3(0.56, 0.67, 0.73);
    finalColor = mix(finalColor, fogColor, clamp(fogFactor, 0.0, 1.0));
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export class TerrainGenerator {
  private noise: SimplexNoise;
  private heightData: Float32Array;
  private terrainSize = 200;
  private segments = 200;
  public mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    this.noise = new SimplexNoise(12345);
    this.heightData = new Float32Array((this.segments + 1) * (this.segments + 1));
    this.generateTerrain(scene);
  }

  private generateTerrain(scene: THREE.Scene) {
    const geometry = new THREE.PlaneGeometry(
      this.terrainSize,
      this.terrainSize,
      this.segments,
      this.segments
    );
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const height = this.getHeight(x, z);
      positions.setY(i, height);
      this.heightData[i] = height;
    }

    geometry.computeVertexNormals();

    this.material = new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERT,
      fragmentShader: TERRAIN_FRAG,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
        uSunColor: { value: new THREE.Color(1.0, 0.95, 0.85) },
        uTime: { value: 0 },
      },
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    scene.add(this.mesh);
  }

  getHeight(x: number, z: number): number {
    const scale = 0.015;
    const detailScale = 0.05;
    
    let height = this.noise.fbm(x * scale, z * scale, 5, 2, 0.5) * 12;
    height += this.noise.fbm(x * detailScale, z * detailScale, 3, 2, 0.4) * 3;
    height += this.noise.noise2D(x * 0.1, z * 0.1) * 0.5;

    const valleyNoise = this.noise.fbm(x * 0.008, z * 0.008, 2, 2, 0.5);
    if (valleyNoise < -0.1) {
      height -= (-valleyNoise - 0.1) * 15;
    }

    const dist = Math.sqrt(x * x + z * z) / (this.terrainSize * 0.5);
    if (dist > 0.7) {
      const falloff = Math.max(0, 1 - (dist - 0.7) / 0.3);
      height *= falloff;
    }

    return height;
  }

  getTerrainHeightAt(x: number, z: number): number {
    return this.getHeight(x, z);
  }

  update(time: number, sunDir: THREE.Vector3) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uSunDir.value.copy(sunDir);
  }
}
