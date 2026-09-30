import * as THREE from 'three';

export class AmbientParticles {
  private particles: THREE.Points;
  private particleCount = 300;
  private basePositions: Float32Array;
  private phases: Float32Array;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);
    this.basePositions = new Float32Array(this.particleCount * 3);
    this.phases = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      const x = (Math.random() - 0.5) * 120;
      const y = 2 + Math.random() * 15;
      const z = (Math.random() - 0.5) * 120;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      this.basePositions[i * 3] = x;
      this.basePositions[i * 3 + 1] = y;
      this.basePositions[i * 3 + 2] = z;

      sizes[i] = 0.5 + Math.random() * 1.5;
      this.phases[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float size;
        varying float vSize;
        
        void main() {
          vSize = size;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (150.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vSize;
        
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          
          float alpha = smoothstep(0.5, 0.0, dist) * 0.3;
          vec3 color = vec3(1.0, 0.98, 0.9);
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

      // Gentle floating motion
      posArray[idx] = this.basePositions[idx] + Math.sin(time * 0.3 + phase) * 2;
      posArray[idx + 1] = this.basePositions[idx + 1] + Math.sin(time * 0.5 + phase * 1.5) * 1;
      posArray[idx + 2] = this.basePositions[idx + 2] + Math.cos(time * 0.4 + phase * 0.7) * 2;
    }

    // Move particle field with camera
    this.particles.position.x = cameraPos.x;
    this.particles.position.z = cameraPos.z;

    positions.needsUpdate = true;
  }
}
