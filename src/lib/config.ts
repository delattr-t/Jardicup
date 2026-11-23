/* Modèle du configurateur jardicup : état, catalogue et calculs.
   Pure TypeScript, sans dépendance au DOM, pour être partagé entre la scène 3D,
   le formulaire et le récapitulatif. */

export type RailKind = "barreaux" | "vitre" | "plein" | "grillage" | "muret";
export type BalconyKind = "ouvert" | "loggia";
export type Orient = "N" | "E" | "SE" | "S" | "SO" | "O";
export type Version = "appel" | "classique" | "premium";
export type ColorKey = "sable" | "sauge" | "craie" | "ardoise" | "nuit";
export type Crop = "mix" | "aromates" | "salades" | "fraisiers";

export interface Config {
  rail: RailKind;
  kind: BalconyKind;
  /** mètres */
  W: number;
  D: number;
  H: number;
  gap: number;
  dia: number;
  glassT: number;
  plainT: number;
  maille: number;
  murH: number;
  murT: number;
  lisseD: number;
  orient: Orient;
  floor: number;
  outlet: boolean;
  tiers: number;
  count: number;
  /** 0..1 le long du garde-corps */
  pos: number;
  version: Version;
  color: ColorKey;
  crop: Crop;
  pollin: boolean;
}

export const DEFAULT_CONFIG: Config = {
  rail: "barreaux",
  kind: "ouvert",
  W: 3.0,
  D: 1.2,
  H: 1.0,
  gap: 0.1,
  dia: 0.016,
  glassT: 0.01,
  plainT: 0.04,
  maille: 0.05,
  murH: 0.55,
  murT: 0.16,
  lisseD: 0.042,
  orient: "S",
  floor: 3,
  outlet: false,
  tiers: 6,
  count: 1,
  pos: 0.35,
  version: "classique",
  color: "sable",
  crop: "mix",
  pollin: true,
};

/* ---------- Géométrie produit (prototype) ---------- */
export const FEET = 0.02,
  BASE_H = 0.25,
  TIER_H = 0.13,
  CAP_H = 0.04;
export const BASE_W = 0.32,
  BASE_DEPTH = 0.22,
  TIER_W = 0.18;
export const TOWER_SPACING = 0.42;
export const towerH = (n: number) => FEET + BASE_H + n * TIER_H + CAP_H;

/* ---------- Catalogue ---------- */
export const RAILS: Record<RailKind, { name: string; short: string; att: string }> = {
  barreaux: { name: "Barreaux verticaux", short: "Barreaux", att: "Colliers qui enserrent deux barreaux" },
  vitre: { name: "Panneau vitré", short: "Vitré", att: "Crochet en U posé sur le bord du verre" },
  plein: { name: "Panneau plein", short: "Plein", att: "Crochet en U ou étrier, selon l'épaisseur" },
  grillage: { name: "Grillage ou brise-vue", short: "Grillage", att: "Crochets répartis dans la maille" },
  muret: { name: "Muret et main courante", short: "Muret", att: "Étrier réglable posé sur la main courante" },
};
export const RAIL_KEYS = Object.keys(RAILS) as RailKind[];

export const ORIENTS: { k: Orient; name: string; deg: number }[] = [
  { k: "N", name: "Nord", deg: 0 },
  { k: "E", name: "Est", deg: 90 },
  { k: "SE", name: "Sud-est", deg: 135 },
  { k: "S", name: "Sud", deg: 180 },
  { k: "SO", name: "Sud-ouest", deg: 225 },
  { k: "O", name: "Ouest", deg: 270 },
];
export const SUN_AZ: Record<Orient, number> = { N: 180, E: 110, SE: 150, S: 180, SO: 210, O: 250 };

export const COLORS: Record<ColorKey, { hex: number; css: string; name: string; note?: string }> = {
  sable: { hex: 0xd9b48f, css: "#D9B48F", name: "Sable" },
  sauge: { hex: 0x8da588, css: "#8DA588", name: "Sauge" },
  craie: { hex: 0xe8e4da, css: "#E8E4DA", name: "Craie", note: "le plus frais au soleil" },
  ardoise: { hex: 0x6f7571, css: "#6F7571", name: "Ardoise" },
  nuit: { hex: 0x2f3a35, css: "#2F3A35", name: "Nuit" },
};
export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[];

