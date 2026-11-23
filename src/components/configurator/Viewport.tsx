"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BalconyScene, CamName, Cote, CoteKey } from "./scene";
import { useConfig } from "./ConfigContext";
import { FEET, BASE_H, CAP_H, TIER_H, FIELD_BY_KEY, NumKey, clamp, towerH, towerXs } from "@/lib/config";

const CAMS: { k: CamName; label: string }[] = [
  { k: "iso", label: "3/4" },
  { k: "inside", label: "Depuis la porte-fenêtre" },
  { k: "street", label: "Depuis la rue" },
  { k: "top", label: "Dessus" },
];

interface Props {
  className?: string;
  /** masque les outils (vue d'accueil) */
  compact?: boolean;
  /** cotes affichées au départ */
  cotesDefault?: boolean;
  initialCam?: CamName;
}

export default function Viewport({ className = "", compact = false, cotesDefault = true, initialCam = "iso" }: Props) {
  const { config, setNumber, patch } = useConfig();
  const vpRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BalconyScene | null>(null);
  const labelRefs = useRef<(HTMLElement | null)[]>([]);
  const [cotes, setCotes] = useState<Cote[]>([]);
  const [cam, setCam] = useState<CamName>("iso");
  const [showCotes, setShowCotes] = useState(cotesDefault);
  const [glOK, setGlOK] = useState(true);
  const [editor, setEditor] = useState<{ key: CoteKey; x: number; y: number; label: string; unit: string; value: number } | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const onLabelPositions = useCallback((buf: Float32Array) => {
    const els = labelRefs.current;
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (!el) continue;
      const vis = buf[i * 3 + 2] > 0;
      el.style.visibility = vis ? "visible" : "hidden";
      if (vis) el.style.transform = `translate(${buf[i * 3]}px, ${buf[i * 3 + 1]}px) translate(-50%, -50%)`;
    }
  }, []);

  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    try {
      const cs = getComputedStyle(document.documentElement);
      sceneRef.current = new BalconyScene(vp, configRef.current, {
        theme: { scene: cs.getPropertyValue("--scene-bg").trim() || "#e3dfd5", cote: cs.getPropertyValue("--cote").trim() || "#1e2321" },
        onCotesChange: setCotes,
        onLabelPositions,
        initialCam,
      });
      sceneRef.current.setShowCotes(cotesDefault);
    } catch {
      setGlOK(false);
    }
    return () => { sceneRef.current?.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { sceneRef.current?.setConfig(config); setEditor(null); }, [config]);
  useEffect(() => { sceneRef.current?.setShowCotes(showCotes); }, [showCotes]);

  const openEditor = (c: Cote, el: HTMLElement) => {
    if (c.readOnly || c.key === "north") return;
    const key = c.key;
    const S = configRef.current;
    let label = c.label, unit = "cm", value = 0;
    if (key === "towerH") { label = "Hauteur de la tour (arrondie à l'étage)"; value = Math.round(towerH(S.tiers) * 100); }
    else if (key === "pos") { label = "Axe de la tour depuis le bord gauche"; value = Math.round((towerXs(S).xs[0] + S.W / 2) * 100); }
    else { const f = FIELD_BY_KEY[key as NumKey]; label = f.label; unit = f.unit; value = +(S[key as NumKey] * f.f).toFixed(1); }
    const vr = vpRef.current!.getBoundingClientRect(), ar = el.getBoundingClientRect();
    setEditor({ key, label, unit, value, x: clamp(ar.left - vr.left + ar.width / 2 - 110, 8, vr.width - 228), y: clamp(ar.bottom - vr.top + 8, 8, vr.height - 110) });
  };
  const applyEditor = (raw: string) => {
    if (!editor) return;
    const v = parseFloat(raw.replace(",", "."));
    const S = configRef.current;
    if (!isFinite(v)) { setEditor(null); return; }
    if (editor.key === "towerH") {
      const n = Math.round((v / 100 - (FEET + BASE_H + CAP_H)) / TIER_H);
      patch({ tiers: clamp(n, 3, 12) });
    } else if (editor.key === "pos") {
      const { margin, avail } = towerXs(S);
      patch({ pos: avail > 0 ? clamp((v / 100 - margin) / avail, 0, 1) : 0.5 });
    } else setNumber(editor.key as NumKey, v);
    setEditor(null);
  };
  const changeCam = (k: CamName) => { setCam(k); sceneRef.current?.setCam(k); };

  return (
    <div ref={vpRef} className={`relative overflow-hidden touch-none bg-[var(--scene-bg)] ${className}`} onPointerDown={(e) => { if (editor && !(e.target as HTMLElement).closest(".cote-editor,.cote")) setEditor(null); }}>
      {!glOK && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-iron-3">
          <p>La vue 3D ne peut pas s&rsquo;afficher sur ce navigateur. Les réglages et le récapitulatif fonctionnent quand même.</p>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {cotes.map((c, i) =>
          c.key === "north" ? (
            <span key="north" ref={(el) => { labelRefs.current[i] = el; }} className="cote north ro" style={{ visibility: "hidden" }}>N</span>
          ) : (
            <button
              key={c.key}
              ref={(el) => { labelRefs.current[i] = el; }}
              type="button"
              className={`cote ${c.readOnly ? "ro" : ""}`}
              style={{ visibility: "hidden" }}
              aria-label={`${c.label}, ${c.text}. Modifier`}
              onClick={(e) => { e.stopPropagation(); openEditor(c, e.currentTarget); }}
            >
              {c.text}
            </button>
          ),
        )}
      </div>

      {editor && (
        <form
          className="cote-editor absolute z-10 grid w-[220px] gap-2 rounded-lg border border-iron bg-paper p-2.5 shadow-[var(--shadow-float)]"
          style={{ left: editor.x, top: editor.y }}
          onSubmit={(e) => { e.preventDefault(); applyEditor((e.currentTarget.elements.namedItem("v") as HTMLInputElement).value); }}
        >
          <label htmlFor="cote-in" className="text-[0.78rem] font-semibold">{editor.label}</label>
          <div className="flex items-center gap-1.5">
            <input id="cote-in" name="v" type="number" step="any" inputMode="decimal" defaultValue={editor.value} autoFocus onFocus={(e) => e.currentTarget.select()} onKeyDown={(e) => { if (e.key === "Escape") setEditor(null); }} className="input !py-1.5 tnum" />
            <span className="text-[0.8rem] text-iron-3">{editor.unit}</span>
            <button type="submit" className="btn btn-primary !px-3 !py-2">OK</button>
          </div>
        </form>
      )}

      {!compact && (
        <>
          <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap gap-1.5">
            {CAMS.map((c) => (
              <button key={c.k} type="button" aria-pressed={cam === c.k} onClick={() => changeCam(c.k)} className="pointer-events-auto rounded-md border border-stone-3 bg-paper px-2.5 py-1.5 text-[0.8rem] font-medium text-iron transition-colors aria-pressed:border-iron aria-pressed:bg-iron aria-pressed:text-paper">
                {c.label}
              </button>
            ))}
            <span className="flex-1" />
            <button type="button" aria-pressed={showCotes} onClick={() => setShowCotes((v) => !v)} className="pointer-events-auto rounded-md border border-stone-3 bg-paper px-2.5 py-1.5 text-[0.8rem] font-medium text-iron aria-pressed:border-iron aria-pressed:bg-iron aria-pressed:text-paper">
              Cotes
            </button>
          </div>
          <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-paper/80 px-2.5 py-1.5 text-[0.76rem] text-iron-2">
            Glisser pour tourner · molette ou pincer pour zoomer · cliquer une cote pour la modifier
          </p>
        </>
      )}
    </div>
  );
}
