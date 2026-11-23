"use client";
import { useState } from "react";
import Viewport from "./Viewport";
import { Metrics, StepBalcon, StepRecap, StepTour } from "./Panel";

const TABS = ["Balcon", "Tour", "Récap"];

export default function Configurator() {
  const [tab, setTab] = useState(0);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const n = (tab + (e.key === "ArrowRight" ? 1 : 2)) % 3;
    setTab(n);
    (e.currentTarget.children[n] as HTMLElement)?.focus();
  };
  return (
    <div className="grid overflow-hidden rounded-xl border border-stone-3 bg-paper lg:grid-cols-[minmax(300px,390px)_minmax(0,1fr)]">
      <div className="order-1 flex min-w-0 flex-col border-t border-stone-3 lg:order-0 lg:max-h-[780px] lg:border-t-0 lg:border-r">
        <div role="tablist" aria-label="Étapes" onKeyDown={onKey} className="grid grid-cols-3 border-b border-stone-3 bg-stone-2">
          {TABS.map((t, i) => (
            <button
              key={t}
              role="tab"
              id={`tab-${i}`}
              aria-selected={tab === i}
              aria-controls={`panel-${i}`}
              tabIndex={tab === i ? 0 : -1}
              onClick={() => setTab(i)}
              className="flex items-center justify-center gap-2 border-b-2 border-transparent px-2 py-3.5 text-[0.9rem] font-semibold text-iron-3 transition-colors duration-100 aria-selected:border-leaf aria-selected:bg-paper aria-selected:text-iron"
            >
              <span className={`grid size-5 place-items-center rounded-full border text-[0.7rem] tnum ${tab === i ? "border-leaf bg-leaf text-paper" : "border-current"}`}>{i + 1}</span>
              {t}
            </button>
          ))}
        </div>
        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex-1 overflow-auto p-5">
          {tab === 0 && <StepBalcon />}
          {tab === 1 && <StepTour />}
          {tab === 2 && <StepRecap />}
        </div>
        <div className="flex justify-between gap-2 border-t border-stone-3 p-3">
          <button type="button" className="btn btn-ghost" disabled={tab === 0} onClick={() => setTab(tab - 1)}>Précédent</button>
          {tab < 2 ? (
            <button type="button" className="btn btn-primary" onClick={() => setTab(tab + 1)}>{tab === 0 ? "Composer ma tour" : "Voir le récapitulatif"}</button>
          ) : null}
        </div>
      </div>
      <div className="flex min-w-0 flex-col">
        <Viewport className="h-[420px] lg:h-[640px]" />
        <Metrics />
      </div>
    </div>
  );
}
