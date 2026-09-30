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
import { PostProcessing } from './PostProcessing';
import { GodRays } from './GodRays';

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
  private postProcessing!: PostProcessing;
  private godRays!: GodRays;

  private windDirection = new THREE.Vector3(1, 0, 0.3).normalize();
  private windStrength = 0.5;
  private time = 0;
  private sunDirection = new THREE.Vector3(0.5, 0.7, 0.3).normalize();

  constructor(container: HTMLElement, onReady: () => void) {
    this.container = container;
    this.clock = new THREE.Clock();

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x8faab5, 0.006);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      65,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 15, 30);

    // Renderer with enhanced settings
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.NoToneMapping; // We handle this in post-processing
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
    this.godRays = new GodRays(this.scene, this.camera);

    // Post-processing
    this.postProcessing = new PostProcessing(
      this.renderer,
      container.clientWidth,
      container.clientHeight
    );

    // Start audio on first interaction
    const startAudio = () => {
      this.audio.start();
      container.removeEventListener('click', startAudio);
      container.removeEventListener('touchstart', startAudio);
      container.removeEventListener('keydown', startAudio);
    };
    container.addEventListener('click', startAudio);
    container.addEventListener('touchstart', startAudio);
    container.addEventListener('keydown', startAudio);

    // Handle resize
    window.addEventListener('resize', this.onResize);

    // Start animation
    setTimeout(() => {
      onReady();
      this.animate();
    }, 500);
  }

  // Public interface for mobile controls
  setMobileMove(x: number, y: number) {
    this.player.setMobileMove(x, y);
  }

  setMobileLook(dx: number, dy: number) {
    this.player.setMobileLook(dx, dy);
  }

  setMobileAction(action: 'rise' | 'glide' | null) {
    this.player.setMobileAction(action);
  }

  private initLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x6688aa, 0.5);
    this.scene.add(ambient);

    // Hemisphere light for sky/ground color
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.7);
    this.scene.add(hemi);

    // Main directional light (sun) - enhanced shadows
    const sun = new THREE.DirectionalLight(0xffeedd, 1.8);
    sun.position.set(50, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 4096;
    sun.shadow.mapSize.height = 4096;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 250;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4; // Soft shadow edges
    this.scene.add(sun);
    this.scene.add(sun.target);

    // Soft fill light
    const fill = new THREE.DirectionalLight(0x8899bb, 0.4);
    fill.position.set(-30, 20, -20);
    this.scene.add(fill);

    // Warm backlight for rim effects
    const back = new THREE.DirectionalLight(0xffddaa, 0.3);
    back.position.set(-20, 30, -50);
    this.scene.add(back);
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    this.time += delta;

    // Update wind
    this.windStrength = 0.3 + Math.sin(this.time * 0.2) * 0.2 + Math.sin(this.time * 0.05) * 0.15;
    this.windDirection.set(
      Math.cos(this.time * 0.03) * 0.5 + 0.5,
      0,
      Math.sin(this.time * 0.03) * 0.3
    ).normalize();

    // Update all systems
    this.player.update(delta);
    this.terrain.update(this.time, this.sunDirection);
    this.grass.update(this.time, this.windDirection, this.windStrength, this.sunDirection);
    this.trees.update(this.time, this.windDirection, this.windStrength, this.sunDirection);
    this.water.update(this.time, this.camera.position, this.sunDirection);
    this.windParticles.update(delta, this.windDirection, this.windStrength, this.camera.position);
    this.sky.update(this.time, this.sunDirection);
    this.environment.update(this.time);
    this.ambientParticles.update(this.time, this.camera.position);
    this.godRays.update(this.time, this.camera, this.sunDirection);
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

    // Render with post-processing
    this.postProcessing.render(this.scene, this.camera, this.time);
  };

  private onResize = () => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.postProcessing.resize(width, height);
  };

  dispose() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.onResize);
    this.audio.dispose();
    this.player.dispose();
    this.postProcessing.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
