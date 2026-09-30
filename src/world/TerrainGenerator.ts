import * as THREE from 'three';

// Simplex-like noise implementation
class SimplexNoise {
  private perm: number[] = [];

  constructor(seed = 42) {
    const p: number[] = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    
    // Shuffle with seed
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

export class TerrainGenerator {
  private noise: SimplexNoise;
  private heightData: Float32Array;
  private terrainSize = 200;
  private segments = 200;
  public mesh!: THREE.Mesh;

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
    const colors = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      // Multi-octave noise for terrain height
      const height = this.getHeight(x, z);
      positions.setY(i, height);
      this.heightData[i] = height;

      // Color based on height
      const color = this.getTerrainColor(height, x, z);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    scene.add(this.mesh);
  }

  getHeight(x: number, z: number): number {
    const scale = 0.015;
    const detailScale = 0.05;
    
    // Large rolling hills
    let height = this.noise.fbm(x * scale, z * scale, 5, 2, 0.5) * 12;
    
    // Medium details
    height += this.noise.fbm(x * detailScale, z * detailScale, 3, 2, 0.4) * 3;
    
    // Small bumps
    height += this.noise.noise2D(x * 0.1, z * 0.1) * 0.5;

    // Create some valleys for water
    const valleyNoise = this.noise.fbm(x * 0.008, z * 0.008, 2, 2, 0.5);
    if (valleyNoise < -0.1) {
      height -= (-valleyNoise - 0.1) * 15;
    }

    // Edge falloff
    const dist = Math.sqrt(x * x + z * z) / (this.terrainSize * 0.5);
    if (dist > 0.7) {
      const falloff = Math.max(0, 1 - (dist - 0.7) / 0.3);
      height *= falloff;
    }

    return height;
  }

  private getTerrainColor(height: number, x: number, z: number): THREE.Color {
    const noise = this.noise.noise2D(x * 0.05, z * 0.05) * 0.1;
    
    if (height < -1) {
      // Sandy beach near water
      return new THREE.Color(0.76 + noise, 0.7 + noise, 0.5 + noise);
    } else if (height < 2) {
      // Lush grass
      const g = 0.35 + noise + height * 0.02;
      return new THREE.Color(0.2 + noise * 0.5, g, 0.15 + noise * 0.3);
    } else if (height < 6) {
      // Higher grass, slightly browner
      const factor = (height - 2) / 4;
      return new THREE.Color(
        0.25 + factor * 0.15 + noise,
        0.4 - factor * 0.1 + noise,
        0.15 + noise * 0.3
      );
    } else {
      // Rocky tops
      return new THREE.Color(0.4 + noise, 0.38 + noise, 0.35 + noise);
    }
  }

  getTerrainHeightAt(x: number, z: number): number {
    return this.getHeight(x, z);
  }
}