export const CROPS: Record<Crop, { name: string; hint: string; k: number }> = {
  mix: { name: "Mélange", hint: "Aromatiques sur les étages hauts, les plus éclairés ; salades en alternance plus bas.", k: 0.14 },
  aromates: { name: "Aromatiques", hint: "Trois plants par étage : basilic, persil, ciboulette, thym.", k: 0.11 },
  salades: { name: "Salades", hint: "Deux plants puis un, en alternance, pour que les têtes ne se touchent pas.", k: 0.17 },
  fraisiers: { name: "Fraisiers", hint: "Un site sur deux, pour laisser pendre les fruits.", k: 0.2 },
};
export const CROP_KEYS = Object.keys(CROPS) as Crop[];

export const VERSIONS: Record<Version, { name: string; tag: string; line: string; bullets: string[] }> = {
  appel: {
    name: "Appel",
    tag: "Sur prise",
    line: "Branchée sur la prise du balcon. Rien d'électronique dehors.",
    bullets: ["Programmateur côté intérieur", "Adaptateur 12 V", "Aucune recharge"],
  },
  classique: {
    name: "Classique",
    tag: "Sur batterie",
    line: "Batterie LiFePO4 débrochable, rechargée à l'intérieur.",
    bullets: ["Batterie débrochable", "Recharge toutes les 2 à 4 semaines", "Carte basse consommation"],
  },
  premium: {
    name: "Premium",
    tag: "Batterie et soleil",
    line: "Batterie et panneau solaire posé au-dessus de la lisse.",
    bullets: ["Panneau 5 à 10 W", "Plus de recharge en saison au sud", "Même batterie que la Classique"],
  },
};
export const VERSION_KEYS = Object.keys(VERSIONS) as Version[];

const ORIENT_K: Record<Orient, number> = { N: 0.7, E: 0.9, O: 1.0, SE: 1.1, SO: 1.15, S: 1.2 };
const SOLAR: Record<Orient, [number, number]> = { N: [3, 6], E: [6, 12], O: [6, 12], SE: [10, 16], SO: [10, 16], S: [12, 18] };

/* ---------- Champs numériques ---------- */
export type NumKey = "W" | "D" | "H" | "gap" | "dia" | "glassT" | "plainT" | "maille" | "murH" | "murT" | "lisseD" | "floor" | "tiers" | "count" | "pos";
export interface Field {
  k: NumKey;
  label: string;
  unit: string;
  /** facteur d'affichage (m → cm = 100) */
  f: number;
  min: number;
  max: number;
  step: number;
  group: "dims" | "rail" | "env" | "tower";
  rail?: RailKind;
}
export const FIELDS: Field[] = [
  { k: "W", label: "Largeur du balcon", unit: "cm", f: 100, min: 80, max: 600, step: 5, group: "dims" },
  { k: "D", label: "Profondeur", unit: "cm", f: 100, min: 50, max: 250, step: 5, group: "dims" },
  { k: "H", label: "Hauteur du garde-corps", unit: "cm", f: 100, min: 80, max: 130, step: 1, group: "dims" },
  { k: "gap", label: "Vide entre barreaux", unit: "cm", f: 100, min: 5, max: 16, step: 0.5, group: "rail", rail: "barreaux" },
  { k: "dia", label: "Diamètre des barreaux", unit: "mm", f: 1000, min: 8, max: 40, step: 1, group: "rail", rail: "barreaux" },
  { k: "glassT", label: "Épaisseur du verre", unit: "mm", f: 1000, min: 6, max: 30, step: 1, group: "rail", rail: "vitre" },
  { k: "plainT", label: "Épaisseur du panneau", unit: "cm", f: 100, min: 1, max: 25, step: 0.5, group: "rail", rail: "plein" },
  { k: "maille", label: "Taille de la maille", unit: "cm", f: 100, min: 1, max: 12, step: 0.5, group: "rail", rail: "grillage" },
  { k: "murH", label: "Hauteur du muret", unit: "cm", f: 100, min: 20, max: 90, step: 1, group: "rail", rail: "muret" },
  { k: "murT", label: "Épaisseur du muret", unit: "cm", f: 100, min: 8, max: 30, step: 1, group: "rail", rail: "muret" },
  { k: "lisseD", label: "Diamètre de la main courante", unit: "mm", f: 1000, min: 25, max: 70, step: 1, group: "rail", rail: "muret" },
  { k: "floor", label: "Étage", unit: "", f: 1, min: 0, max: 20, step: 1, group: "env" },
  { k: "tiers", label: "Étages de culture", unit: "", f: 1, min: 3, max: 12, step: 1, group: "tower" },
  { k: "count", label: "Nombre de tours", unit: "", f: 1, min: 1, max: 4, step: 1, group: "tower" },
  { k: "pos", label: "Position le long du garde-corps", unit: "%", f: 100, min: 0, max: 100, step: 1, group: "tower" },
];
export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.k, f])) as Record<NumKey, Field>;

