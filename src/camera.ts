// Third-person orbit camera: click-and-drag to orbit, scroll to zoom, C to reset.
import * as THREE from 'three';
import { CollisionWorld, terrainHeight } from './terrain';

export class OrbitCam {
  camera: THREE.PerspectiveCamera;
  yaw = Math.PI;        // camera sits at target + (sin yaw, ·, cos yaw) * dist
  pitch = 0.38;
  dist = 6;
  baseDist = 6;
  private curDist = 6;
  private target = new THREE.Vector3();
  private resetAnim: { yaw: number; pitch: number; dist: number } | null = null;
  private dragging = false;
  private lastDragAt = -99;
  private lastX = 0; private lastY = 0;
  enabled = true;
  /** When set (inside your house) the camera stays inside this box. */
  room: { minX: number; maxX: number; minZ: number; maxZ: number; maxY: number; minY?: number } | null = null;
  minPitch = -0.12;
  maxPitch = 1.45;

  constructor(camera: THREE.PerspectiveCamera, el: HTMLElement) {
    this.camera = camera;
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled || e.button > 0) return;
      this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging || !this.enabled) return;
      const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.resetAnim = null;
      this.lastDragAt = performance.now() / 1000;
      this.yaw -= dx * 0.006;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.005, this.minPitch, this.maxPitch);
    });
    const end = (e: PointerEvent) => { this.dragging = false; try { el.releasePointerCapture(e.pointerId); } catch { /* */ } };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.enabled) return;
      // trackpad pinch arrives as ctrl+wheel; two-finger scroll as plain wheel
      const k = e.ctrlKey ? 0.01 : 0.0015;
      this.dist = THREE.MathUtils.clamp(this.dist * (1 + e.deltaY * k), this.baseDist * 0.45, this.baseDist * 2.4);
    }, { passive: false });
  }

  setBaseDistance(d: number) { this.baseDist = d; this.dist = d; }

  /** Smoothly return behind and slightly above the animal. */
  reset(playerYaw: number, instant = false) {
    const target = { yaw: playerYaw + Math.PI, pitch: 0.38, dist: this.baseDist };
    if (instant) { this.yaw = target.yaw; this.pitch = target.pitch; this.dist = target.dist; this.curDist = target.dist; this.resetAnim = null; }
    else this.resetAnim = target;
  }

  update(dt: number, focus: THREE.Vector3, collision: CollisionWorld) {
    if (this.resetAnim) {
      let dy = this.resetAnim.yaw - this.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      const k = Math.min(1, dt * 6);
      this.yaw += dy * k;
      this.pitch += (this.resetAnim.pitch - this.pitch) * k;
      this.dist += (this.resetAnim.dist - this.dist) * k;
      if (Math.abs(dy) < 0.01 && Math.abs(this.resetAnim.pitch - this.pitch) < 0.01) this.resetAnim = null;
    }
    // smooth follow (vertical a bit softer so jumps don't jolt the view)
    this.target.x += (focus.x - this.target.x) * Math.min(1, dt * 14);
    this.target.z += (focus.z - this.target.z) * Math.min(1, dt * 14);
    this.target.y += (focus.y - this.target.y) * Math.min(1, dt * 7);
    if (this.target.distanceToSquared(focus) > 100) this.target.copy(focus);

    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    // collision avoidance: walk out from the target and stop before terrain/trunks
    let allowed = this.dist;
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      const d = (this.dist * i) / steps;
      const px = this.target.x + dir.x * d, py = this.target.y + dir.y * d, pz = this.target.z + dir.z * d;
      const R = this.room;
      const outside = !!R && (px < R.minX || px > R.maxX || pz < R.minZ || pz > R.maxZ || py > R.maxY || py < (R.minY ?? -1e9));
      if (outside || py < terrainHeight(px, pz) + 0.35 || collision.blocked(px, pz, py, 0.25)) { allowed = Math.max(1.2, (this.dist * (i - 1)) / steps); break; }
    }
    // zoom in quickly, ease back out
    this.curDist += (allowed - this.curDist) * Math.min(1, dt * (allowed < this.curDist ? 18 : 3));
    const pos = this.target.clone().addScaledVector(dir, this.curDist);
    const minY = terrainHeight(pos.x, pos.z) + 0.4;
    if (pos.y < minY) pos.y = minY; // never look through the ground
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
  }

  /** Gently swing the camera round behind the animal while it walks. */
  followBehind(dt: number, playerYaw: number) {
    if (this.resetAnim || this.dragging) return;
    if (performance.now() / 1000 - this.lastDragAt < 1.5) return; // you just looked around: wait a moment
    let d = playerYaw + Math.PI - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) > 2.4) return; // walking toward the camera: don't spin around
    this.yaw += d * Math.min(1, dt * 2.4);
  }

  /** Horizontal forward/right vectors for camera-relative movement. */
  basis() {
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    return { f, r };
  }
}
