/* Scène 3D du balcon : rendu Three.js impératif, piloté par un Config.
   La classe est instanciée par le composant React et reconstruit la scène
   à chaque changement de configuration (debounced sur rAF). */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  BASE_DEPTH, BASE_H, BASE_W, CAP_H, COLORS, Config, ORIENTS, PlantType, SUN_AZ, TIER0_Y, TIER_H, TIER_W,
  cm, fmt, layout, railThickness, towerH, towerXs,
} from "@/lib/config";
import { CUPS, TowerParts, instance, loadTowerParts } from "./towerModel";
import { FLOWERS, HERBS, PlantModels, loadPlantModels, plantInstance, plantResources } from "./plantModels";

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
  private composer: EffectComposer | null = null;
  private gtao: GTAOPass | null = null;
  private dirty = true;
  private granite: THREE.Texture | null = null;
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
  private parts: TowerParts | null = null;
  private plants: PlantModels | null = null;

  constructor(private container: HTMLElement, initial: Config, private opts: SceneOptions) {
    this.config = initial;
    this.reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    /* rendu « photo » : tons ACES, ombres douces, éclairage d'environnement */
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.domElement.setAttribute("aria-label", "Vue 3D du balcon et de la tour");
    this.renderer.domElement.setAttribute("role", "img");
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    container.prepend(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 160);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: Math.PI * 0.495, minDistance: 0.6, maxDistance: 14, screenSpacePanning: true });
    this.controls.addEventListener("start", () => { this.camAnim = null; });
    this.controls.addEventListener("change", () => { this.dirty = true; });

    // lumière du ciel (environnement) + soleil
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.55;
    this.scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x6d6a63, 0.55));
    this.sun = new THREE.DirectionalLight(0xffeccf, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = 5;
    this.sun.shadow.blurSamples = 12;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.015;
    this.scene.add(this.sun, this.sun.target, this.root);

    // post-traitement : occlusion ambiante (contact des pièces, creux des feuilles) sauf petits écrans
    const small = Math.min(window.innerWidth, window.innerHeight) < 600 || (navigator.hardwareConcurrency || 8) <= 4;
    if (!small) {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.gtao = new GTAOPass(this.scene, this.camera, 1, 1);
      this.gtao.updateGtaoMaterial({ radius: 0.22, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 16 });
      this.gtao.blendIntensity = 0.9;
      this.composer.addPass(this.gtao);
      this.composer.addPass(new OutputPass());
    }

    new THREE.TextureLoader().load("/textures/granite.jpg", (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      this.granite = t;
      if (!this.disposed) this.build();
    });

    this.initMaterials();
    this.setTheme(opts.theme);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.build();
    this.setCam(opts.initialCam ?? "iso", true);
    this.loop();
    // vrai modèle de la tour : chargé en arrière-plan, la scène est reconstruite à l'arrivée
    loadTowerParts()
      .then((p) => {
        if (this.disposed) return;
        // géométries partagées entre reconstructions : ne pas les libérer à chaque changement
        Object.values(p).forEach((grp) => grp.children.forEach((m: THREE.Object3D) => this.keep((m as THREE.Mesh).geometry)));
        this.parts = p;
        this.build();
        // puis les plantes, plus lourdes, une fois la tour affichée
        return loadPlantModels().then((pl) => {
          if (this.disposed) return;
          plantResources(pl).forEach((x) => this.keep(x));
          this.plants = pl;
          this.build();
        });
      })
      .catch(() => { /* on garde le rendu procédural */ });
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
    this.scene.background = new THREE.Color(0xe9edef); // ciel clair et voilé, comme sur les rendus
    if (this.coteMat) this.coteMat.color.set(t.cote);
    this.dirty = true;
  }
  setShowCotes(v: boolean) {
    this.showCotes = v;
    this.root.traverse((o) => { if ((o as THREE.LineSegments).isLineSegments) o.visible = v; });
    this.dirty = true;
  }
  setCam(name: CamName, instant = false) {
    const c = this.camPreset(name);
    if (instant || this.reduced) {
      this.camera.position.copy(c.p);
      this.controls.target.copy(c.t);
      this.controls.update();
      this.camAnim = null;
      this.dirty = true;
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
    this.shared.forEach((x) => { if (!this.kept.has(x)) x.dispose(); });
    this.composer?.dispose();
    this.gtao?.dispose();
    this.granite?.dispose();
    (this.scene.environment as THREE.Texture | null)?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** Ressource partagée entre scènes (cache de module) : ni libérée au rebuild, ni au démontage. */
  private kept = new Set<THREE.Material | THREE.BufferGeometry>();
  private keep(x: THREE.Material | THREE.BufferGeometry) { this.shared.add(x); this.kept.add(x); }

  /* ---------- matériaux ---------- */
  private mat(c: number, r = 0.8, m = 0) {
    const x = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    this.shared.add(x);
    return x;
  }
  private initMaterials() {
    const mat = this.mat.bind(this);
    this.MAT = {
      slabSide: mat(0xd9d3c7, 0.92), wall: mat(0xeee8dc, 0.9), frame: mat(0x2a2d2c, 0.45, 0.4),
      metal: mat(0x181a19, 0.36, 0.6), concrete: mat(0xd2ccc0, 0.92), clamp: mat(0x262b28, 0.55, 0.2),
      stone: mat(0xfbf6ec, 0.85), stoneShade: mat(0xefe8da, 0.88), winGlass: mat(0x7d8b94, 0.08, 0.7), winFrame: mat(0xffffff, 0.55), asphalt: mat(0x4a4c4d, 0.95),
      strap: mat(0xd49b3a, 0.6), pot: mat(0x1e2220, 0.85), panel: mat(0x1d3d80, 0.18, 0.45), panelFrame: mat(0xd8dcde, 0.35, 0.7), cable: mat(0x202322, 0.6),
      leafLight: mat(0x9bcb5c, 0.7), leafMid: mat(0x5e9c3e, 0.7), leafDark: mat(0x3a722c, 0.75),
      red: mat(0xd2372b, 0.5), blue: mat(0x5a78d2, 0.6), orange: mat(0xea8a2c, 0.6), outlet: mat(0xf1efea, 0.5),
    };
    this.MAT.glass = new THREE.MeshStandardMaterial({ color: 0xbfe2ec, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide });
    this.MAT.doorGlass = new THREE.MeshStandardMaterial({ color: 0x8faab5, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.6 });
    this.shared.add(this.MAT.glass);
    this.shared.add(this.MAT.doorGlass);
    for (const k of Object.keys(COLORS)) this.towerMats[k] = mat(COLORS[k as keyof typeof COLORS].hex, 0.58); // PLA mat
    this.GEO = {
      ico: new THREE.IcosahedronGeometry(1, 1),
      ico2: new THREE.IcosahedronGeometry(1, 2),
      pot: new THREE.CylinderGeometry(0.026, 0.021, 0.05, 18),
    };
    Object.values(this.GEO).forEach((g) => this.shared.add(g));
    // façade d'en face en plein soleil : légère auto-illumination chaude, comme la surexposition des rendus
    for (const k of ["stone", "stoneShade", "winFrame"]) { this.MAT[k].emissive.set(0xfff1dc); this.MAT[k].emissiveIntensity = k === "winFrame" ? 0.25 : 0.32; }
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
    if (this.composer) {
      const pr = this.renderer.getPixelRatio();
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }
  private disposeRoot() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !this.shared.has(m.geometry)) m.geometry.dispose();
      const mat = m.material as THREE.MeshStandardMaterial | undefined;
      if (mat && !this.shared.has(mat)) { if (mat.map && mat.map !== this.granite) mat.map.dispose(); mat.dispose(); }
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
        add(this.mesh(box(L, 0.05, 0.065), MAT.metal, L / 2, H - 0.025, 0));
        add(this.mesh(box(L, 0.03, 0.04), MAT.metal, L / 2, 0.085, 0));
        const pitch = S.gap + S.dia, n = Math.max(1, Math.floor((L - 0.08) / pitch)), start = (L - (n - 1) * pitch) / 2, bh = H - 0.04 - 0.1;
        const geo = box(S.dia, bh, Math.max(0.03, S.dia * 2.2)); // fer plat, comme sur les rendus
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
    const up = new THREE.Vector3(0, 1, 0);
    if (this.parts) {
      /* ----- modules réels (export Fusion) ----- */
      const mats = { body: tm, steel: MAT.panelFrame, panel: MAT.panel };
      g.add(instance(this.parts.base, mats));
      for (let i = 0; i < n; i++) {
        const tier = instance(i % 2 === 0 ? this.parts.tier4 : this.parts.tier3, mats);
        tier.position.y = TIER0_Y + i * TIER_H;
        g.add(tier);
      }
      const cap = instance(this.parts.cap, mats); cap.position.y = TIER0_Y + n * TIER_H; g.add(cap);
      if (S.version === "premium") {
        const panel = instance(this.parts.panel, { body: tm, steel: tm, panel: this.panelMat() });
        panel.position.y = TIER0_Y + n * TIER_H; g.add(panel);
      }
      lay.forEach((tier, i) => {
        const cups = CUPS[i % 2 === 0 ? "tier4" : "tier3"], y0 = TIER0_Y + i * TIER_H;
        tier.forEach((pl, j) => {
          if (!pl || !cups[j]) return;
          const c = cups[j];
          if (this.plants) {
            /* plante réaliste : pied enfoncé dans le logement, port incliné vers l'extérieur */
            const k = idx * 7 + i * 3 + j;
            const model = pl === "salad" ? "laitue" : pl === "herb" ? HERBS[k % HERBS.length] : pl === "flower" ? FLOWERS[k % FLOWERS.length] : null;
            if (model) {
              const p = plantInstance(this.plants, model);
              const out = new THREE.Vector3(c.dir.x, 0, c.dir.z).normalize();
              const lean = pl === "salad" ? 0.55 : pl === "flower" ? 0.18 : 0.32; // laitue : rosette tournée vers l'extérieur
              const axis = up.clone().multiplyScalar(1 - lean).addScaledVector(out, lean).normalize();
              const spin = new THREE.Quaternion().setFromAxisAngle(up, r() * Math.PI * 2);
              p.quaternion.setFromUnitVectors(up, axis).multiply(spin);
              p.position.copy(c.pos).addScaledVector(c.dir, pl === "salad" ? 0.0 : -0.015).add(new THREE.Vector3(0, y0 - (pl === "salad" ? 0.012 : 0.02), 0));
              const base = pl === "salad" ? 0.72 : pl === "flower" ? 0.95 : 0.92;
              p.scale.setScalar(base * (0.88 + r() * 0.24));
              g.add(p);
              return;
            }
          }
          const p = this.plant(pl, r, i + j);
          p.position.copy(c.pos).addScaledVector(c.dir, 0.014).add(new THREE.Vector3(0, y0 + 0.01, 0));
          if (pl === "herb") p.scale.setScalar(1.35);
          p.rotation.y = r() * Math.PI;
          g.add(p);
        });
      });
    } else {
      /* ----- repli procédural, le temps du chargement ----- */
      g.add(this.mesh(this.dGeo(BASE_W, BASE_DEPTH - BASE_W / 2, BASE_H - 0.008), tm, 0, 0.004, 0));
      for (let i = 0; i < n; i++) g.add(this.mesh(this.dGeo(TIER_W, 0.03, TIER_H - 0.012), tm, 0, TIER0_Y + i * TIER_H + 0.006, 0));
      g.add(this.mesh(this.dGeo(TIER_W, 0.03, CAP_H - 0.012), tm, 0, TIER0_Y + n * TIER_H + 0.006, 0));
      const tilt = 35 * DEG, R = TIER_W / 2;
      lay.forEach((tier, i) => {
        const y = TIER0_Y + i * TIER_H + TIER_H * 0.5;
        const cups = CUPS[i % 2 === 0 ? "tier4" : "tier3"];
        tier.forEach((pl, j) => {
          const c = cups[j]; if (!c) return;
          const nv = new THREE.Vector3(c.dir.x, 0, c.dir.z).normalize();
          const surf = new THREE.Vector3(R * nv.x, y, -0.03 + R * nv.z);
          if (pl) { const p = this.plant(pl, r, i + j); p.position.copy(surf).addScaledVector(nv, 0.022).addScaledVector(up, 0.022); p.rotation.y = r() * Math.PI; g.add(p); }
        });
      });
    }
    const t = railThickness(S), zr = 0.025 + t / 2;
    // panneau solaire (version procédurale seulement)
    if (S.version === "premium" && !this.parts) {
      const py = S.H + 0.15;
      g.add(this.mesh(box(0.025, py - S.H + 0.02, 0.025), MAT.panelFrame, 0, S.H + (py - S.H) / 2, zr));
      const pg = new THREE.Group(); pg.position.set(0, py, zr + 0.02); pg.rotation.x = 35 * DEG;
      pg.add(this.mesh(box(0.26, 0.012, 0.19), MAT.panelFrame)); pg.add(this.mesh(box(0.24, 0.004, 0.17), MAT.panel, 0, 0.006, 0)); g.add(pg);
    }
    return g;
  }

  /* ---------- panneau solaire : cellules monocristallines + cadre alu ---------- */
  private _panelMat: THREE.MeshStandardMaterial | null = null;
  private panelMat() {
    if (this._panelMat) return this._panelMat;
    const c = document.createElement("canvas"); c.width = 512; c.height = 512;
    const x = c.getContext("2d")!;
    x.fillStyle = "#e9ecee"; x.fillRect(0, 0, 512, 512); // cadre
    const m = 22, cols = 6, rows = 6, gw = (512 - 2 * m) / cols, gh = (512 - 2 * m) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const g = x.createLinearGradient(0, m + j * gh, 0, m + (j + 1) * gh);
      g.addColorStop(0, "#2a56b8"); g.addColorStop(1, "#173a86");
      x.fillStyle = g; x.fillRect(m + i * gw + 2, m + j * gh + 2, gw - 4, gh - 4);
      x.strokeStyle = "rgba(200,215,235,0.35)"; x.lineWidth = 1;
      for (let b = 1; b < 4; b++) { x.beginPath(); x.moveTo(m + i * gw + (b * gw) / 4, m + j * gh + 3); x.lineTo(m + i * gw + (b * gw) / 4, m + (j + 1) * gh - 3); x.stroke(); }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    this._panelMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.15, metalness: 0.35, envMapIntensity: 1.2 });
    this.shared.add(this._panelMat);
    return this._panelMat;
  }

  /* ---------- décor : rue et immeuble d'en face ---------- */
  private buildStreet(W: number, D: number, floor: number) {
    const MAT = this.MAT, box = this.box, root = this.root;
    const fl = 3.1, ground = -Math.max(0, floor) * fl - 0.2; // rez-de-chaussée sous nos pieds
    const zF = D + 12; // largeur de rue
    const width = 34, x0 = -width / 2;
    const floorsBelow = Math.max(0, floor) + 1, floorsAbove = 3;
    const y0 = ground, y1 = ground + (floorsBelow + floorsAbove) * fl;
    // chaussée + trottoirs
    const road = this.mesh(new THREE.PlaneGeometry(width * 1.5, zF - D + 6), MAT.asphalt, 0, ground, (D + zF) / 2, false);
    road.rotation.x = -Math.PI / 2; road.receiveShadow = true; root.add(road);
    // mur de la façade d'en face
    root.add(this.mesh(box(width, y1 - y0, 0.4), MAT.stone, 0, (y0 + y1) / 2, zF + 0.2, false));
    // bandeaux horizontaux (corniches) et grand balcon filant du 5e
    const nF = floorsBelow + floorsAbove;
    for (let f = 1; f <= nF; f++) {
      const y = y0 + f * fl;
      root.add(this.mesh(box(width, 0.14, 0.18), MAT.stoneShade, 0, y - 0.05, zF - 0.06, false));
    }
    // fenêtres : instanciées (vitre, encadrement, garde-corps de balconnet)
    const cols = Math.floor(width / 2.4), rows = nF;
    const nWin = cols * rows;
    const glass = new THREE.InstancedMesh(box(1.05, 2.05, 0.06), MAT.winGlass, nWin);
    const surround = new THREE.InstancedMesh(box(1.22, 2.2, 0.04), MAT.winFrame, nWin);
    const frameTop = new THREE.InstancedMesh(box(1.3, 0.22, 0.14), MAT.stoneShade, nWin);
    const balc = new THREE.InstancedMesh(box(1.25, 0.05, 0.05), MAT.metal, nWin * 2);
    const bars = new THREE.InstancedMesh(box(0.018, 0.55, 0.018), MAT.metal, nWin * 9);
    const m4 = new THREE.Matrix4();
    let k = 0, kb = 0, kr = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = x0 + 1.2 + c * 2.4 + (width - cols * 2.4) / 2, yb = y0 + r * fl + 0.55, zc = zF - 0.01;
        if (r === 0) continue; // rez-de-chaussée : vitrines plus bas, laissées pleines
        glass.setMatrixAt(k, m4.makeTranslation(x, yb + 1.02, zc - 0.005));
        surround.setMatrixAt(k, m4.makeTranslation(x, yb + 1.02, zc + 0.02));
        frameTop.setMatrixAt(k, m4.makeTranslation(x, yb + 2.18, zc - 0.05));
        for (const yy of [yb + 0.58, yb + 0.06]) balc.setMatrixAt(kb++, m4.makeTranslation(x, yy, zc - 0.22));
        for (let i = 0; i < 9; i++) bars.setMatrixAt(kr++, m4.makeTranslation(x - 0.58 + i * 0.145, yb + 0.32, zc - 0.22));
        k++;
      }
    }
    for (const im of [glass, surround, frameTop]) { im.count = k; im.instanceMatrix.needsUpdate = true; root.add(im); }
    balc.count = kb; bars.count = kr; balc.instanceMatrix.needsUpdate = true; bars.instanceMatrix.needsUpdate = true; root.add(balc, bars);
    // toit de zinc
    const roof = this.mesh(box(width, 1.4, 2.2), MAT.frame, 0, y1 + 0.5, zF + 0.9, false);
    roof.rotation.x = 0.55; root.add(roof);
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
    let tile: THREE.MeshStandardMaterial;
    if (this.granite) {
      // dalles de 60 cm : la texture en contient 5 × 5
      this.granite.repeat.set(W / 3, D / 3);
      tile = new THREE.MeshStandardMaterial({ map: this.granite, roughness: 0.62, metalness: 0.0, envMapIntensity: 0.6 });
    } else tile = new THREE.MeshStandardMaterial({ map: this.tileTexture(W, D), roughness: 0.9 });
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
    // rue et façade haussmannienne d'en face
    this.buildStreet(W, D, S.floor);
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
    this.addCote("towerH", new THREE.Vector3(tx + 0.26, 0, zBack - 0.14), new THREE.Vector3(tx + 0.26, th, zBack - 0.14), `Tour ${cm(th)}`, "Hauteur de la tour", X, new THREE.Vector3(), true);
    this.addCote("pos", new THREE.Vector3(-W / 2, 0.02, zBack - 0.32), new THREE.Vector3(xs[0], 0.02, zBack - 0.32), `axe ${cm(xs[0] + W / 2)}`, "Position de la tour depuis le bord gauche", Z);
    if (S.rail === "barreaux") {
      const info = fr.userData as { start: number; pitch: number; n: number };
      // on cote le vide loin de la tour pour que les étiquettes ne se chevauchent pas
      const txs = towerXs(S).xs, cand = Array.from({ length: info.n - 1 }, (_, j) => j);
      const i = cand.reduce((best, j) => { const xj = -W / 2 + info.start + j * info.pitch; const dj = Math.min(...txs.map((x) => Math.abs(x - xj))); const xb = -W / 2 + info.start + best * info.pitch; const db = Math.min(...txs.map((x) => Math.abs(x - xb))); return dj > db ? j : best; }, 0);
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
    this.dirty = true;
    this.opts.onCotesChange(this.cotes);
  }

  /* ---------- caméra ---------- */
  private camPreset(name: CamName) {
    const S = this.config, { W, D } = S, s = Math.max(W, D, 2), { xs } = towerXs(S), tx = xs[0];
    switch (name) {
      case "inside": return { p: new THREE.Vector3(this.doorX, 1.55, 0.12), t: new THREE.Vector3(tx * 0.6, 0.75, D) };
      case "street": return { p: new THREE.Vector3(tx * 0.4, 1.25, D + s * 1.15), t: new THREE.Vector3(tx * 0.4, 0.7, D - 0.2) };
      case "top": return { p: new THREE.Vector3(0, s * 1.55, D / 2 + 0.01), t: new THREE.Vector3(0, 0, D / 2) };
      case "hero": return { p: new THREE.Vector3(tx + 1.25, 1.45, D - 1.55), t: new THREE.Vector3(tx + 0.05, 0.6, D - 0.15) };
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
      this.dirty = true;
    }
    if (this.controls.update()) this.dirty = true; // amortissement en cours
    if (!this.dirty) return; // rendu à la demande : rien ne bouge, rien ne se recalcule
    this.dirty = false;
    const behind = this.camera.position.z < 0.02, op = behind ? 0.18 : 1;
    const wall = this.MAT.wall;
    if (wall.opacity !== op) { wall.transparent = behind; wall.opacity = op; wall.depthWrite = !behind; wall.needsUpdate = true; }
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
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