/* ---------- Helpers ---------- */
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const fmt = (v: number, d = 0) =>
  Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const cm = (v: number) => `${fmt(v * 100, Math.round(v * 1000) % 10 ? 1 : 0)} cm`;
export const mm = (v: number) => `${fmt(v * 1000)} mm`;

export function maxCount(c: Config) {
  return clamp(Math.floor((c.W - 0.12) / TOWER_SPACING), 1, 4);
}
export function fitTiers(c: Config) {
  return clamp(Math.ceil((c.H + 0.05 - (FEET + BASE_H + CAP_H)) / TIER_H), 3, 12);
}
export function normalize(c: Config): Config {
  return {
    ...c,
    murH: Math.min(c.murH, c.H - 0.12),
    count: clamp(c.count, 1, maxCount(c)),
    tiers: clamp(Math.round(c.tiers), 3, 12),
    pos: clamp(c.pos, 0, 1),
  };
}
export function setNum(c: Config, k: NumKey, display: number | string): Config {
  const f = FIELD_BY_KEY[k];
  let v = typeof display === "number" ? display : parseFloat(String(display).replace(",", "."));
  if (!isFinite(v)) return c;
  v = clamp(v, f.min, f.max);
  let real = v / f.f;
  if (k === "tiers" || k === "count" || k === "floor") real = Math.round(real);
  return normalize({ ...c, [k]: real });
}
export function displayValue(c: Config, f: Field) {
  return +(c[f.k] * f.f).toFixed(f.step < 1 ? 1 : 0);
}

export function railThickness(c: Config) {
  switch (c.rail) {
    case "barreaux":
      return 0.05;
    case "vitre":
      return c.glassT + 0.02;
    case "plein":
      return c.plainT;
    case "grillage":
      return 0.04;
    default:
      return c.murT;
  }
}
export function railTopY(c: Config) {
  return c.rail === "muret" ? c.H - c.lisseD / 2 : c.H;
}
export function towerXs(c: Config) {
  const group = (c.count - 1) * TOWER_SPACING;
  const margin = 0.2 + (c.kind === "ouvert" ? railThickness(c) : 0.02);
  const avail = Math.max(0, c.W - 2 * margin - group);
  const x0 = -c.W / 2 + margin + c.pos * avail;
  return { xs: Array.from({ length: c.count }, (_, i) => x0 + i * TOWER_SPACING), margin, avail };
}

export type PlantType = "salad" | "herb" | "straw" | "flower" | null;
export function layout(c: Config): PlantType[][] {
  const n = c.tiers,
    out: PlantType[][] = [];
  for (let i = 0; i < n; i++) {
    const fromTop = n - 1 - i;
    let t: PlantType[];
    const alt: PlantType[] = i % 2 === 0 ? ["salad", null, "salad"] : [null, "salad", null];
    if (c.crop === "aromates") t = ["herb", "herb", "herb"];
    else if (c.crop === "salades") t = alt;
    else if (c.crop === "fraisiers") t = i % 2 === 0 ? ["straw", null, "straw"] : [null, "straw", null];
    else t = fromTop < Math.ceil(n / 2) ? ["herb", "herb", "herb"] : alt;
    if (c.pollin && fromTop % 3 === 1) {
      const idx = t[1] !== null ? 1 : 0;
      t[idx] = "flower";
    }
    out.push(t);
  }
  return out;
}

