/* Scène 3D du balcon : rendu Three.js impératif, piloté par un Config.
   La classe est instanciée par le composant React et reconstruit la scène
   à chaque changement de configuration (debounced sur rAF). */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  BASE_DEPTH, BASE_H, BASE_W, CAP_H, COLORS, Config, FEET, ORIENTS, PlantType, SUN_AZ, TIER_H, TIER_W,
  cm, fmt, layout, railThickness, railTopY, towerH, towerXs,
} from "@/lib/config";

const DEG = Math.PI / 180;

export type CamName = "iso" | "inside" | "street" | "top" | "hero";
export type CoteKey = "W" | "D" | "H" | "gap" | "murH" | "maille" | "glassT" | "plainT" | "towerH" | "pos";

export interface Cote {
  key: CoteKey | "north";
  label: string;
  text: string;
  readOnly: boolean;
  /** point 3D où ancrer l'étiquette */
  mid: THREE.Vector3;
}

export interface SceneOptions {
  theme: { scene: string; cote: string };
  initialCam?: CamName;
  onCotesChange: (cotes: Cote[]) => void;
  /** positions écran mises à jour à chaque frame : index → [x, y, visible] */
  onLabelPositions: (pos: Float32Array) => void;
}

function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BalconyScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private sun: THREE.DirectionalLight;
  private root = new THREE.Group();
  private shared = new Set<THREE.Material | THREE.BufferGeometry>();
  private MAT!: Record<string, THREE.MeshStandardMaterial>;
  private towerMats: Partial<Record<string, THREE.MeshStandardMaterial>> = {};
  private GEO!: Record<string, THREE.BufferGeometry>;
  private dCache: Record<string, THREE.BufferGeometry> = {};
  private coteMat!: THREE.LineBasicMaterial;
  private cotes: Cote[] = [];
  private showCotes = true;
  private config: Config;
  private camAnim: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; start: number; dur: number } | null = null;
  private raf = 0;
  private ro: ResizeObserver;
  private doorX = 0;
  private buildQueued = false;
  private reduced: boolean;
  private v = new THREE.Vector3();
  private labelBuf = new Float32Array(0);
  private disposed = false;

  constructor(private container: HTMLElement, initial: Config, private opts: SceneOptions) {
    this.config = initial;
    this.reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute("aria-label", "Vue 3D du balcon et de la tour");
    this.renderer.domElement.setAttribute("role", "img");
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    container.prepend(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 120);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: Math.PI * 0.495, minDistance: 0.6, maxDistance: 14, screenSpacePanning: true });
    this.controls.addEventListener("start", () => { this.camAnim = null; });

    this.scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x8c8676, 0.62));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.14));
    this.sun = new THREE.DirectionalLight(0xfff1dc, 0.95);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target, this.root);

    this.initMaterials();
    this.setTheme(opts.theme);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.build();
    this.setCam(opts.initialCam ?? "iso", true);
    this.loop();
  }

  /* ---------- API ---------- */
  setConfig(c: Config) {
    this.config = c;
    if (this.buildQueued) return;
    this.buildQueued = true;
    requestAnimationFrame(() => { this.buildQueued = false; if (!this.disposed) this.build(); });
  }
  setTheme(t: { scene: string; cote: string }) {
    this.opts.theme = t;
    this.scene.background = new THREE.Color(t.scene);
    if (this.coteMat) this.coteMat.color.set(t.cote);
  }
  setShowCotes(v: boolean) {
    this.showCotes = v;
    this.root.traverse((o) => { if ((o as THREE.LineSegments).isLineSegments) o.visible = v; });
  }
  setCam(name: CamName, instant = false) {
    const c = this.camPreset(name);
    if (instant || this.reduced) {
      this.camera.position.copy(c.p);
      this.controls.target.copy(c.t);
      this.controls.update();
      this.camAnim = null;
      return;
    }
    this.camAnim = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1: c.p, t1: c.t, start: performance.now(), dur: 650 };
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.disposeRoot();
    this.shared.forEach((x) => x.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /* ---------- matériaux ---------- */
  private mat(c: number, r = 0.8, m = 0) {
    const x = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    this.shared.add(x);
    return x;
  }
  private initMaterials() {
    const mat = this.mat.bind(this);
    this.MAT = {
      slabSide: mat(0xb9b3a8, 0.95), wall: mat(0xe6e0d6, 0.95), frame: mat(0x3a403c, 0.55, 0.3),
      metal: mat(0x2b302d, 0.45, 0.5), concrete: mat(0xc3bdb2, 0.95), clamp: mat(0x262b28, 0.55, 0.2),
      strap: mat(0xd49b3a, 0.6), pot: mat(0x1e2220, 0.85), panel: mat(0x1c2e52, 0.25, 0.35), panelFrame: mat(0xb8bdbf, 0.4, 0.6), cable: mat(0x202322, 0.6),
      leafLight: mat(0x9bcb5c, 0.7), leafMid: mat(0x5e9c3e, 0.7), leafDark: mat(0x3a722c, 0.75),
      red: mat(0xd2372b, 0.5), blue: mat(0x5a78d2, 0.6), orange: mat(0xea8a2c, 0.6), outlet: mat(0xf1efea, 0.5),
    };
    this.MAT.glass = new THREE.MeshStandardMaterial({ color: 0xbfe2ec, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide });
    this.MAT.doorGlass = new THREE.MeshStandardMaterial({ color: 0x8faab5, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.6 });
    this.shared.add(this.MAT.glass);
    this.shared.add(this.MAT.doorGlass);
    for (const k of Object.keys(COLORS)) this.towerMats[k] = mat(COLORS[k as keyof typeof COLORS].hex, 0.62);
    this.GEO = {
      ico: new THREE.IcosahedronGeometry(1, 1),
      ico2: new THREE.IcosahedronGeometry(1, 2),
      pot: new THREE.CylinderGeometry(0.026, 0.021, 0.05, 18),
    };
    Object.values(this.GEO).forEach((g) => this.shared.add(g));
    this.coteMat = new THREE.LineBasicMaterial({ color: new THREE.Color(this.opts.theme.cote), depthTest: false, transparent: true });
    this.shared.add(this.coteMat);
  }
  private dGeo(w: number, rect: number, h: number) {
    const key = `${w}|${rect}|${h}`;
    if (this.dCache[key]) return this.dCache[key];
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, rect); s.absarc(0, rect, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 30 });
    g.rotateX(-Math.PI / 2);
    this.shared.add(g);
    this.dCache[key] = g;
    return g;
  }
  private mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, shadow = true) {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    if (shadow) { o.castShadow = true; o.receiveShadow = true; }
    return o;
  }
  private box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

  private resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  private disposeRoot() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !this.shared.has(m.geometry)) m.geometry.dispose();
      const mat = m.material as THREE.MeshStandardMaterial | undefined;
      if (mat && !this.shared.has(mat)) { mat.map?.dispose(); mat.dispose(); }
    });
    this.scene.remove(this.root);
    this.root = new THREE.Group();
    this.scene.add(this.root);
  }

  private tileTexture(W: number, D: number) {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d")!;
    x.fillStyle = "#5C5E5C"; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = "#4A4C4A"; x.lineWidth = 3; x.strokeRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(W / 0.3, D / 0.3); t.anisotropy = 4;
    return t;
  }
  private meshTexture(L: number, H: number) {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const x = c.getContext("2d")!;
    x.clearRect(0, 0, 64, 64); x.strokeStyle = "#2B302D"; x.lineWidth = 5; x.strokeRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(L / this.config.maille, H / this.config.maille);
    return t;
  }

  /* ---------- garde-corps ---------- */
  private buildRailing(L: number, front: boolean) {
    const S = this.config, MAT = this.MAT, box = this.box;
    const g = new THREE.Group(), H = S.H;
    const info: { start?: number; pitch?: number; n?: number } = {};
    const add = (o: THREE.Object3D) => { g.add(o); return o; };
    const posts = () => {
      const n = Math.max(2, Math.ceil(L / 1.4) + 1);
      for (let i = 0; i < n; i++) {
        const x = 0.02 + (i * (L - 0.04)) / (n - 1);
        add(this.mesh(box(0.04, H, 0.04), MAT.metal, x, H / 2, 0));
      }
    };
    switch (S.rail) {
      case "barreaux": {
        posts();
        add(this.mesh(box(L, 0.04, 0.05), MAT.metal, L / 2, H - 0.02, 0));
        add(this.mesh(box(L, 0.03, 0.03), MAT.metal, L / 2, 0.085, 0));
        const pitch = S.gap + S.dia, n = Math.max(1, Math.floor((L - 0.08) / pitch)), start = (L - (n - 1) * pitch) / 2, bh = H - 0.04 - 0.1;
        const geo = new THREE.CylinderGeometry(S.dia / 2, S.dia / 2, bh, 8);
        for (let i = 0; i < n; i++) add(this.mesh(geo, MAT.metal, start + i * pitch, 0.1 + bh / 2, 0));
        Object.assign(info, { start, pitch, n });
        break;
      }
      case "vitre": {
        add(this.mesh(box(L, 0.1, 0.09), MAT.metal, L / 2, 0.05, 0));
        const gl = this.mesh(box(L - 0.01, H - 0.125, S.glassT), MAT.glass, L / 2, 0.1 + (H - 0.125) / 2, 0, false);
        gl.renderOrder = 2; add(gl);
        add(this.mesh(box(L, 0.025, S.glassT + 0.02), MAT.metal, L / 2, H - 0.0125, 0));
        break;
      }
      case "plein":
        add(this.mesh(box(L, H, S.plainT), MAT.concrete, L / 2, H / 2, 0));
        break;
      case "grillage": {
        posts();
        add(this.mesh(box(L, 0.04, 0.04), MAT.metal, L / 2, H - 0.02, 0));
        add(this.mesh(box(L, 0.03, 0.03), MAT.metal, L / 2, 0.06, 0));
        const mh = H - 0.115;
        const m = new THREE.MeshStandardMaterial({ map: this.meshTexture(L - 0.04, mh), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3, color: 0xffffff });
        add(this.mesh(new THREE.PlaneGeometry(L - 0.04, mh), m, L / 2, 0.075 + mh / 2, 0, false));
        break;
      }
      default: {
        add(this.mesh(box(L, S.murH, S.murT), MAT.concrete, L / 2, S.murH / 2, 0));
        const r = S.lisseD / 2, n = Math.max(2, Math.ceil(L / 1.2) + 1);
        for (let i = 0; i < n; i++) {
          const x = 0.04 + (i * (L - 0.08)) / (n - 1);
          add(this.mesh(new THREE.CylinderGeometry(0.012, 0.012, H - S.murH - r, 10), MAT.metal, x, S.murH + (H - S.murH - r) / 2, 0));
        }
        const hr = this.mesh(new THREE.CylinderGeometry(r, r, L, 20), MAT.metal, L / 2, H - r, 0);
        hr.rotation.z = Math.PI / 2; add(hr);
      }
    }
    if (front) g.userData = info;
    return g;
  }

  /* ---------- plantes ---------- */
  private plant(type: PlantType, r: () => number, variant: number) {
    const MAT = this.MAT, GEO = this.GEO, g = new THREE.Group();
    const leaf = (m: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number, ry = 0, rx = 0) => {
      const o = this.mesh(GEO.ico, m, x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, 0); g.add(o); return o;
    };
    if (type === "salad") {
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + r() * 0.4; leaf(k % 2 ? MAT.leafLight : MAT.leafMid, 0.04, 0.016, 0.026, Math.cos(a) * 0.03, 0.014 + (k % 3) * 0.006, Math.sin(a) * 0.03, -a, 0.35); }
      leaf(MAT.leafLight, 0.03, 0.025, 0.03, 0, 0.03, 0);
    } else if (type === "herb") {
      const m = variant % 3 === 0 ? MAT.leafDark : MAT.leafMid;
      for (let k = 0; k < 9; k++) { const a = r() * Math.PI * 2, d = r() * 0.025; leaf(m, 0.011, 0.03, 0.008, Math.cos(a) * d, 0.03 + r() * 0.035, Math.sin(a) * d, a, (r() - 0.5) * 0.8); }
    } else if (type === "straw") {
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; leaf(MAT.leafDark, 0.03, 0.01, 0.026, Math.cos(a) * 0.028, 0.022, Math.sin(a) * 0.028, -a, 0.3); }
      for (let k = 0; k < 3; k++) { const a = r() * Math.PI * 2; const f = this.mesh(GEO.ico2, MAT.red, Math.cos(a) * 0.03, -0.02 - r() * 0.03, Math.sin(a) * 0.03); f.scale.set(0.011, 0.014, 0.011); g.add(f); }
    } else {
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; leaf(MAT.leafMid, 0.022, 0.012, 0.02, Math.cos(a) * 0.022, 0.02, Math.sin(a) * 0.022, -a, 0.2); }
      const fm = variant % 2 ? MAT.orange : MAT.blue;
      for (let k = 0; k < 4; k++) { const a = r() * Math.PI * 2, d = 0.012 + r() * 0.02; const f = this.mesh(GEO.ico, fm, Math.cos(a) * d, 0.05 + r() * 0.03, Math.sin(a) * d); f.scale.set(0.013, 0.006, 0.013); g.add(f); }
    }
    return g;
  }

  /* ---------- tour ---------- */
  private segment(p1: THREE.Vector3, p2: THREE.Vector3, w: number, t: number, m: THREE.Material) {
    const d = new THREE.Vector3().subVectors(p2, p1), len = d.length();
    const o = this.mesh(this.box(w, t, len), m);
    o.position.copy(p1).addScaledVector(d, 0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
    return o;
  }
  private buildTower(x: number, zBack: number, idx: number, lay: PlantType[][]) {
    const S = this.config, MAT = this.MAT, box = this.box;
    const g = new THREE.Group(); g.position.set(x, 0, zBack);
    const tm = this.towerMats[S.color]!, n = S.tiers, th = towerH(n), r = rng(idx * 97 + n * 13 + 3);
    for (const fx of [-0.12, 0.12]) for (const fz of [-0.02, -0.18]) g.add(this.mesh(new THREE.CylinderGeometry(0.015, 0.018, FEET, 10), MAT.clamp, fx, FEET / 2, fz));
    g.add(this.mesh(this.dGeo(BASE_W, BASE_DEPTH - BASE_W / 2, BASE_H - 0.008), tm, 0, FEET + 0.004, 0));
    for (let i = 0; i < n; i++) g.add(this.mesh(this.dGeo(TIER_W, 0.03, TIER_H - 0.012), tm, 0, FEET + BASE_H + i * TIER_H + 0.006, 0));
    g.add(this.mesh(this.dGeo(TIER_W, 0.03, CAP_H - 0.012), tm, 0, FEET + BASE_H + n * TIER_H + 0.006, 0));
    const up = new THREE.Vector3(0, 1, 0), tilt = 35 * DEG, R = TIER_W / 2;
    const angles = [-52 * DEG, 0, 52 * DEG];
    lay.forEach((tier, i) => {
      const y = FEET + BASE_H + i * TIER_H + TIER_H * 0.5;
      angles.forEach((a, j) => {
        const nv = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
        const surf = new THREE.Vector3(R * Math.sin(a), y, -0.03 - R * Math.cos(a));
        const axis = nv.clone().multiplyScalar(Math.cos(tilt)).add(up.clone().multiplyScalar(Math.sin(tilt))).normalize();
        const pot = this.mesh(this.GEO.pot, MAT.pot);
        pot.position.copy(surf).addScaledVector(nv, 0.006); pot.quaternion.setFromUnitVectors(up, axis); g.add(pot);
        if (tier[j]) {
          const p = this.plant(tier[j], r, i + j);
          p.position.copy(surf).addScaledVector(nv, 0.022).addScaledVector(up, 0.022); p.rotation.y = r() * Math.PI; g.add(p);
        }
      });
    });
    // attaches (repère local : dos de la tour à z=0, garde-corps vers +z)
    const t = railThickness(S), gap = 0.025, zr = gap + t / 2, zo = gap + t, top = Math.min(th, S.H);
    if (S.rail === "barreaux") {
      const h1 = Math.min(S.H - 0.16, th - 0.09);
      for (const h of [h1, Math.max(0.32, h1 - 0.42)]) {
        g.add(this.mesh(box(0.24, 0.035, gap + t + 0.006), MAT.clamp, 0, h, (gap + t) / 2));
        g.add(this.mesh(box(0.24, 0.035, 0.012), MAT.clamp, 0, h, zo + 0.006));
      }
    } else if (S.rail === "vitre" || S.rail === "plein") {
      const yl = top - 0.12, yh = S.H + 0.015;
      for (const hx of [-0.05, 0.05]) {
        g.add(this.mesh(box(0.045, yh - yl, 0.012), MAT.clamp, hx, (yl + yh) / 2, 0.006));
        g.add(this.mesh(box(0.045, 0.012, zo + 0.012), MAT.clamp, hx, yh, (zo + 0.012) / 2));
        g.add(this.mesh(box(0.045, 0.07, 0.012), MAT.clamp, hx, S.H - 0.02, zo + 0.012));
      }
    } else if (S.rail === "grillage") {
      if (S.maille >= 0.02) {
        [top - 0.08, Math.max(0.35, top - 0.4), Math.max(0.3, top - 0.7)].forEach((h, i) => {
          if (i === 2 && top < 0.8) return;
          g.add(this.mesh(box(0.03, 0.012, zo + 0.012), MAT.clamp, 0, h, (zo + 0.012) / 2));
          g.add(this.mesh(box(0.03, 0.05, 0.01), MAT.clamp, 0, h - 0.02, zo + 0.01));
        });
      }
    } else {
      const yr = S.H - S.lisseD / 2, yl = top - 0.14;
      g.add(this.mesh(box(0.05, yr - yl, 0.012), MAT.clamp, 0, (yl + yr) / 2, 0.006));
      g.add(this.mesh(box(0.05, 0.012, zr), MAT.clamp, 0, yr, zr / 2));
      const ring = this.mesh(new THREE.TorusGeometry(S.lisseD / 2 + 0.007, 0.006, 8, 26), MAT.clamp, 0, yr, zr);
      ring.rotation.y = Math.PI / 2; g.add(ring);
    }
    // sangle anti-chute
    const ry = railTopY(S);
    g.add(this.segment(new THREE.Vector3(0.075, th - 0.06, 0.004), new THREE.Vector3(0.075, ry + 0.01, zr), 0.02, 0.004, MAT.strap));
    const loop = this.mesh(new THREE.TorusGeometry(Math.max(0.03, (S.rail === "muret" ? S.lisseD : t) / 2 + 0.012), 0.004, 6, 24), MAT.strap, 0.075, ry - 0.005, zr);
    loop.rotation.y = Math.PI / 2; g.add(loop);
    // panneau solaire
    if (S.version === "premium") {
      const py = S.H + 0.15;
      g.add(this.mesh(box(0.025, py - S.H + 0.02, 0.025), MAT.panelFrame, 0, S.H + (py - S.H) / 2, zr));
      const pg = new THREE.Group(); pg.position.set(0, py, zr + 0.02); pg.rotation.x = 35 * DEG;
      pg.add(this.mesh(box(0.26, 0.012, 0.19), MAT.panelFrame)); pg.add(this.mesh(box(0.24, 0.004, 0.17), MAT.panel, 0, 0.006, 0)); g.add(pg);
    }
    return g;
  }

  /* ---------- cotes ---------- */
  private addCote(key: CoteKey, a: THREE.Vector3, b: THREE.Vector3, text: string, label: string, tick: THREE.Vector3, offset = new THREE.Vector3(), readOnly = false) {
    const segs = [a, b, a.clone().add(tick), a.clone().sub(tick), b.clone().add(tick), b.clone().sub(tick)];
    const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs), this.coteMat);
    line.renderOrder = 10; line.visible = this.showCotes; this.root.add(line);
    this.cotes.push({ key, label, text, readOnly, mid: a.clone().add(b).multiplyScalar(0.5).add(offset) });
  }

  /* ---------- assemblage ---------- */
  private build() {
    const S = this.config, MAT = this.MAT, box = this.box;
    this.disposeRoot();
    this.cotes = [];
    const { W, D, H } = S, t = railThickness(S), zr = D - 0.03 - t / 2, zIn = zr - t / 2;
    const root = this.root;
    // dalle
    root.add(this.mesh(box(W, 0.16, D), MAT.slabSide, 0, -0.081, D / 2));
    const tile = new THREE.MeshStandardMaterial({ map: this.tileTexture(W, D), roughness: 0.9 });
    const floor = this.mesh(new THREE.PlaneGeometry(W, D), tile, 0, 0.001, D / 2, false);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);
    // façade + porte-fenêtre
    const wallH = 2.7, ext = S.kind === "loggia" ? 0.2 : 0.35, dw = Math.min(0.9, W - 0.3), dh = 2.15;
    this.doorX = W >= 2 ? -W / 2 + 0.35 + dw / 2 : 0;
    const doorX = this.doorX, L0 = -W / 2 - ext, R0 = W / 2 + ext, dl = doorX - dw / 2, dr = doorX + dw / 2;
    if (dl - L0 > 0.01) root.add(this.mesh(box(dl - L0, wallH, 0.25), MAT.wall, (L0 + dl) / 2, wallH / 2, -0.125));
    if (R0 - dr > 0.01) root.add(this.mesh(box(R0 - dr, wallH, 0.25), MAT.wall, (dr + R0) / 2, wallH / 2, -0.125));
    root.add(this.mesh(box(dw, wallH - dh, 0.25), MAT.wall, doorX, dh + (wallH - dh) / 2, -0.125));
    root.add(this.mesh(box(dw, dh, 0.02), MAT.doorGlass, doorX, dh / 2, -0.09, false));
    for (const f of [[dw, 0.05, doorX, dh - 0.025], [dw, 0.04, doorX, 0.02]]) root.add(this.mesh(box(f[0], f[1], 0.06), MAT.frame, f[2], f[3], -0.07));
    for (const x of [doorX - dw / 2 + 0.025, doorX, doorX + dw / 2 - 0.025]) root.add(this.mesh(box(0.05, dh, 0.06), MAT.frame, x, dh / 2, -0.07));
    if (S.kind === "loggia") for (const s of [-1, 1]) root.add(this.mesh(box(0.2, wallH, D), MAT.wall, s * (W / 2 + 0.1), wallH / 2, D / 2));
    // garde-corps
    const fr = this.buildRailing(W, true); fr.position.set(-W / 2, 0, zr); root.add(fr);
    if (S.kind === "ouvert") {
      const Ls = zIn - 0.02;
      for (const s of [-1, 1]) { const g = this.buildRailing(Ls, false); g.rotation.y = -Math.PI / 2; g.position.set(s * (W / 2 - 0.03 - t / 2), 0, 0.02); root.add(g); }
    }
    // tours
    const { xs } = towerXs(S), lay = layout(S), zBack = zIn - 0.025;
    xs.forEach((x, i) => root.add(this.buildTower(x, zBack, i, lay)));
    // câble Appel
    if (S.version === "appel") {
      const x0 = xs[0];
      const end = S.outlet ? new THREE.Vector3(W / 2 - 0.25, 0.3, 0.015) : new THREE.Vector3(doorX + dw / 2 - 0.07, 0.03, 0);
      const pts = [new THREE.Vector3(x0, 0.012, zBack - 0.12), new THREE.Vector3(x0, 0.012, zBack - 0.3), new THREE.Vector3((x0 + end.x) / 2, 0.012, Math.max(0.15, D * 0.4)), new THREE.Vector3(end.x, 0.012, 0.05), end];
      root.add(this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.005, 6), MAT.cable));
      if (S.outlet) root.add(this.mesh(box(0.08, 0.08, 0.03), MAT.outlet, end.x, end.y, 0.015));
    }
    // soleil
    const face = ORIENTS.find((o) => o.k === S.orient)!.deg, phi = (180 - face + SUN_AZ[S.orient]) * DEG, el = 48 * DEG;
    const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(el), Math.sin(el), -Math.cos(phi) * Math.cos(el));
    this.sun.target.position.set(0, 0.4, D / 2);
    this.sun.position.copy(this.sun.target.position).addScaledVector(dir, 9);
    const sz = Math.max(W, D) * 0.75 + 1.2;
    Object.assign(this.sun.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz, near: 1, far: 22 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.intensity = S.orient === "N" ? 0.55 : 0.95;
    // nord
    const nv = new THREE.Vector3(Math.sin(face * DEG), 0, Math.cos(face * DEG));
    const cpos = new THREE.Vector3(W / 2 + 0.55, 0, D + 0.45);
    const arrow = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([cpos.clone().addScaledVector(nv, -0.18), cpos.clone().addScaledVector(nv, 0.18)]), this.coteMat);
    arrow.visible = this.showCotes; root.add(arrow);
    this.cotes.push({ key: "north", label: "Nord", text: "N", readOnly: true, mid: cpos.clone().addScaledVector(nv, 0.3) });
    // cotes
    const X = new THREE.Vector3(0.05, 0, 0), Z = new THREE.Vector3(0, 0, 0.05), Yt = new THREE.Vector3(0, 0.05, 0);
    this.addCote("W", new THREE.Vector3(-W / 2, 0, D + 0.22), new THREE.Vector3(W / 2, 0, D + 0.22), cm(W), "Largeur du balcon", Z);
    this.addCote("D", new THREE.Vector3(W / 2 + 0.22, 0, 0), new THREE.Vector3(W / 2 + 0.22, 0, D), cm(D), "Profondeur", X);
    this.addCote("H", new THREE.Vector3(-W / 2 + 0.12, 0, D + 0.1), new THREE.Vector3(-W / 2 + 0.12, H, D + 0.1), cm(H), "Hauteur du garde-corps", X);
    const tx = xs[xs.length - 1], th = towerH(S.tiers);
    this.addCote("towerH", new THREE.Vector3(tx + 0.26, 0, zBack - 0.14), new THREE.Vector3(tx + 0.26, th, zBack - 0.14), `Tour ${cm(th)}`, "Hauteur de la tour", X);
    this.addCote("pos", new THREE.Vector3(-W / 2, 0.02, zBack - 0.32), new THREE.Vector3(xs[0], 0.02, zBack - 0.32), `axe ${cm(xs[0] + W / 2)}`, "Position de la tour depuis le bord gauche", Z);
    if (S.rail === "barreaux") {
      const info = fr.userData as { start: number; pitch: number; n: number }, i = Math.max(0, Math.floor(info.n / 2) - 1);
      const xa = -W / 2 + info.start + i * info.pitch + S.dia / 2, xb = xa + S.gap, y = H * 0.62;
      this.addCote("gap", new THREE.Vector3(xa, y, zr + 0.05), new THREE.Vector3(xb, y, zr + 0.05), `vide ${cm(S.gap)}`, "Vide entre barreaux", Yt, new THREE.Vector3(0, 0.06, 0));
    } else if (S.rail === "muret") {
      this.addCote("murH", new THREE.Vector3(W / 2 - 0.15, 0, zr + S.murT / 2 + 0.06), new THREE.Vector3(W / 2 - 0.15, S.murH, zr + S.murT / 2 + 0.06), `muret ${cm(S.murH)}`, "Hauteur du muret", X);
    } else if (S.rail === "grillage") {
      this.addCote("maille", new THREE.Vector3(W / 4, H * 0.5, zr + 0.04), new THREE.Vector3(W / 4 + S.maille, H * 0.5, zr + 0.04), `maille ${cm(S.maille)}`, "Taille de la maille", Yt, new THREE.Vector3(0, 0.06, 0));
    } else {
      const v = S.rail === "vitre" ? S.glassT : S.plainT, k: CoteKey = S.rail === "vitre" ? "glassT" : "plainT";
      this.addCote(k, new THREE.Vector3(W / 2 - 0.3, H + 0.04, zr - v / 2), new THREE.Vector3(W / 2 - 0.3, H + 0.04, zr + v / 2), S.rail === "vitre" ? `verre ${fmt(v * 1000)} mm` : `ép. ${cm(v)}`, S.rail === "vitre" ? "Épaisseur du verre" : "Épaisseur du panneau", Yt, new THREE.Vector3(0, 0.08, 0));
    }
    this.labelBuf = new Float32Array(this.cotes.length * 3);
    this.opts.onCotesChange(this.cotes);
  }

  /* ---------- caméra ---------- */
  private camPreset(name: CamName) {
    const S = this.config, { W, D } = S, s = Math.max(W, D, 2), { xs } = towerXs(S), tx = xs[0];
    switch (name) {
      case "inside": return { p: new THREE.Vector3(this.doorX, 1.55, 0.12), t: new THREE.Vector3(tx * 0.6, 0.75, D) };
      case "street": return { p: new THREE.Vector3(tx * 0.4, 1.25, D + s * 1.15), t: new THREE.Vector3(tx * 0.4, 0.7, D - 0.2) };
      case "top": return { p: new THREE.Vector3(0, s * 1.55, D / 2 + 0.01), t: new THREE.Vector3(0, 0, D / 2) };
      case "hero": return { p: new THREE.Vector3(tx + 1.6, 1.5, D + 1.9), t: new THREE.Vector3(tx + 0.1, 0.62, D - 0.2) };
      default: return { p: new THREE.Vector3(tx + s * 0.55, s * 0.38 + 0.9, D + s * 0.85), t: new THREE.Vector3(tx, 0.55, D * 0.55) };
    }
  }
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.camAnim) {
      let k = (performance.now() - this.camAnim.start) / this.camAnim.dur;
      if (k >= 1) k = 1;
      const e = 1 - Math.pow(1 - k, 3);
      this.camera.position.lerpVectors(this.camAnim.p0, this.camAnim.p1, e);
      this.controls.target.lerpVectors(this.camAnim.t0, this.camAnim.t1, e);
      if (k === 1) this.camAnim = null;
    }
    const behind = this.camera.position.z < 0.02, op = behind ? 0.18 : 1;
    const wall = this.MAT.wall;
    if (wall.opacity !== op) { wall.transparent = behind; wall.opacity = op; wall.depthWrite = !behind; wall.needsUpdate = true; }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  };
  private updateLabels() {
    const w = this.container.clientWidth, h = this.container.clientHeight, buf = this.labelBuf;
    if (!buf.length) return;
    this.cotes.forEach((c, i) => {
      this.v.copy(c.mid).project(this.camera);
      const off = this.v.z > 1 || this.v.x < -1.15 || this.v.x > 1.15 || this.v.y < -1.15 || this.v.y > 1.15;
      buf[i * 3] = (this.v.x * 0.5 + 0.5) * w;
      buf[i * 3 + 1] = (-this.v.y * 0.5 + 0.5) * h;
      buf[i * 3 + 2] = off || !this.showCotes ? 0 : 1;
    });
    this.opts.onLabelPositions(buf);
  }
}
