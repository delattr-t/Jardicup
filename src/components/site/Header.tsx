"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";

const NAV = [
  { href: "/configurateur", label: "Configurateur" },
  { href: "/#fonctionnement", label: "Fonctionnement" },
  { href: "/#gamme", label: "La gamme" },
  { href: "/#nature", label: "Biodiversité" },
  { href: "/#questions", label: "Questions" },
];

export default function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-iron/10 bg-stone/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1240px] items-center gap-5 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 text-[1.25rem] font-extrabold tracking-tight display" aria-label="jardicup, accueil" onClick={() => setOpen(false)}>
          <Logo className="size-7 text-leaf" />
          jardicup
        </Link>
        <nav className="ml-auto hidden gap-1 md:flex" aria-label="Sections">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`rounded-md px-2.5 py-1.5 text-[0.92rem] font-medium no-underline transition-colors hover:bg-iron/8 ${path === n.href ? "text-iron" : "text-iron-2"}`}>{n.label}</Link>
          ))}
        </nav>
        <Link href="/configurateur" className="btn btn-primary ml-auto !px-4 !py-2.5 md:ml-0">Configurer ma tour</Link>
        <button type="button" className="rounded-md border border-iron/20 p-2 md:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true"><path d={open ? "M4 4l12 12M16 4L4 16" : "M3 5h14M3 10h14M3 15h14"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" /></svg>
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" className="border-t border-iron/10 bg-stone px-4 py-2 md:hidden" aria-label="Sections">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-md px-2 py-2.5 font-medium no-underline hover:bg-iron/8">{n.label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}
