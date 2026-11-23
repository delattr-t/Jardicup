import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import MerciClient from "./MerciClient";

export const metadata: Metadata = { title: "Réservation enregistrée", robots: { index: false } };

export default function Page() {
  return (
    <div className="mx-auto max-w-[760px] px-4 py-16 md:py-24">
      <svg viewBox="0 0 48 48" className="size-14 text-leaf" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2.5" /><path d="m15 25 6 6 12-14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <h1 className="mt-6 text-[clamp(1.9rem,3vw+0.8rem,3rem)] font-extrabold">Votre tour est réservée.</h1>
      <Suspense fallback={null}><MerciClient /></Suspense>
      <p className="mt-5 max-w-[60ch] text-iron-2">
        Nous vous écrirons dès que les prix et les délais seront fixés. D&rsquo;ici là, si vous avez une photo de votre garde-corps, répondez à notre premier mail avec : elle nous permet de vérifier l&rsquo;attache avant d&rsquo;imprimer.
      </p>
      <div className="mt-8 flex flex-wrap gap-2.5">
        <Link href="/" className="btn btn-primary">Retour à l&rsquo;accueil</Link>
        <Link href="/configurateur" className="btn btn-ghost">Composer une autre tour</Link>
      </div>
    </div>
  );
}
