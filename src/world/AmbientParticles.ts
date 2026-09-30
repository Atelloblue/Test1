import * as THREE from 'three';

export class AmbientParticles {
  private particles: THREE.Points;
  private basePositions: Float32Array;
  private phases: Float32Array;
  private particleCount = 400;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);
    const randoms = new Float32Array(this.particleCount);
    this.basePositions = new Float32Array(this.particleCount * 3);
    this.phases = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      const x = (Math.random() - 0.5) * 120;
      const y = 2 + Math.random() * 18;
      const z = (Math.random() - 0.5) * 120;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      this.basePositions[i * 3] = x;
      this.basePositions[i * 3 + 1] = y;
      this.basePositions[i * 3 + 2] = z;

      sizes[i] = 0.8 + Math.random() * 2.0;
      randoms[i] = Math.random();
      this.phases[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float size;
        attribute float aRandom;
        varying float vRandom;
        varying float vDist;
        
        void main() {
          vRandom = aRandom;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vDist = -mvPosition.z;
          gl_PointSize = size * (200.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 8.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vRandom;
        varying float vDist;
        
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          // Soft dandelion seed look
          float core = smoothstep(0.5, 0.0, dist);
          float ring = smoothstep(0.3, 0.2, dist) - smoothstep(0.2, 0.1, dist);
          
          float alpha = core * 0.25 + ring * 0.15;
          
          // Fade with distance
          alpha *= smoothstep(80.0, 20.0, vDist);
          
          // Warm white/golden tint
          vec3 color = mix(vec3(1.0, 0.98, 0.9), vec3(1.0, 0.95, 0.8), vRandom);
          
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

  update(time: number, cameraPos: THREE.Vector3) {
    const positions = this.particles.geometry.attributes.position as THREE.BufferAttribute;
    const posArray = positions.array as Float32Array;

    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * 3;
      const phase = this.phases[i];

      // Gentle floating motion - different frequencies for organic feel
      const drift = time * 0.15;
      posArray[idx] = this.basePositions[idx] + 
        Math.sin(time * 0.2 + phase) * 3 + 
        Math.cos(drift + phase * 2) * 1.5;
      posArray[idx + 1] = this.basePositions[idx + 1] + 
        Math.sin(time * 0.3 + phase * 1.5) * 1.5 +
        Math.cos(time * 0.1 + phase) * 0.5;
      posArray[idx + 2] = this.basePositions[idx + 2] + 
        Math.cos(time * 0.25 + phase * 0.7) * 3 +
        Math.sin(drift + phase * 3) * 1;
    }

    // Move particle field with camera
    this.particles.position.x = cameraPos.x;
    this.particles.position.z = cameraPos.z;

    positions.needsUpdate = true;
  }
}
