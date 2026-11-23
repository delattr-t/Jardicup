/* Chargement du vrai modèle de la tour (export Fusion → glTF compressé) et
   découpage en modules réutilisables par le configurateur :
   réservoir, étage 4 trous, étage 3 trous, chute + toit, panneau solaire.

   Repère des modules : Y vers le haut, sol à y=0, platine d'appui (dos) à z=0
   contre le garde-corps, logements de culture sur les côtés (±x), façade vers −z.
   Passage Fusion → scène : x = −x_f, y = z_f − sol, z = y_f − platine. */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/* Cotes mesurées sur l'assemblage v14 (mètres). */
export const TOWER = {
  groundZ: 0.088, // bas du réservoir dans le repère Fusion
  backY: 0.211, // face de la platine d'appui des étages (repère Fusion, +Y)
  baseH: 0.251, // réservoir + capuchon
  tierPitch: 0.132, // pas d'empilement des étages
  tier0Z: 0.319, // bas du premier étage (repère Fusion)
  capH: 0.083, // chute + toit au-dessus du dernier étage
  mastTop: 0.964, // haut du mât du panneau pour 4 étages (depuis le sol)
};

export type PartName = "base" | "tier4" | "tier3" | "cap" | "panel";
export interface TowerParts {
  base: THREE.Group;
  tier4: THREE.Group;
  tier3: THREE.Group;
  cap: THREE.Group;
  panel: THREE.Group;
}

/* Logements de culture de chaque étage : position de l'embouchure dans le repère
   du module (origine = bas de l'étage, dos à z=0) et direction de sortie. */
export interface Cup {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
}
const cupAt = (xf: number, yf: number, h: number, dir: [number, number, number]): Cup => ({
  pos: new THREE.Vector3(-xf, h, yf - TOWER.backY),
  dir: new THREE.Vector3(...dir).normalize(),
});
/* Embouchures mesurées sur le maillage (repère Fusion, hauteur depuis le bas du module).
   Étage « 4 trous » : façade + deux côtés ; étage « 3 trous » : deux côtés
   (le trou restant est l'ouverture de la platine arrière). */
export const CUPS: Record<"tier4" | "tier3", Cup[]> = {
  tier4: [cupAt(0, -0.03, 0.108, [0, 0.6, -1]), cupAt(-0.115, 0.04, 0.122, [1, 0.6, -0.25]), cupAt(0.115, 0.04, 0.122, [-1, 0.6, -0.25])],
  tier3: [cupAt(-0.105, 0.0, 0.126, [1, 0.6, -0.25]), cupAt(0.105, 0.0, 0.126, [-1, 0.6, -0.25])],
};
export const sitesPerTier = (i: number) => (i % 2 === 0 ? 3 : 2);

let promise: Promise<TowerParts> | null = null;

/* gltfpack quantifie positions et normales en entiers : on repasse en flottants
   (en respectant la normalisation) avant toute transformation en place. */
function toFloat(src: THREE.BufferGeometry) {
  const geo = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const a = src.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!a) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  if (src.index) geo.setIndex(src.index.clone());
  return geo;
}

/** Charge le modèle une seule fois ; les géométries sont partagées entre les clones. */
export function loadTowerParts(url = "/models/tour.glb"): Promise<TowerParts> {
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      url,
      (gltf) => {
        const inner = gltf.scene;
        inner.rotation.x = -Math.PI / 2; // Z-up Fusion → Y-up
        const root = new THREE.Group();
        root.rotation.y = Math.PI; // platine d'appui vers +z (garde-corps)
        root.add(inner);
        root.updateMatrixWorld(true);
        // décalage global : sol à y=0, platine à z=0
        const shift = new THREE.Matrix4().makeTranslation(0, -TOWER.groundZ, -TOWER.backY);
        // GLTFLoader réécrit les noms (espaces, deux-points…) : on compare des versions normalisées
        const norm = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");
        // les composants sont les enfants directs du nœud d'assemblage
        let assembly: THREE.Object3D | null = null;
        root.traverse((o) => { if (!assembly && norm(o.name).startsWith("assemblagetour")) assembly = o; });
        const components = (assembly as THREE.Object3D | null)?.children ?? [];
        const take = (names: string[], originY = 0) => {
          const g = new THREE.Group();
          const wanted = names.map(norm);
          components.filter((o) => wanted.includes(norm(o.name))).forEach((o) => {
            o.traverse((m) => {
              const mesh = m as THREE.Mesh;
              if (!mesh.isMesh) return;
              const geo = toFloat(mesh.geometry);
              geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(shift, mesh.matrixWorld));
              geo.translate(0, -originY, 0);
              const matName = (mesh.material as THREE.Material).name || "";
              const out = new THREE.Mesh(geo);
              out.castShadow = out.receiveShadow = true;
              out.userData.mat = /steel/i.test(matName) ? "steel" : "body";
              g.add(out);
            });
          });
          return g;
        };
        const tierY = (i: number) => TOWER.tier0Z - TOWER.groundZ + i * TOWER.tierPitch;
        const parts: TowerParts = {
          base: take(["bac_eau_pr v12:1", "Capuchon_old_version v4:1", "boite_batterie v3:1", "couvercle_batterie v1:1"]),
          tier4: take(["etage_base_4t v17:1"], tierY(0)),
          tier3: take(["etage_base_3_trous v20:1"], tierY(1)),
          cap: take(["chute_tour v4:1", "toit_tour v2:1"], tierY(4)),
          panel: take(["PANNEAU SOLAIRE v5:1"], tierY(4)),
        };
        // le panneau : corps sombre (une seule pièce dans l'export)
        parts.panel.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.userData.mat = "panel"; });
        // le mât du panneau est exporté avec le toit : on le déplace vers le module panneau
        for (const m of [...parts.cap.children] as THREE.Mesh[]) {
          m.geometry.computeBoundingBox();
          const b = m.geometry.boundingBox!;
          if (b.max.x - b.min.x < 0.03 && b.max.y - b.min.y > 0.08) { parts.cap.remove(m); m.userData.mat = "steel"; parts.panel.add(m); }
        }
        resolve(parts);
      },
      undefined,
      (e) => { console.warn("Modèle de la tour indisponible, rendu simplifié conservé", e); promise = null; reject(e); },
    );
  });
  return promise;
}

/** Hauteur hors tout (sans panneau) pour n étages. */
export const modelTowerH = (n: number) => TOWER.tier0Z - TOWER.groundZ + n * TOWER.tierPitch + TOWER.capH + 0.01;

/** Clone léger d'un module : mêmes géométries, matériaux appliqués selon userData.mat. */
export function instance(part: THREE.Group, mats: { body: THREE.Material; steel: THREE.Material; panel: THREE.Material }) {
  const g = new THREE.Group();
  part.children.forEach((c) => {
    const src = c as THREE.Mesh;
    const m = new THREE.Mesh(src.geometry, mats[(src.userData.mat as keyof typeof mats) || "body"]);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  });
  return g;
}
