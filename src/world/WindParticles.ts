import * as THREE from 'three';

export class WindParticles {
  private particles: THREE.Points;
  private velocities: Float32Array;
  private lifetimes: Float32Array;
  private particleCount = 3000;
  private range = 80;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);
    const alphas = new Float32Array(this.particleCount);
    const randoms = new Float32Array(this.particleCount);
    this.velocities = new Float32Array(this.particleCount * 3);
    this.lifetimes = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      this.resetParticle(i, positions, new THREE.Vector3(0, 10, 0));
      sizes[i] = 0.1 + Math.random() * 0.4;
      alphas[i] = Math.random();
      randoms[i] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute float aRandom;
        varying float vAlpha;
        varying float vRandom;
        
        void main() {
          vAlpha = alpha;
          vRandom = aRandom;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (250.0 / -mvPosition.z);
          gl_PointSize = max(gl_PointSize, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying float vRandom;
        
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          // Soft circular particle with glow
          float core = smoothstep(0.5, 0.0, dist);
          float glow = smoothstep(0.5, 0.2, dist) * 0.5;
          float alpha = (core + glow) * vAlpha * 0.5;
          
          // Slightly warm tinted
          vec3 color = mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.95, 0.85), vRandom);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geometry, material);
    this.particles.frustumCulled = false;
    scene.add(this.particles);
  }

  private resetParticle(i: number, positions: Float32Array, cameraPos: THREE.Vector3) {
    const idx = i * 3;
    
    // Spawn around camera with offset
    positions[idx] = cameraPos.x + (Math.random() - 0.5) * this.range;
    positions[idx + 1] = cameraPos.y + (Math.random() - 0.3) * 30 - 5;
    positions[idx + 2] = cameraPos.z + (Math.random() - 0.5) * this.range;

    // Velocity
    this.velocities[idx] = (Math.random() - 0.3) * 2;
    this.velocities[idx + 1] = (Math.random() - 0.5) * 0.5;
    this.velocities[idx + 2] = (Math.random() - 0.5) * 1;

    this.lifetimes[i] = Math.random();
  }

  update(delta: number, windDir: THREE.Vector3, windStrength: number, cameraPos: THREE.Vector3) {
    const positions = this.particles.geometry.attributes.position as THREE.BufferAttribute;
    const alphas = this.particles.geometry.attributes.alpha as THREE.BufferAttribute;
    const posArray = positions.array as Float32Array;
    const alphaArray = alphas.array as Float32Array;

    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * 3;

      // Apply wind with turbulence
      const turbulence = Math.sin(this.lifetimes[i] * 8.0 + i) * 0.5;
      posArray[idx] += (this.velocities[idx] + windDir.x * windStrength * 10 + turbulence) * delta;
      posArray[idx + 1] += (this.velocities[idx + 1] + Math.sin(this.lifetimes[i] * 5) * 0.8) * delta;
      posArray[idx + 2] += (this.velocities[idx + 2] + windDir.z * windStrength * 5) * delta;

      // Update lifetime
      this.lifetimes[i] += delta * 0.2;
      
      // Fade in/out
      const life = this.lifetimes[i];
      if (life < 0.1) {
        alphaArray[i] = life * 10;
      } else if (life > 0.8) {
        alphaArray[i] = (1.0 - life) * 5;
      } else {
        alphaArray[i] = 0.6 + Math.sin(life * 10) * 0.2;
      }

      // Reset if too far or dead
      const dx = posArray[idx] - cameraPos.x;
      const dz = posArray[idx + 2] - cameraPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > this.range || this.lifetimes[i] > 1) {
        this.resetParticle(i, posArray, cameraPos);
      }
    }

    positions.needsUpdate = true;
    alphas.needsUpdate = true;
  }
}
