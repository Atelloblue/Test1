import * as THREE from 'three';
import { TerrainGenerator } from './TerrainGenerator';
import { GrassSystem } from './GrassSystem';
import { TreeSystem } from './TreeSystem';
import { WaterSystem } from './WaterSystem';
import { WindParticles } from './WindParticles';
import { SkySystem } from './SkySystem';
import { AudioManager } from './AudioManager';
import { PlayerController } from './PlayerController';
import { EnvironmentDetails } from './EnvironmentDetails';
import { DistantMountains } from './DistantMountains';
import { AmbientParticles } from './AmbientParticles';

export class WindWorld {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  private container: HTMLElement;
  private animationId: number = 0;

  private terrain!: TerrainGenerator;
  private grass!: GrassSystem;
  private trees!: TreeSystem;
  private water!: WaterSystem;
  private windParticles!: WindParticles;
  private sky!: SkySystem;
  private audio!: AudioManager;
  private player!: PlayerController;
  private environment!: EnvironmentDetails;
  private ambientParticles!: AmbientParticles;

  private windDirection = new THREE.Vector3(1, 0, 0.3).normalize();
  private windStrength = 0.5;
  private time = 0;

  constructor(container: HTMLElement, onReady: () => void) {
    this.container = container;
    this.clock = new THREE.Clock();

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x8faab5, 0.008);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      65,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 15, 30);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Initialize systems
    this.initLighting();
    this.terrain = new TerrainGenerator(this.scene);
    this.grass = new GrassSystem(this.scene, this.terrain);
    this.trees = new TreeSystem(this.scene, this.terrain);
    this.water = new WaterSystem(this.scene);
    this.windParticles = new WindParticles(this.scene);
    this.sky = new SkySystem(this.scene);
    this.audio = new AudioManager();
    this.player = new PlayerController(this.camera, container, this.terrain);
    this.environment = new EnvironmentDetails(this.scene, this.terrain);
    new DistantMountains(this.scene);
    this.ambientParticles = new AmbientParticles(this.scene);

    // Start audio on first interaction
    const startAudio = () => {
      this.audio.start();
      container.removeEventListener('click', startAudio);
      container.removeEventListener('keydown', startAudio);
    };
    container.addEventListener('click', startAudio);
    container.addEventListener('keydown', startAudio);

    // Handle resize
    window.addEventListener('resize', this.onResize);

    // Start animation
    setTimeout(() => {
      onReady();
      this.animate();
    }, 500);
  }

  private initLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x6688aa, 0.4);
    this.scene.add(ambient);

    // Hemisphere light for sky/ground color
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.6);
    this.scene.add(hemi);

    // Main directional light (sun)
    const sun = new THREE.DirectionalLight(0xffeedd, 1.5);
    sun.position.set(50, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    // Soft fill light
    const fill = new THREE.DirectionalLight(0x8899bb, 0.3);
    fill.position.set(-30, 20, -20);
    this.scene.add(fill);
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    this.time += delta;

    // Update wind
    this.windStrength = 0.3 + Math.sin(this.time * 0.2) * 0.2 + Math.sin(this.time * 0.05) * 0.1;
    this.windDirection.set(
      Math.cos(this.time * 0.03) * 0.5 + 0.5,
      0,
      Math.sin(this.time * 0.03) * 0.3
    ).normalize();

    // Update all systems
    this.player.update(delta);
    this.grass.update(this.time, this.windDirection, this.windStrength);
    this.trees.update(this.time, this.windDirection, this.windStrength);
    this.water.update(this.time);
    this.water.updateCamera(this.camera.position);
    this.windParticles.update(delta, this.windDirection, this.windStrength, this.camera.position);
    this.sky.update(this.time);
    this.environment.update(this.time);
    this.ambientParticles.update(this.time, this.camera.position);
    this.audio.update(this.windStrength);

    // Update shadow camera to follow player
    const sun = this.scene.children.find(
      (c) => c instanceof THREE.DirectionalLight && c.castShadow
    ) as THREE.DirectionalLight | undefined;
    if (sun) {
      sun.position.set(
        this.camera.position.x + 50,
        80,
        this.camera.position.z + 30
      );
      sun.target.position.copy(this.camera.position);
      sun.target.updateMatrixWorld();
    }

    this.renderer.render(this.scene, this.camera);
  };

  private onResize = () => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  dispose() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.onResize);
    this.audio.dispose();
    this.player.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
