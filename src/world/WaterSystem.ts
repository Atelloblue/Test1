import * as THREE from 'three';

const WATER_VERT = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  
  void main() {
    vUv = uv;
    
    vec3 pos = position;
    
    // Gentle wave animation
    float wave1 = sin(pos.x * 0.3 + uTime * 0.8) * 0.15;
    float wave2 = sin(pos.z * 0.2 + uTime * 0.6) * 0.1;
    float wave3 = sin((pos.x + pos.z) * 0.15 + uTime * 0.4) * 0.2;
    
    pos.y += wave1 + wave2 + wave3;
    
    // Calculate normal from waves
    float dx = cos(pos.x * 0.3 + uTime * 0.8) * 0.3 * 0.15 
             + cos((pos.x + pos.z) * 0.15 + uTime * 0.4) * 0.15 * 0.2;
    float dz = cos(pos.z * 0.2 + uTime * 0.6) * 0.2 * 0.1
             + cos((pos.x + pos.z) * 0.15 + uTime * 0.4) * 0.15 * 0.2;
    
    vNormal = normalize(vec3(-dx, 1.0, -dz));
    
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const WATER_FRAG = `
  uniform float uTime;
  uniform vec3 uCameraPos;
  
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  
  void main() {
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    
    // Fresnel effect
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
    
    // Water colors
    vec3 shallowColor = vec3(0.3, 0.6, 0.65);
    vec3 deepColor = vec3(0.05, 0.15, 0.25);
    
    // Mix based on depth (using UV as proxy)
    vec3 waterColor = mix(shallowColor, deepColor, 0.5);
    
    // Sky reflection
    vec3 skyColor = vec3(0.6, 0.75, 0.85);
    vec3 color = mix(waterColor, skyColor, fresnel * 0.6);
    
    // Specular highlights
    vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(vNormal, halfDir), 0.0), 64.0);
    color += vec3(1.0, 0.95, 0.8) * spec * 0.5;
    
    // Subtle caustics pattern
    float caustic = sin(vWorldPos.x * 2.0 + uTime) * sin(vWorldPos.z * 2.0 + uTime * 0.7);
    color += vec3(0.1, 0.15, 0.1) * max(caustic, 0.0) * 0.3;
    
    // Fog
    float fogDist = length(vWorldPos - uCameraPos);
    float fogFactor = 1.0 - exp(-fogDist * fogDist * 0.00004);
    vec3 fogColor = vec3(0.56, 0.67, 0.71);
    color = mix(color, fogColor, clamp(fogFactor, 0.0, 1.0));
    
    gl_FragColor = vec4(color, 0.85);
  }
`;

export class WaterSystem {
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uCameraPos: { value: new THREE.Vector3() },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });

    const geometry = new THREE.PlaneGeometry(200, 200, 100, 100);
    geometry.rotateX(-Math.PI / 2);

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.y = -1.5;
    scene.add(this.mesh);
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time;
  }

  updateCamera(cameraPos: THREE.Vector3) {
    this.material.uniforms.uCameraPos.value.copy(cameraPos);
  }
}
