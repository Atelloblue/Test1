import * as THREE from 'three';

export class DistantMountains {
  constructor(scene: THREE.Scene) {
    this.createMountains(scene);
    this.createMist(scene);
    this.createHaze(scene);
  }

  private createMountains(scene: THREE.Scene) {
    const mountainCount = 12;
    
    for (let i = 0; i < mountainCount; i++) {
      const angle = (i / mountainCount) * Math.PI * 2 + Math.random() * 0.2;
      const distance = 130 + Math.random() * 50;
      
      const width = 50 + Math.random() * 80;
      const height = 25 + Math.random() * 40;
      
      // Create mountain shape with more detail
      const shape = new THREE.Shape();
      const segments = 20;
      
      shape.moveTo(-width / 2, 0);
      
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        const x = -width / 2 + t * width;
        
        // Mountain profile with multiple peaks
        let y = Math.sin(t * Math.PI) * height;
        
        // Add ridges
        y *= 0.6 + 0.4 * Math.sin(t * Math.PI * (3 + Math.random() * 2));
        
        // Add jagged peaks
        const jagged = Math.sin(t * 15 + i * 3) * 2 + Math.sin(t * 8 + i * 7) * 1.5;
        y += jagged * Math.sin(t * Math.PI);
        
        y = Math.max(0, y);
        
        shape.lineTo(x, y);
      }
      
      shape.lineTo(width / 2, 0);
      shape.lineTo(-width / 2, 0);

      const extrudeSettings = {
        depth: 8 + Math.random() * 15,
        bevelEnabled: false,
      };

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      
      // Atmospheric perspective - further = bluer and lighter
      const distFactor = distance / 180;
      const baseDarkness = 0.25 + distFactor * 0.2;
      const blueShift = distFactor * 0.15;
      
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(
          baseDarkness * 0.6,
          baseDarkness * 0.7 + blueShift,
          baseDarkness * 0.8 + blueShift * 1.5
        ),
        roughness: 1,
        metalness: 0,
        flatShading: true,
      });

      const mountain = new THREE.Mesh(geometry, material);
      mountain.position.set(
        Math.cos(angle) * distance,
        -8,
        Math.sin(angle) * distance
      );
      mountain.rotation.y = angle + Math.PI;
      mountain.rotation.x = -0.03;
      
      scene.add(mountain);
    }
  }

  private createMist(scene: THREE.Scene) {
    // Multiple mist layers at different heights
    const layers = [
      { y: 0.3, opacity: 0.12, size: 300 },
      { y: 1.5, opacity: 0.08, size: 280 },
      { y: 3.0, opacity: 0.05, size: 250 },
    ];

    for (const layer of layers) {
      const mistGeom = new THREE.PlaneGeometry(layer.size, layer.size);
      const mistMat = new THREE.ShaderMaterial({
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
          uniform float uOpacity;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          
          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1,0)), f.x),
              mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
              f.y
            );
          }
          
          void main() {
            // Animated noise for mist
            vec2 uv = vWorldPos.xz * 0.01;
            float n = noise(uv * 3.0) * 0.5 + noise(uv * 6.0) * 0.3 + noise(uv * 12.0) * 0.2;
            
            // Fade at edges
            float edgeFade = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x)
                          * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
            
            float alpha = n * uOpacity * edgeFade;
            
            vec3 mistColor = vec3(0.6, 0.68, 0.75);
            gl_FragColor = vec4(mistColor, alpha);
          }
        `,
        uniforms: {
          uOpacity: { value: layer.opacity },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const mist = new THREE.Mesh(mistGeom, mistMat);
      mist.rotation.x = -Math.PI / 2;
      mist.position.y = layer.y;
      scene.add(mist);
    }
  }

  private createHaze(scene: THREE.Scene) {
    // Distant atmospheric haze
    const hazeGeom = new THREE.CylinderGeometry(180, 200, 60, 32, 1, true);
    const hazeMat = new THREE.ShaderMaterial({
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
        varying vec3 vWorldPos;
        varying vec2 vUv;
        
        void main() {
          // Height-based fade
          float heightFade = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
          
          vec3 hazeColor = vec3(0.55, 0.65, 0.75);
          float alpha = heightFade * 0.15;
          
          gl_FragColor = vec4(hazeColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const haze = new THREE.Mesh(hazeGeom, hazeMat);
    haze.position.y = 15;
    scene.add(haze);
  }
}
