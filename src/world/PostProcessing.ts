import * as THREE from 'three';

// Full-screen quad for post-processing
class FullScreenQuad {
  public mesh: THREE.Mesh;
  
  constructor(material: THREE.Material) {
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
  }
}

export class PostProcessing {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  
  // Render targets
  private sceneRT: THREE.WebGLRenderTarget;
  private bloomRT: THREE.WebGLRenderTarget;
  private brightPassRT: THREE.WebGLRenderTarget;
  private blurRT1: THREE.WebGLRenderTarget;
  private blurRT2: THREE.WebGLRenderTarget;
  private finalRT: THREE.WebGLRenderTarget;
  
  // Materials
  private brightPassMaterial: THREE.ShaderMaterial;
  private blurMaterial: THREE.ShaderMaterial;
  private compositeMaterial: THREE.ShaderMaterial;
  
  // Quads
  private brightPassQuad: FullScreenQuad;
  private blurQuad: FullScreenQuad;
  private compositeQuad: FullScreenQuad;
  
  private width: number;
  private height: number;
  private bloomStrength = 0.4;
  private bloomThreshold = 0.7;

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.renderer = renderer;
    this.width = width;
    this.height = height;

    // Orthographic camera for post-processing
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();

    // Create render targets with high quality
    const rtOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    };

    this.sceneRT = new THREE.WebGLRenderTarget(width, height, rtOptions);
    this.bloomRT = new THREE.WebGLRenderTarget(width, height, rtOptions);
    this.brightPassRT = new THREE.WebGLRenderTarget(width / 2, height / 2, rtOptions);
    this.blurRT1 = new THREE.WebGLRenderTarget(width / 2, height / 2, rtOptions);
    this.blurRT2 = new THREE.WebGLRenderTarget(width / 2, height / 2, rtOptions);
    this.finalRT = new THREE.WebGLRenderTarget(width, height, rtOptions);

    // Bright pass material - extract bright areas
    this.brightPassMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uThreshold: { value: this.bloomThreshold },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uThreshold;
        varying vec2 vUv;
        
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
          float contribution = smoothstep(uThreshold, uThreshold + 0.3, brightness);
          gl_FragColor = vec4(color.rgb * contribution, 1.0);
        }
      `,
    });

    // Gaussian blur material
    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uResolution: { value: new THREE.Vector2(width / 2, height / 2) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uDirection;
        uniform vec2 uResolution;
        varying vec2 vUv;
        
        void main() {
          vec2 texelSize = 1.0 / uResolution;
          vec2 direction = uDirection * texelSize;
          
          vec4 result = vec4(0.0);
          
          // 9-tap Gaussian
          float weights[5];
          weights[0] = 0.227027;
          weights[1] = 0.1945946;
          weights[2] = 0.1216216;
          weights[3] = 0.054054;
          weights[4] = 0.016216;
          
          result += texture2D(tDiffuse, vUv) * weights[0];
          
          for (int i = 1; i < 5; i++) {
            vec2 offset = direction * float(i) * 2.0;
            result += texture2D(tDiffuse, vUv + offset) * weights[i];
            result += texture2D(tDiffuse, vUv - offset) * weights[i];
          }
          
          gl_FragColor = result;
        }
      `,
    });

    // Final composite material - combine scene with bloom + color grading
    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        uBloomStrength: { value: this.bloomStrength },
        uExposure: { value: 1.1 },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tScene;
        uniform sampler2D tBloom;
        uniform float uBloomStrength;
        uniform float uExposure;
        uniform float uTime;
        varying vec2 vUv;
        
        // ACES tone mapping
        vec3 ACESFilm(vec3 x) {
          float a = 2.51;
          float b = 0.03;
          float c = 2.43;
          float d = 0.59;
          float e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }
        
        // Vignette
        float vignette(vec2 uv) {
          vec2 center = uv - 0.5;
          float dist = length(center);
          return 1.0 - smoothstep(0.4, 0.9, dist);
        }
        
        // Color grading - warm highlights, cool shadows
        vec3 colorGrade(vec3 color) {
          // Lift shadows slightly blue
          vec3 shadows = vec3(0.95, 0.97, 1.02);
          // Warm highlights
          vec3 highlights = vec3(1.05, 1.0, 0.92);
          
          float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
          vec3 grade = mix(shadows, highlights, luminance);
          return color * grade;
        }
        
        void main() {
          vec3 sceneColor = texture2D(tScene, vUv).rgb;
          vec3 bloomColor = texture2D(tBloom, vUv).rgb;
          
          // Add bloom
          vec3 color = sceneColor + bloomColor * uBloomStrength;
          
          // Exposure
          color *= uExposure;
          
          // Color grading
          color = colorGrade(color);
          
          // Tone mapping
          color = ACESFilm(color);
          
          // Gamma correction
          color = pow(color, vec3(1.0 / 2.2));
          
          // Vignette
          float vig = vignette(vUv);
          color *= mix(0.7, 1.0, vig);
          
          // Subtle film grain
          float grain = fract(sin(dot(vUv * uTime * 0.01, vec2(12.9898, 78.233))) * 43758.5453);
          color += (grain - 0.5) * 0.015;
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    this.brightPassQuad = new FullScreenQuad(this.brightPassMaterial);
    this.blurQuad = new FullScreenQuad(this.blurMaterial);
    this.compositeQuad = new FullScreenQuad(this.compositeMaterial);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, time: number) {
    // 1. Render scene to texture
    this.renderer.setRenderTarget(this.sceneRT);
    this.renderer.render(scene, camera);

    // 2. Bright pass - extract bright areas
    this.brightPassMaterial.uniforms.tDiffuse.value = this.sceneRT.texture;
    this.scene.children.length = 0;
    this.scene.add(this.brightPassQuad.mesh);
    this.renderer.setRenderTarget(this.brightPassRT);
    this.renderer.render(this.scene, this.camera);

    // 3. Horizontal blur
    this.blurMaterial.uniforms.tDiffuse.value = this.brightPassRT.texture;
    this.blurMaterial.uniforms.uDirection.value.set(1, 0);
    this.scene.children.length = 0;
    this.scene.add(this.blurQuad.mesh);
    this.renderer.setRenderTarget(this.blurRT1);
    this.renderer.render(this.scene, this.camera);

    // 4. Vertical blur
    this.blurMaterial.uniforms.tDiffuse.value = this.blurRT1.texture;
    this.blurMaterial.uniforms.uDirection.value.set(0, 1);
    this.renderer.setRenderTarget(this.blurRT2);
    this.renderer.render(this.scene, this.camera);

    // 5. Second blur pass for smoother bloom
    this.blurMaterial.uniforms.tDiffuse.value = this.blurRT2.texture;
    this.blurMaterial.uniforms.uDirection.value.set(1, 0);
    this.renderer.setRenderTarget(this.blurRT1);
    this.renderer.render(this.scene, this.camera);

    this.blurMaterial.uniforms.tDiffuse.value = this.blurRT1.texture;
    this.blurMaterial.uniforms.uDirection.value.set(0, 1);
    this.renderer.setRenderTarget(this.bloomRT);
    this.renderer.render(this.scene, this.camera);

    // 6. Final composite
    this.compositeMaterial.uniforms.tScene.value = this.sceneRT.texture;
    this.compositeMaterial.uniforms.tBloom.value = this.bloomRT.texture;
    this.compositeMaterial.uniforms.uTime.value = time;
    this.scene.children.length = 0;
    this.scene.add(this.compositeQuad.mesh);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    
    this.sceneRT.setSize(width, height);
    this.bloomRT.setSize(width, height);
    this.brightPassRT.setSize(width / 2, height / 2);
    this.blurRT1.setSize(width / 2, height / 2);
    this.blurRT2.setSize(width / 2, height / 2);
    this.finalRT.setSize(width, height);
    
    this.blurMaterial.uniforms.uResolution.value.set(width / 2, height / 2);
  }

  dispose() {
    this.sceneRT.dispose();
    this.bloomRT.dispose();
    this.brightPassRT.dispose();
    this.blurRT1.dispose();
    this.blurRT2.dispose();
    this.finalRT.dispose();
    this.brightPassMaterial.dispose();
    this.blurMaterial.dispose();
    this.compositeMaterial.dispose();
  }
}
