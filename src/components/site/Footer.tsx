import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="bg-iron text-stone">
      <div className="rail-rule light opacity-40" aria-hidden="true" />
      <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-3">
          <span className="flex items-center gap-2.5 text-[1.2rem] font-extrabold display"><Logo className="size-6 text-leaf-3" />jardicup</span>
          <p className="max-w-[46ch] text-[0.92rem] text-stone-3">
            Tour potagère aéroponique pour balcons, conçue et imprimée en France aux cotes de votre garde-corps. Projet en développement : les chiffres affichés sont des estimations de prototype.
          </p>
        </div>
        <nav className="grid content-start gap-2 text-[0.92rem]" aria-label="Pied de page">
          <Link href="/configurateur" className="text-stone no-underline hover:underline">Configurer ma tour</Link>
          <Link href="/#fonctionnement" className="text-stone no-underline hover:underline">Fonctionnement</Link>
          <Link href="/#gamme" className="text-stone no-underline hover:underline">La gamme</Link>
          <Link href="/#questions" className="text-stone no-underline hover:underline">Questions fréquentes</Link>
        </nav>
        <div className="grid content-start gap-2 text-[0.92rem] text-stone-3">
          <p>Balcons testeurs recherchés pour la saison 2027.</p>
          <p>Contact : <span className="text-stone">adresse à venir</span></p>
          <Link href="/mentions-legales" className="text-stone-3 hover:text-stone">Mentions légales</Link>
        </div>
      </div>
    </footer>
  );
}
