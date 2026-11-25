// Small separate renderer for menu thumbnails and the live shop preview.
import * as THREE from 'three';

export class Preview {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
  private holder = new THREE.Group();
  private spin = 0;
  private current: THREE.Object3D | null = null;
  private fitHeight = 1;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(300, 300, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.className = 'preview-canvas';
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a60, 1.6));
    const d = new THREE.DirectionalLight(0xfff2dd, 2.4); d.position.set(3, 5, 4); this.scene.add(d);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: 0x7aa04a, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.name = 'ground';
    this.holder.add(ground);
    this.scene.add(this.holder);
  }

  show(obj: THREE.Object3D, height: number, groundScale = 1) {
    if (this.current) this.holder.remove(this.current);
    this.current = obj;
    this.holder.add(obj);
    this.fitHeight = height;
    const g = this.holder.getObjectByName('ground')!;
    g.scale.setScalar(Math.max(0.6, height * 0.9) * groundScale);
    this.frame();
  }

  private frame() {
    const h = this.fitHeight;
    const dist = h * 2.6 + 0.6;
    this.camera.position.set(dist * 0.55, h * 0.75 + dist * 0.25, dist * 0.85);
    this.camera.lookAt(0, h * 0.45, 0);
  }

  render(dt: number, rotate = true) {
    if (rotate) this.spin += dt * 0.7;
    this.holder.rotation.y = 0.5 + this.spin;
    this.renderer.render(this.scene, this.camera);
  }

  snapshot(obj: THREE.Object3D, height: number, angle = 0.5, groundScale = 1): string {
    const prevSpin = this.spin;
    this.show(obj, height, groundScale);
    this.holder.rotation.y = angle;
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.holder.remove(obj);
    this.current = null;
    this.spin = prevSpin;
    return url;
  }
}
