"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useConfig } from "@/components/configurator/ConfigContext";
import RailIcon from "@/components/configurator/RailIcon";
import { RAILS, RAIL_KEYS } from "@/lib/config";

const Viewport = dynamic(() => import("@/components/configurator/Viewport"), { ssr: false, loading: () => <div className="h-full w-full bg-[var(--scene-bg)]" /> });

export default function Hero() {
  const { config, set } = useConfig();
  return (
    <section className="relative isolate overflow-hidden bg-sand-2">
      <div className="mx-auto grid max-w-[1240px] items-end gap-6 px-4 pt-10 pb-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10 lg:pt-16">
        <div>
          <h1 className="text-[clamp(2.4rem,5.2vw+0.8rem,4.6rem)] font-black text-iron">
            La tour potagère qui s&rsquo;accroche à <span className="text-leaf-2">votre</span> garde-corps.
          </h1>
          <p className="mt-6 max-w-[48ch] text-[1.1rem] text-iron-2">
            Choisissez votre grille, ajustez les cotes, composez la tour. Vous la voyez sur votre balcon avant qu&rsquo;une seule pièce ne soit imprimée.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link href="/configurateur" className="btn btn-primary">Configurer ma tour</Link>
            <Link href="#montage" className="btn btn-ghost">Voir le montage</Link>
          </div>
          <ul className="mt-9 grid gap-0 border-t border-iron/20 text-[0.95rem] text-iron-2">
            <li className="grid grid-cols-[84px_1fr] items-baseline gap-3 border-b border-iron/20 py-3"><b className="display text-[1.6rem] font-black text-iron tnum">0</b>perçage : le poids repose au sol, le garde-corps ne fait que retenir.</li>
            <li className="grid grid-cols-[84px_1fr] items-baseline gap-3 border-b border-iron/20 py-3"><b className="display text-[1.6rem] font-black text-iron tnum">15 L</b>de réservoir au pied, arrosage automatique en cascade.</li>
            <li className="grid grid-cols-[84px_1fr] items-baseline gap-3 border-b border-iron/20 py-3"><b className="display text-[1.6rem] font-black text-iron tnum">3</b>versions selon votre balcon : prise, batterie ou soleil.</li>
          </ul>
        </div>

        <div className="rise grid gap-3">
          <div className="overflow-hidden rounded-xl border border-iron/15 shadow-[var(--shadow-float)]">
            <Viewport compact cotesDefault={false} initialCam="hero" className="h-[360px] sm:h-[440px] lg:h-[520px]" />
          </div>
          <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Choisir un garde-corps">
            {RAIL_KEYS.map((k) => (
              <button key={k} type="button" aria-pressed={config.rail === k} onClick={() => set("rail", k)} className="grid justify-items-center gap-1 rounded-md border border-iron/15 bg-paper/70 px-1 py-2 text-[0.72rem] font-semibold leading-tight text-iron-2 transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-paper active:scale-[0.97] aria-pressed:border-iron aria-pressed:bg-paper aria-pressed:text-iron sm:text-[0.8rem]">
                <RailIcon kind={k} className={`h-8 w-11 ${config.rail === k ? "text-leaf-2" : "text-iron-3"}`} />
                {RAILS[k].short}
              </button>
            ))}
          </div>
          <p className="text-[0.84rem] text-iron-2">Faites tourner la vue, puis passez au configurateur pour entrer vos cotes.</p>
        </div>
      </div>
      <div className="rail-rule opacity-30" aria-hidden="true" />
    </section>
  );
}
