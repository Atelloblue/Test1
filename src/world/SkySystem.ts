import * as THREE from 'three';

export class SkySystem {
  private skyMesh: THREE.Mesh;
  private cloudMeshes: THREE.Mesh[] = [];
  private material: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    // Sky dome with enhanced shader
    this.material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vDirection;
        
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vDirection = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunDir;
        
        varying vec3 vWorldPos;
        varying vec3 vDirection;
        
        // Hash function for noise
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        
        // Value noise
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
        
        // Fractal Brownian Motion for clouds
        float fbm(vec2 p) {
          float value = 0.0;
          float amp = 0.5;
          float freq = 1.0;
          for (int i = 0; i < 6; i++) {
            value += amp * noise(p * freq);
            freq *= 2.0;
            amp *= 0.5;
          }
          return value;
        }
        
        void main() {
          vec3 dir = normalize(vDirection);
          float y = dir.y;
          
          // Sky gradient - more realistic
          vec3 zenith = vec3(0.2, 0.4, 0.75);
          vec3 midSky = vec3(0.4, 0.6, 0.85);
          vec3 horizon = vec3(0.65, 0.75, 0.85);
          vec3 groundHaze = vec3(0.56, 0.67, 0.73);
          
          vec3 color;
          if (y > 0.3) {
            color = mix(midSky, zenith, smoothstep(0.3, 0.9, y));
          } else if (y > 0.0) {
            color = mix(horizon, midSky, smoothstep(0.0, 0.3, y));
          } else {
            color = mix(groundHaze, horizon, smoothstep(-0.2, 0.0, y));
          }
          
          // Sun and atmospheric scattering
          float sunDot = max(dot(dir, uSunDir), 0.0);
          
          // Sun disk
          float sunDisk = smoothstep(0.9995, 0.9999, sunDot);
          vec3 sunColor = vec3(1.0, 0.95, 0.8);
          color += sunColor * sunDisk * 3.0;
          
          // Sun glow (large)
          float sunGlow = pow(sunDot, 8.0) * 0.4;
          color += vec3(1.0, 0.85, 0.6) * sunGlow;
          
          // Sun halo
          float sunHalo = pow(sunDot, 64.0) * 1.5;
          color += sunColor * sunHalo;
          
          // Atmospheric scattering near horizon
          float scatter = pow(max(1.0 - abs(y), 0.0), 8.0);
          color = mix(color, vec3(0.8, 0.7, 0.5), scatter * 0.15 * max(dot(uSunDir, vec3(0.0, 0.0, 1.0)), 0.0));
          
          // Volumetric clouds
          if (y > 0.02) {
            // Cloud UV mapping on sphere
            vec2 cloudUV = dir.xz / (y + 0.1) * 2.0;
            cloudUV += uTime * 0.008;
            
            float clouds = fbm(cloudUV * 1.5);
            clouds = smoothstep(0.4, 0.7, clouds);
            
            // Cloud lighting
            float cloudLight = pow(sunDot, 2.0) * 0.3 + 0.7;
            vec3 cloudColor = mix(vec3(0.7, 0.75, 0.8), vec3(1.0, 0.98, 0.95), cloudLight);
            
            // Silver lining effect
            float edge = smoothstep(0.4, 0.5, clouds) - smoothstep(0.5, 0.7, clouds);
            cloudColor += vec3(0.3, 0.25, 0.2) * edge * pow(sunDot, 4.0);
            
            // Cloud opacity based on height
            float cloudMask = smoothstep(0.02, 0.15, y) * smoothstep(0.8, 0.4, y);
            color = mix(color, cloudColor, clouds * cloudMask * 0.6);
          }
          
          // Lower cloud layer
          if (y > 0.01 && y < 0.3) {
            vec2 lowUV = dir.xz / (y + 0.05) * 1.0;
            lowUV += uTime * 0.003 + 50.0;
            
            float lowClouds = fbm(lowUV * 0.8);
            lowClouds = smoothstep(0.45, 0.65, lowClouds);
            
            vec3 lowCloudColor = vec3(0.75, 0.78, 0.82);
            float lowMask = smoothstep(0.01, 0.08, y) * smoothstep(0.3, 0.15, y);
            color = mix(color, lowCloudColor, lowClouds * lowMask * 0.3);
          }
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    const skyGeom = new THREE.SphereGeometry(450, 64, 64);
    this.skyMesh = new THREE.Mesh(skyGeom, this.material);
    scene.add(this.skyMesh);

    // Add some 3D cloud puffs for depth
    this.createCloudPuffs(scene);
  }

  private createCloudPuffs(scene: THREE.Scene) {
    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 20; i++) {
      const width = 25 + Math.random() * 60;
      const height = 8 + Math.random() * 15;
      const geom = new THREE.PlaneGeometry(width, height);
      const cloud = new THREE.Mesh(geom, cloudMaterial.clone());

      cloud.position.set(
        (Math.random() - 0.5) * 350,
        45 + Math.random() * 50,
        (Math.random() - 0.5) * 350
      );
      cloud.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.15;
      cloud.rotation.z = Math.random() * Math.PI;

      (cloud.material as THREE.MeshBasicMaterial).opacity = 0.05 + Math.random() * 0.12;

      scene.add(cloud);
      this.cloudMeshes.push(cloud);
    }
  }

  update(time: number, sunDir?: THREE.Vector3) {
    this.material.uniforms.uTime.value = time;
    if (sunDir) {
      this.material.uniforms.uSunDir.value.copy(sunDir);
    }

    // Slowly drift 3D clouds
    for (const cloud of this.cloudMeshes) {
      cloud.position.x += 0.015;
      if (cloud.position.x > 250) {
        cloud.position.x = -250;
      }
    }
  }
}
