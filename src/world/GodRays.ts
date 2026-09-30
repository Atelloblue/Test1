import * as THREE from 'three';

export class GodRays {
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private rays: { angle: number; length: number; width: number; opacity: number }[] = [];

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        
        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uIntensity;
        
        varying vec2 vUv;
        varying vec3 vWorldPos;
        
        void main() {
          // Radial light rays from top
          vec2 center = vec2(0.5, 1.0);
          vec2 dir = vUv - center;
          float angle = atan(dir.x, dir.y);
          float dist = length(dir);
          
          // Create ray pattern
          float rays = 0.0;
          rays += sin(angle * 8.0 + uTime * 0.3) * 0.5 + 0.5;
          rays += sin(angle * 12.0 - uTime * 0.2) * 0.3 + 0.3;
          rays += sin(angle * 20.0 + uTime * 0.5) * 0.2 + 0.2;
          rays = rays / 3.0;
          
          // Fade with distance from center
          float fade = smoothstep(0.0, 0.3, dist) * smoothstep(1.0, 0.3, dist);
          
          // Fade at bottom
          float bottomFade = smoothstep(0.0, 0.5, vUv.y);
          
          // Combine
          float alpha = rays * fade * bottomFade * uIntensity * 0.15;
          
          // Warm golden color
          vec3 color = vec3(1.0, 0.9, 0.7);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    // Create a large plane above the scene
    const geometry = new THREE.PlaneGeometry(200, 100);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.y = 40;
    this.mesh.rotation.x = -Math.PI / 4;
    scene.add(this.mesh);
  }

  update(time: number, camera: THREE.PerspectiveCamera, sunDir: THREE.Vector3) {
    this.material.uniforms.uTime.value = time;
    
    // Adjust intensity based on sun angle
    const sunHeight = sunDir.y;
    const intensity = Math.max(0, sunHeight) * 1.5;
    this.material.uniforms.uIntensity.value = intensity;
    
    // Position relative to camera
    this.mesh.position.x = camera.position.x;
    this.mesh.position.z = camera.position.z;
    
    // Rotate to face sun direction
    const sunAngle = Math.atan2(sunDir.z, sunDir.x);
    this.mesh.rotation.y = sunAngle;
  }
}