export function attachSpec(c: Config) {
  const cmv = (v: number) => fmt(v * 100, (v * 100) % 1 ? 1 : 0);
  switch (c.rail) {
    case "barreaux": {
      const ent = c.gap + c.dia;
      if (ent > 0.17) return `2 colliers simples pour barreau Ø ${mm(c.dia)} (entraxe ${cmv(ent)} cm, trop large pour un collier double)`;
      return `2 colliers doubles pour barreaux Ø ${mm(c.dia)}, entraxe ${cmv(ent)} cm`;
    }
    case "vitre":
      return `Crochet en U, ouverture ${mm(c.glassT + 0.006)} pour un verre de ${mm(c.glassT)}`;
    case "plein":
      return c.plainT <= 0.08 ? `Crochet en U, ouverture ${cmv(c.plainT + 0.006)} cm` : `Étrier réglable pour un chaperon de ${cmv(c.plainT)} cm`;
    case "grillage":
      return c.maille < 0.02 ? `Maille de ${cmv(c.maille)} cm trop serrée pour des crochets : fixation par sangles` : `3 crochets pour maille de ${cmv(c.maille)} cm`;
    default:
      return `Étrier pour main courante Ø ${mm(c.lisseD)}, ${cmv(c.H - c.murH)} cm au-dessus du muret`;
  }
}
export function attachShort(c: Config) {
  return {
    barreaux: "Colliers",
    vitre: "Crochet en U",
    plein: c.plainT <= 0.08 ? "Crochet en U" : "Étrier",
    grillage: c.maille < 0.02 ? "Sangles" : "Crochets",
    muret: "Étrier",
  }[c.rail];
}

export interface Computed {
  L: PlantType[][];
  plants: number;
  flowers: number;
  th: number;
  waterDays: number;
  weight: number;
  passage: number;
  energy: string;
  energySub: string;
}
export function compute(c: Config): Computed {
  const L = layout(c);
  let plants = 0,
    flowers = 0;
  L.forEach((t) =>
    t.forEach((x) => {
      if (x) {
        plants++;
        if (x === "flower") flowers++;
      }
    }),
  );
  const th = towerH(c.tiers);
  const k = CROPS[c.crop].k * ORIENT_K[c.orient];
  const waterDays = clamp(Math.floor(15 / Math.max(1, plants * k)), 2, 30);
  const weight = Math.round(15 + 2.5 + c.tiers * 0.45 + (c.version === "appel" ? 0 : 1));
  const passage = c.D - 0.03 - railThickness(c) - 0.025 - BASE_DEPTH;
  let energy: string, energySub: string;
  if (c.version === "appel") {
    energy = "Secteur";
    energySub = "aucune recharge";
  } else if (c.version === "classique") {
    energy = "≈ 25 jours";
    energySub = "par charge de batterie";
  } else {
    const p = SOLAR[c.orient];
    energy = `${p[0]}–${p[1]} Wh/j`;
    energySub = "produits en été, ≈ 3 Wh/j consommés";
  }
  return { L, plants, flowers, th, waterDays, weight, passage, energy, energySub };
}

export type Level = "ok" | "warn" | "bad";
export function checks(c: Config, r: Computed): [Level, string][] {
  const out: [Level, string][] = [];
  const add = (lvl: Level, txt: string) => out.push([lvl, txt]);
  const over = r.th - c.H;
  if (c.version === "appel" && !c.outlet) add("bad", "La version Appel a besoin d'une prise sur le balcon. Choisissez Classique ou Premium, ou cochez la prise si vous en avez une.");
  if (c.version === "premium" && c.orient === "N") add("warn", "Balcon nord : le panneau produira 3 à 6 Wh par jour, à peine la consommation. La version Classique suffit sans doute.");
  if (["vitre", "plein", "muret"].includes(c.rail) && r.th < c.H - 0.04)
    add("warn", `La tour s'arrête ${fmt((c.H - r.th) * 100)} cm sous le haut du garde-corps : l'attache passera par une rallonge. Avec ${fitTiers(c)} étages, elle s'accroche directement.`);
  if (over > 0.6) add("bad", `La tour dépasse le garde-corps de ${fmt(over * 100)} cm : beaucoup de prise au vent. Restez sous 60 cm de dépassement.`);
  else if (over > 0.3 && c.floor >= 5) add("warn", `${fmt(over * 100)} cm au-dessus du garde-corps au ${c.floor}e étage : le vent y est plus fort. Une tour plus basse est plus sûre.`);
  if (c.H < 1.0) add("warn", "Garde-corps sous 1,00 m, la hauteur minimale dans le neuf. Gardez la tour à distance des zones où un enfant pourrait grimper.");
  if (c.rail === "barreaux" && c.gap > 0.11) add("warn", "Plus de 11 cm entre les barreaux : au-delà de l'écart conseillé pour la sécurité des enfants. Les colliers restent compatibles.");
  if (c.rail === "grillage" && c.maille < 0.02) add("warn", "Maille trop fine pour des crochets : la tour sera tenue par des sangles autour de la lisse.");
  if (r.passage < 0.6) add("warn", `Il reste ${fmt(Math.max(0, r.passage) * 100)} cm de passage entre la tour et la façade.`);
  if (c.color === "nuit" && ["S", "SE", "SO"].includes(c.orient)) add("warn", "Un coloris sombre en plein soleil fait chauffer le réservoir. Le coloris craie garde les racines plus fraîches.");
  if (c.orient === "N" && c.crop === "fraisiers") add("warn", "Les fraisiers manquent de soleil au nord. Salades, menthe et persil y poussent mieux.");
  if (c.orient === "N" && c.crop !== "fraisiers") add("ok", "Balcon nord : préférez salades, menthe et persil, qui supportent la mi-ombre.");
  if (!out.some((o) => o[0] !== "ok")) add("ok", "Votre balcon accueille cette tour sans adaptation particulière.");
  add("ok", "Montage côté intérieur, sans perçage, avec sangle anti-chute bouclée sur la lisse.");
  return out;
}
export const LEVEL_LABEL: Record<Level, string> = { ok: "OK", warn: "À vérifier", bad: "Bloquant" };

