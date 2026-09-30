import * as THREE from 'three';
import { TerrainGenerator } from './TerrainGenerator';

export class PlayerController {
  private camera: THREE.PerspectiveCamera;
  private container: HTMLElement;
  private terrain: TerrainGenerator;

  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private moveSpeed = 12;
  private glideSpeed = 25;
  private riseSpeed = 8;
  private damping = 0.9;
  private mouseSensitivity = 0.002;
  private touchSensitivity = 0.004;

  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private keys: Record<string, boolean> = {};
  private isPointerLocked = false;

  private headBob = 0;
  private headBobSpeed = 0;
  private cameraBaseY = 3;

  // Mobile input
  private mobileMove = new THREE.Vector2(0, 0);
  private mobileRising = false;
  private mobileGliding = false;

  constructor(camera: THREE.PerspectiveCamera, container: HTMLElement, terrain: TerrainGenerator) {
    this.camera = camera;
    this.container = container;
    this.terrain = terrain;

    // Set initial camera position
    const startHeight = terrain.getTerrainHeightAt(0, 30);
    this.camera.position.set(0, startHeight + this.cameraBaseY, 30);

    // Event listeners
    container.addEventListener('click', this.onPointerLock);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
  }

  // Mobile control interface
  setMobileMove(x: number, y: number) {
    this.mobileMove.set(x, y);
  }

  setMobileLook(dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;
    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= dx * this.touchSensitivity;
    this.euler.x -= dy * this.touchSensitivity;
    this.euler.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  setMobileAction(action: 'rise' | 'glide' | null) {
    this.mobileRising = action === 'rise';
    this.mobileGliding = action === 'glide';
  }

  private onPointerLock = () => {
    if (!this.isPointerLocked) {
      this.container.requestPointerLock();
    }
  };

  private onPointerLockChange = () => {
    this.isPointerLocked = document.pointerLockElement === this.container;
  };

  private onMouseMove = (event: MouseEvent) => {
    if (!this.isPointerLocked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= movementX * this.mouseSensitivity;
    this.euler.x -= movementY * this.mouseSensitivity;
    this.euler.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.euler.x));

    this.camera.quaternion.setFromEuler(this.euler);
  };

  private onKeyDown = (event: KeyboardEvent) => {
    this.keys[event.code] = true;
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys[event.code] = false;
  };

  update(delta: number) {
    // Movement direction
    this.direction.set(0, 0, 0);

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Keyboard input
    if (this.keys['KeyW'] || this.keys['ArrowUp']) this.direction.add(forward);
    if (this.keys['KeyS'] || this.keys['ArrowDown']) this.direction.sub(forward);
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.direction.sub(right);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) this.direction.add(right);

    // Mobile input
    if (this.mobileMove.length() > 0.1) {
      this.direction.addScaledVector(forward, this.mobileMove.y);
      this.direction.addScaledVector(right, this.mobileMove.x);
    }

    if (this.direction.length() > 0) {
      this.direction.normalize();
    }

    // Speed
    const isGliding = this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.mobileGliding;
    const speed = isGliding ? this.glideSpeed : this.moveSpeed;

    // Apply movement
    this.velocity.x += this.direction.x * speed * delta;
    this.velocity.z += this.direction.z * speed * delta;

    // Rise/fall
    const isRising = this.keys['Space'] || this.mobileRising;
    if (isRising) {
      this.velocity.y += this.riseSpeed * delta;
    } else {
      // Gentle gravity towards terrain height + offset
      const terrainHeight = this.terrain.getTerrainHeightAt(
        this.camera.position.x,
        this.camera.position.z
      );
      const targetY = terrainHeight + this.cameraBaseY;
      const heightDiff = targetY - this.camera.position.y;
      this.velocity.y += heightDiff * 2 * delta;
    }

    // Damping
    this.velocity.multiplyScalar(this.damping);

    // Apply velocity
    this.camera.position.add(this.velocity.clone().multiplyScalar(delta * 60));

    // Keep above terrain
    const terrainHeight = this.terrain.getTerrainHeightAt(
      this.camera.position.x,
      this.camera.position.z
    );
    const minY = terrainHeight + 1.5;
    if (this.camera.position.y < minY) {
      this.camera.position.y = minY;
      this.velocity.y = 0;
    }

    // Head bob when moving
    const isMoving = this.direction.length() > 0.1;
    if (isMoving) {
      this.headBobSpeed += delta * (isGliding ? 6 : 4);
      this.headBob = Math.sin(this.headBobSpeed) * 0.08;
    } else {
      this.headBob *= 0.95;
      this.headBobSpeed *= 0.98;
    }
    this.camera.position.y += this.headBob;

    // Boundary clamping
    const boundary = 90;
    this.camera.position.x = Math.max(-boundary, Math.min(boundary, this.camera.position.x));
    this.camera.position.z = Math.max(-boundary, Math.min(boundary, this.camera.position.z));
    this.camera.position.y = Math.min(this.camera.position.y, 60);
  }

  dispose() {
    this.container.removeEventListener('click', this.onPointerLock);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
  }
}
