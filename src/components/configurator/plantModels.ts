/* Plantes réalistes posées dans les logements de la tour.
   Source : laitue (pack Lettuce), aromatiques du fichier plant_598 (basilic, menthe,
   persil, ciboulette, romarin), deux bouquets mellifères composés à partir du pack
   flowers. Conversion et allègement : Blender (bpy) → glTF → gltfpack (meshopt).
   Chaque modèle : base au sol (y=0), centré en x/z, hauteur réelle en mètres. */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { toFloat } from "./towerModel";

export type PlantModelName = "laitue" | "basilic" | "menthe" | "persil" | "ciboulette" | "romarin" | "fleurs_a" | "fleurs_b";
export type PlantModels = Record<PlantModelName, THREE.Mesh[]>;

export const HERBS: PlantModelName[] = ["basilic", "persil", "ciboulette", "menthe", "romarin"];
export const FLOWERS: PlantModelName[] = ["fleurs_a", "fleurs_b"];

let promise: Promise<PlantModels> | null = null;

export function loadPlantModels(url = "/models/plantes.glb"): Promise<PlantModels> {
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      url,
      (gltf) => {
        const out = {} as PlantModels;
        gltf.scene.updateMatrixWorld(true);
        for (const child of gltf.scene.children) {
          const name = child.name as PlantModelName;
          const meshes: THREE.Mesh[] = [];
          child.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            // gltfpack quantifie les sommets et place la dé-quantification dans la matrice du nœud :
            // on repasse en flottants puis on applique la matrice monde (scène glTF = repère du modèle)
            const geo = toFloat(m.geometry);
            geo.applyMatrix4(m.matrixWorld);
            const src = m.material as THREE.MeshStandardMaterial;
            const mat = src.clone();
            mat.side = THREE.DoubleSide; // feuilles en simple plan
            if (mat.map && (src.transparent || src.alphaTest > 0 || name.startsWith("fleurs"))) {
              mat.transparent = false;
              mat.alphaTest = 0.5; // découpe nette, ombres comprises
            }
            mat.roughness = Math.max(mat.roughness ?? 0.7, 0.55);
            meshes.push(new THREE.Mesh(geo, mat));
          });
          out[name] = meshes;
        }
        resolve(out);
      },
      undefined,
      (e) => {
        console.warn("Plantes 3D indisponibles, rendu simplifié conservé", e);
        promise = null;
        reject(e);
      },
    );
  });
  return promise;
}

/** Toutes les géométries et matériaux, pour les protéger du nettoyage de scène. */
export function plantResources(p: PlantModels) {
  const res: (THREE.BufferGeometry | THREE.Material)[] = [];
  Object.values(p).forEach((list) => list.forEach((m) => { res.push(m.geometry, m.material as THREE.Material); }));
  return res;
}

/** Instance légère : mêmes géométries et matériaux, nouvel objet. */
export function plantInstance(p: PlantModels, name: PlantModelName) {
  const g = new THREE.Group();
  for (const m of p[name] ?? []) {
    const o = new THREE.Mesh(m.geometry, m.material);
    o.castShadow = true;
    o.receiveShadow = true;
    g.add(o);
  }
  return g;
}
