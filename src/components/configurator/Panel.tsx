"use client";
import { useState } from "react";
import { useConfig } from "./ConfigContext";
import RailIcon from "./RailIcon";
import {
  COLORS, COLOR_KEYS, CROPS, CROP_KEYS, FIELDS, Field, LEVEL_LABEL, ORIENTS, RAILS, RAIL_KEYS, VERSIONS, VERSION_KEYS,
  attachShort, checks, compute, displayValue, fitTiers, fmt, maxCount, recapRows, summaryText, totalSites, towerH,
} from "@/lib/config";
import Link from "next/link";

/* ---------- Champ numérique : curseur + saisie ---------- */
function NumField({ f }: { f: Field }) {
  const { config, setNumber } = useConfig();
  const v = displayValue(config, f);
  const max = f.k === "count" ? maxCount(config) : f.max;
  const id = `f-${f.k}`;
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[0.92rem] font-medium">{f.label}</label>
        <span className="inline-flex items-center gap-1 rounded-md border border-stone-3 bg-paper pl-1 pr-2">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={f.min}
            max={max}
            step={f.step}
            value={v}
            onChange={(e) => setNumber(f.k, e.target.value)}
            className="w-16 bg-transparent py-1 text-right text-[0.9rem] font-semibold tnum focus:outline-none"
            aria-label={f.label}
          />
          {f.unit && <span className="text-[0.76rem] text-iron-3">{f.unit}</span>}
        </span>
      </div>
      <input type="range" min={f.min} max={max} step={f.step} value={v} onChange={(e) => setNumber(f.k, e.target.value)} aria-label={f.label} />
      {f.k === "tiers" && (
        <span className="text-[0.8rem] text-iron-3">Hauteur totale : {fmt(towerH(config.tiers) * 100)} cm · {totalSites(config.tiers)} sites de culture</span>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-3 text-[0.8rem] font-semibold text-iron-2">{title}</legend>
      {children}
    </fieldset>
  );
}

/* ---------- Étape 1 : balcon ---------- */
export function StepBalcon() {
  const { config, set } = useConfig();
  return (
    <div className="grid gap-7">
      <Group title="Votre garde-corps">
        <div className="grid grid-cols-3 gap-2">
          {RAIL_KEYS.map((k) => (
            <button key={k} type="button" aria-pressed={config.rail === k} onClick={() => set("rail", k)} className="grid justify-items-center gap-1.5 rounded-md border border-stone-3 bg-paper px-1.5 py-2.5 text-center text-[0.78rem] font-medium leading-tight transition-[border-color,background-color,transform] duration-150 ease-[var(--ease-out)] hover:border-iron-3 active:scale-[0.97] aria-pressed:border-leaf aria-pressed:bg-leaf/10">
              <RailIcon kind={k} className={`h-9 w-[52px] ${config.rail === k ? "text-leaf-2" : "text-iron-3"}`} />
              <span>{RAILS[k].short}</span>
            </button>
          ))}
        </div>
      </Group>
      <Group title="Balcon">
        <div className="seg">
          <button type="button" aria-pressed={config.kind === "ouvert"} onClick={() => set("kind", "ouvert")}>Ouvert</button>
          <button type="button" aria-pressed={config.kind === "loggia"} onClick={() => set("kind", "loggia")}>Loggia (murs latéraux)</button>
        </div>
        {FIELDS.filter((f) => f.group === "dims").map((f) => <NumField key={f.k} f={f} />)}
      </Group>
      <Group title="Votre grille">
        {FIELDS.filter((f) => f.group === "rail" && f.rail === config.rail).map((f) => <NumField key={f.k} f={f} />)}
      </Group>
      <Group title="Orientation">
        <div className="seg">
          {ORIENTS.map((o) => (
            <button key={o.k} type="button" aria-pressed={config.orient === o.k} onClick={() => set("orient", o.k)} title={o.name} className="tnum">{o.k}</button>
          ))}
        </div>
      </Group>
      <Group title="Environnement">
        {FIELDS.filter((f) => f.group === "env").map((f) => <NumField key={f.k} f={f} />)}
        <label className="flex items-center justify-between gap-3 text-[0.92rem] font-medium">
          Une prise électrique sur le balcon
          <input type="checkbox" checked={config.outlet} onChange={(e) => set("outlet", e.target.checked)} className="size-5 accent-leaf" />
        </label>
      </Group>
    </div>
  );
}

/* ---------- Étape 2 : tour ---------- */
export function StepTour() {
  const { config, set, patch } = useConfig();
  return (
    <div className="grid gap-7">
      <Group title="Hauteur et position">
        {FIELDS.filter((f) => f.group === "tower").map((f) => <NumField key={f.k} f={f} />)}
        <button type="button" onClick={() => patch({ tiers: fitTiers(config) })} className="justify-self-start rounded-md border border-dashed border-leaf px-2.5 py-1.5 text-[0.82rem] font-semibold text-leaf-2 hover:bg-leaf/10">
          Caler la hauteur sur mon garde-corps
        </button>
      </Group>
      <Group title="Énergie">
        <div className="grid gap-2">
          {VERSION_KEYS.map((k) => (
            <button key={k} type="button" aria-pressed={config.version === k} onClick={() => set("version", k)} className="grid gap-0.5 rounded-md border border-stone-3 bg-paper px-3.5 py-3 text-left transition-colors hover:border-iron-3 aria-pressed:border-leaf aria-pressed:bg-leaf/10">
              <span className="display text-[1.05rem] font-bold">{VERSIONS[k].name} <span className="ml-1 text-[0.78rem] font-medium text-iron-3">{VERSIONS[k].tag}</span></span>
              <span className="text-[0.84rem] text-iron-2">{VERSIONS[k].line}</span>
              {k === "appel" && !config.outlet && <span className="text-[0.8rem] font-semibold text-signal">Pas de prise sur votre balcon</span>}
            </button>
          ))}
        </div>
      </Group>
      <Group title="Cultures">
        <div className="seg">
          {CROP_KEYS.map((k) => (
            <button key={k} type="button" aria-pressed={config.crop === k} onClick={() => set("crop", k)}>{CROPS[k].name}</button>
          ))}
        </div>
        <p className="text-[0.84rem] text-iron-3">{CROPS[config.crop].hint}</p>
        <label className="flex items-center justify-between gap-3 text-[0.92rem] font-medium">
          Réserver des places aux fleurs pour les pollinisateurs
          <input type="checkbox" checked={config.pollin} onChange={(e) => set("pollin", e.target.checked)} className="size-5 shrink-0 accent-leaf" />
        </label>
      </Group>
      <Group title="Coloris">
        <div className="flex flex-wrap items-center gap-2.5">
          {COLOR_KEYS.map((k) => (
            <button key={k} type="button" aria-pressed={config.color === k} aria-label={COLORS[k].name} onClick={() => set("color", k)} style={{ background: COLORS[k].css }} className="size-9 rounded-full border-2 border-stone-3 transition-[border-color,transform] duration-120 ease-[var(--ease-out)] hover:border-iron-3 active:scale-[0.96] aria-pressed:border-iron aria-pressed:shadow-[inset_0_0_0_3px_var(--color-paper)]" />
          ))}
          <span className="text-[0.86rem] text-iron-2">
            {COLORS[config.color].name}
            {COLORS[config.color].note && <span className="text-iron-3"> · {COLORS[config.color].note}</span>}
          </span>
        </div>
      </Group>
    </div>
  );
}

/* ---------- Étape 3 : récap ---------- */
export function StepRecap() {
  const { config } = useConfig();
  const r = compute(config);
  const rows = recapRows(config, r);
  const list = checks(config, r);
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const copy = async () => {
    try { await navigator.clipboard.writeText(summaryText(config)); setCopied("ok"); }
    catch { setCopied("fail"); }
  };
  const blocking = list.some((x) => x[0] === "bad");
  return (
    <div className="grid gap-7">
      <div>
        <h3 className="mb-3 text-[1.3rem] font-bold">Votre tour sur mesure</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.9rem]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-iron-3">{k}</dt>
              <dd className="min-w-0 font-semibold [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <p className="mb-3 text-[0.8rem] font-semibold text-iron-2">Points de vigilance</p>
        <ul className="grid gap-2">
          {list.map(([lvl, txt], i) => (
            <li key={i} className="grid grid-cols-[auto_1fr] items-start gap-2.5 rounded-md border border-stone-3 bg-stone/60 px-3 py-2.5 text-[0.88rem]">
              <span className={`mt-0.5 rounded-full px-2 py-1 text-[0.64rem] font-bold uppercase tracking-wide ${lvl === "ok" ? "bg-leaf/15 text-leaf-2" : lvl === "warn" ? "bg-amber/15 text-amber" : "bg-signal/12 text-signal"}`}>{LEVEL_LABEL[lvl]}</span>
              <span>{txt}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-2">
        <Link href="/reservation" aria-disabled={blocking} className="btn btn-primary">Réserver cette configuration</Link>
        {blocking && <p className="text-[0.84rem] text-signal">Corrigez le point bloquant ci-dessus avant de réserver.</p>}
        <button type="button" onClick={copy} className="btn btn-ghost">Copier le récapitulatif</button>
        <p className="min-h-5 text-[0.84rem] text-leaf-2" aria-live="polite">
          {copied === "ok" && "Récapitulatif copié."}
          {copied === "fail" && "Copie impossible sur ce navigateur : sélectionnez le texte ci-dessus."}
        </p>
      </div>
      <p className="border-t border-stone-3 pt-4 text-[0.88rem] text-iron-2">
        Le prix sera communiqué à l&rsquo;ouverture des ventes. La réservation ne vous engage à rien : elle garde votre configuration et votre place dans la file.
      </p>
    </div>
  );
}

/* ---------- Barre de mesures sous la vue 3D ---------- */
export function Metrics() {
  const { config } = useConfig();
  const r = compute(config);
  const n = config.count;
  const items: [string, string, string][] = [
    ["Hauteur", `${fmt(r.th * 100)} cm`, `${config.tiers} étages${n > 1 ? ` × ${n}` : ""}`],
    ["Plants", `${r.plants * n}`, r.flowers ? `dont ${r.flowers * n} pour les pollinisateurs` : `sur ${totalSites(config.tiers) * n} sites`],
    ["Attache", attachShort(config), RAILS[config.rail].name.toLowerCase()],
    ["Eau en été", `${r.waterDays} jours`, "entre deux remplissages"],
    ["Énergie", r.energy, r.energySub],
  ];
  return (
    <div className="grid grid-cols-2 border-t border-stone-3 bg-paper md:grid-cols-5" aria-live="polite">
      {items.map(([a, b, c], i) => (
        <div key={a} className={`grid gap-0.5 border-stone-3 px-3.5 py-3 md:border-r ${i === 4 ? "col-span-2 md:col-span-1 md:border-r-0" : i % 2 === 0 ? "border-r" : ""} ${i < 4 ? "border-b md:border-b-0" : ""}`}>
          <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-iron-3">{a}</span>
          <b className="display text-[1.1rem] tnum">{b}</b>
          <span className="text-[0.78rem] text-iron-2 [overflow-wrap:anywhere]">{c}</span>
        </div>
      ))}
    </div>
  );
}