export function recapRows(c: Config, r: Computed): [string, string][] {
  return [
    ["Garde-corps", `${RAILS[c.rail].name}, ${fmt(c.H * 100)} cm`],
    ["Balcon", `${fmt(c.W * 100)} × ${fmt(c.D * 100)} cm, ${c.kind === "loggia" ? "loggia" : "ouvert"}, ${ORIENTS.find((o) => o.k === c.orient)!.name.toLowerCase()}, ${c.floor === 0 ? "rez-de-chaussée" : `${c.floor}e étage`}`],
    ["Tour", `${c.count > 1 ? c.count + " tours de " : ""}${c.tiers} étages, ${fmt(r.th * 100)} cm, coloris ${COLORS[c.color].name.toLowerCase()}`],
    ["Version", `${VERSIONS[c.version].name} (${VERSIONS[c.version].tag.toLowerCase()})`],
    ["Cultures", `${CROPS[c.crop].name}, ${r.plants} plants par tour${r.flowers ? `, dont ${r.flowers} pour les pollinisateurs` : ""}`],
    ["Attache", attachSpec(c)],
    ["Emprise", `${BASE_W * 100} × ${BASE_DEPTH * 100} cm par tour, ${fmt(Math.max(0, r.passage) * 100)} cm de passage`],
    ["Poids plein", `≈ ${r.weight} kg par tour, posé sur la dalle`],
    ["Eau", `remplissage tous les ≈ ${r.waterDays} jours en été`],
    ["Énergie", `${r.energy}, ${r.energySub}`],
  ];
}
export function rawDims(c: Config) {
  const base = `L ${fmt(c.W * 100)} × P ${fmt(c.D * 100)} × H ${fmt(c.H * 100)} cm`;
  const rail = {
    barreaux: `vide ${fmt(c.gap * 100, 1)} cm, barreaux Ø ${fmt(c.dia * 1000)} mm`,
    vitre: `verre ${fmt(c.glassT * 1000)} mm`,
    plein: `panneau ${fmt(c.plainT * 100, 1)} cm`,
    grillage: `maille ${fmt(c.maille * 100, 1)} cm`,
    muret: `muret ${fmt(c.murH * 100)} × ${fmt(c.murT * 100)} cm, main courante Ø ${fmt(c.lisseD * 1000)} mm`,
  }[c.rail];
  return `${base} · ${rail}`;
}
export function summaryText(c: Config) {
  const r = compute(c);
  return (
    `Configuration jardicup\n` +
    recapRows(c, r)
      .map((x) => `- ${x[0]} : ${x[1]}`)
      .join("\n") +
    `\n- Cotes brutes : ${rawDims(c)}`
  );
}

/* ---------- Persistance locale (navigateur) ---------- */
const KEY = "jardicup.config.v1";
export function loadConfig(): Config {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return normalize({ ...DEFAULT_CONFIG, ...parsed });
  } catch {
    return DEFAULT_CONFIG;
  }
}
export function saveConfig(c: Config) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* stockage indisponible : on continue sans */
  }
}
