"use client";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useConfig } from "@/components/configurator/ConfigContext";
import { RAILS, RailKind } from "@/lib/config";

const Configurator = dynamic(() => import("@/components/configurator/Configurator"), {
  ssr: false,
  loading: () => <div className="h-[720px] animate-pulse rounded-xl border border-stone-3 bg-paper" aria-busy="true" aria-label="Chargement du configurateur" />,
});

function RailFromQuery() {
  const sp = useSearchParams();
  const { set, hydrated } = useConfig();
  useEffect(() => {
    const r = sp.get("rail");
    if (hydrated && r && r in RAILS) set("rail", r as RailKind);
  }, [sp, set, hydrated]);
  return null;
}

export default function ConfiguratorPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 md:py-12">
      <Suspense fallback={null}><RailFromQuery /></Suspense>
      <div className="mb-8 max-w-[760px]">
        <h1 className="text-[clamp(1.9rem,3vw+0.8rem,3rem)] font-extrabold">Votre balcon, votre grille, votre tour.</h1>
        <p className="mt-3 text-iron-2">Choisissez votre type de garde-corps, puis ajustez les dimensions avec les réglages ou en cliquant directement sur les cotes de la vue 3D. Votre configuration est conservée sur cet appareil.</p>
      </div>
      <Configurator />
    </div>
  );
}
