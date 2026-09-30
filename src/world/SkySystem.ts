import * as THREE from 'three';

export class SkySystem {
  private skyMesh: THREE.Mesh;
  private cloudMeshes: THREE.Mesh[] = [];
  private material: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    // Sky dome
    this.material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec2 vUv;
        
        void main() {
          vec3 dir = normalize(vWorldPos);
          float y = dir.y;
          
          // Sky gradient
          vec3 zenith = vec3(0.3, 0.5, 0.8);
          vec3 horizon = vec3(0.7, 0.8, 0.85);
          vec3 ground = vec3(0.56, 0.67, 0.71);
          
          vec3 color;
          if (y > 0.0) {
            float t = pow(y, 0.5);
            color = mix(horizon, zenith, t);
          } else {
            color = mix(horizon, ground, min(-y * 3.0, 1.0));
          }
          
          // Sun glow
          vec3 sunDir = normalize(vec3(0.5, 0.4, 0.3));
          float sunDot = max(dot(dir, sunDir), 0.0);
          vec3 sunColor = vec3(1.0, 0.9, 0.7);
          color += sunColor * pow(sunDot, 32.0) * 0.8;
          color += sunColor * pow(sunDot, 4.0) * 0.2;
          
          // Subtle clouds in sky
          float cloudNoise = sin(dir.x * 3.0 + uTime * 0.02) * 
                            cos(dir.z * 2.0 + uTime * 0.015) * 
                            sin(dir.x * 5.0 + dir.z * 4.0 + uTime * 0.03);
          cloudNoise = smoothstep(0.2, 0.8, cloudNoise * 0.5 + 0.5);
          
          if (y > 0.05) {
            float cloudMask = smoothstep(0.05, 0.3, y) * smoothstep(0.8, 0.4, y);
            color = mix(color, vec3(1.0, 1.0, 1.0), cloudNoise * cloudMask * 0.3);
          }
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    const skyGeom = new THREE.SphereGeometry(400, 32, 32);
    this.skyMesh = new THREE.Mesh(skyGeom, this.material);
    scene.add(this.skyMesh);

    // Add volumetric cloud planes
    this.createClouds(scene);
  }

  private createClouds(scene: THREE.Scene) {
    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 15; i++) {
      const width = 30 + Math.random() * 50;
      const height = 10 + Math.random() * 20;
      const geom = new THREE.PlaneGeometry(width, height);
      const cloud = new THREE.Mesh(geom, cloudMaterial.clone());

      cloud.position.set(
        (Math.random() - 0.5) * 300,
        50 + Math.random() * 40,
        (Math.random() - 0.5) * 300
      );
      cloud.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.2;
      cloud.rotation.z = Math.random() * Math.PI;

      (cloud.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.random() * 0.2;

      scene.add(cloud);
      this.cloudMeshes.push(cloud);
    }
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time;

    // Slowly drift clouds
    for (const cloud of this.cloudMeshes) {
      cloud.position.x += 0.02;
      if (cloud.position.x > 200) {
        cloud.position.x = -200;
      }
    }
  }
}
