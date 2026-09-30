import * as THREE from 'three';

const WATER_VERT = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vFogDist;
  
  void main() {
    vUv = uv;
    
    vec3 pos = position;
    
    // Multi-layered wave animation
    float wave1 = sin(pos.x * 0.3 + uTime * 0.8) * 0.15;
    float wave2 = sin(pos.z * 0.2 + uTime * 0.6) * 0.1;
    float wave3 = sin((pos.x + pos.z) * 0.15 + uTime * 0.4) * 0.2;
    float wave4 = sin(pos.x * 0.8 + pos.z * 0.6 + uTime * 1.2) * 0.05;
    
    pos.y += wave1 + wave2 + wave3 + wave4;
    
    // Calculate normal from wave derivatives
    float dx = cos(pos.x * 0.3 + uTime * 0.8) * 0.3 * 0.15 
             + cos((pos.x + pos.z) * 0.15 + uTime * 0.4) * 0.15 * 0.2
             + cos(pos.x * 0.8 + pos.z * 0.6 + uTime * 1.2) * 0.8 * 0.05;
    float dz = cos(pos.z * 0.2 + uTime * 0.6) * 0.2 * 0.1
             + cos((pos.x + pos.z) * 0.15 + uTime * 0.4) * 0.15 * 0.2
             + cos(pos.x * 0.8 + pos.z * 0.6 + uTime * 1.2) * 0.6 * 0.05;
    
    vNormal = normalize(vec3(-dx, 1.0, -dz));
    
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vFogDist = length(worldPos.xyz - cameraPosition);
    
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const WATER_FRAG = `
  uniform float uTime;
  uniform vec3 uCameraPos;
  uniform vec3 uSunDir;
  
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vFogDist;
  
  void main() {
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    vec3 normal = normalize(vNormal);
    
    // Fresnel effect - more reflection at grazing angles
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 4.0);
    fresnel = mix(0.04, 1.0, fresnel); // Schlick approximation
    
    // Deep water colors
    vec3 shallowColor = vec3(0.15, 0.45, 0.5);
    vec3 deepColor = vec3(0.02, 0.08, 0.15);
    vec3 waterColor = mix(shallowColor, deepColor, 0.6);
    
    // Sky reflection color
    vec3 skyColor = vec3(0.5, 0.65, 0.8);
    vec3 horizonColor = vec3(0.7, 0.75, 0.8);
    float skyMix = max(normal.y, 0.0);
    vec3 reflectColor = mix(horizonColor, skyColor, skyMix);
    
    // Mix water and reflection based on fresnel
    vec3 color = mix(waterColor, reflectColor, fresnel * 0.7);
    
    // Sun specular highlight
    vec3 halfDir = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 256.0);
    float spec2 = pow(max(dot(normal, halfDir), 0.0), 32.0);
    color += vec3(1.0, 0.95, 0.8) * spec * 2.0;
    color += vec3(1.0, 0.9, 0.7) * spec2 * 0.3;
    
    // Subsurface scattering
    float sss = pow(max(dot(viewDir, -uSunDir), 0.0), 4.0);
    color += vec3(0.0, 0.15, 0.2) * sss * 0.3;
    
    // Animated caustics
    float caustic1 = sin(vWorldPos.x * 2.0 + uTime * 1.5) * sin(vWorldPos.z * 2.0 + uTime * 1.2);
    float caustic2 = sin(vWorldPos.x * 3.0 - uTime * 0.8) * sin(vWorldPos.z * 2.5 - uTime);
    float caustics = max(0.0, caustic1 * 0.5 + caustic2 * 0.3);
    color += vec3(0.1, 0.2, 0.15) * caustics * 0.4;
    
    // Edge foam (based on wave height)
    float foam = smoothstep(0.3, 0.5, sin(vWorldPos.x * 0.5 + uTime) * sin(vWorldPos.z * 0.4 + uTime * 0.7));
    color = mix(color, vec3(0.8, 0.85, 0.9), foam * 0.15);
    
    // Fog
    float fogFactor = 1.0 - exp(-vFogDist * vFogDist * 0.00003);
    vec3 fogColor = vec3(0.56, 0.67, 0.73);
    color = mix(color, fogColor, clamp(fogFactor, 0.0, 1.0));
    
    gl_FragColor = vec4(color, 0.9);
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
        uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });

    const geometry = new THREE.PlaneGeometry(200, 200, 128, 128);
    geometry.rotateX(-Math.PI / 2);

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.y = -1.5;
    scene.add(this.mesh);
  }

  update(time: number, cameraPos: THREE.Vector3, sunDir?: THREE.Vector3) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uCameraPos.value.copy(cameraPos);
    if (sunDir) {
      this.material.uniforms.uSunDir.value.copy(sunDir);
    }
  }
}
