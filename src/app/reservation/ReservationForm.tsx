"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfig } from "@/components/configurator/ConfigContext";
import { checks, compute, recapRows, summaryText } from "@/lib/config";
import { makeReference, supabase } from "@/lib/supabase";

type Errors = Partial<Record<"prenom" | "nom" | "email" | "telephone" | "code_postal" | "consentement" | "global", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ReservationForm() {
  const { config, hydrated } = useConfig();
  const router = useRouter();
  const r = compute(config);
  const rows = recapRows(config, r);
  const blocking = checks(config, r).some((x) => x[0] === "bad");
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [website, setWebsite] = useState(""); // champ piège anti-robot, jamais affiché

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const data = {
      prenom: get("prenom"), nom: get("nom"), email: get("email").toLowerCase(), telephone: get("telephone"),
      code_postal: get("code_postal"), ville: get("ville"), message: get("message"), consentement: fd.get("consentement") === "on",
    };
    const errs: Errors = {};
    if (!data.prenom) errs.prenom = "Indiquez votre prénom.";
    if (!data.nom) errs.nom = "Indiquez votre nom.";
    if (!EMAIL.test(data.email)) errs.email = "Entrez une adresse e-mail valide, c'est là que nous vous préviendrons.";
    if (data.telephone && !/^[+\d][\d\s().-]{5,}$/.test(data.telephone)) errs.telephone = "Ce numéro ne semble pas complet.";
    if (data.code_postal && !/^\d{5}$/.test(data.code_postal)) errs.code_postal = "Un code postal français compte 5 chiffres.";
    if (!data.consentement) errs.consentement = "Nous avons besoin de votre accord pour conserver votre demande.";
    if (website) return; // robot
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = document.querySelector<HTMLElement>("[aria-invalid='true']");
      first?.focus();
      return;
    }
    setSending(true);
    const reference = makeReference();
    try {
      const { error } = await supabase().from("reservations").insert({
        reference, ...data,
        telephone: data.telephone || null, code_postal: data.code_postal || null, ville: data.ville || null, message: data.message || null,
        config, resume: summaryText(config), statut: "nouvelle", user_agent: navigator.userAgent.slice(0, 200),
      });
      if (error) {
        if (error.code === "23505") setErrors({ global: "Cette configuration a déjà été réservée avec cette adresse il y a quelques minutes. Vérifiez votre boîte mail, ou modifiez la configuration." });
        else setErrors({ global: "L'envoi a échoué. Réessayez dans un instant ; si le problème persiste, copiez votre récapitulatif depuis le configurateur et écrivez-nous." });
        setSending(false);
        return;
      }
      try { sessionStorage.setItem("jardicup.lastReservation", JSON.stringify({ reference, prenom: data.prenom, email: data.email })); } catch {}
      router.push(`/merci?ref=${encodeURIComponent(reference)}`);
    } catch {
      setErrors({ global: "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez." });
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 md:py-12">
      <div className="mb-8 max-w-[760px]">
        <h1 className="text-[clamp(1.9rem,3vw+0.8rem,3rem)] font-extrabold">Réserver ma configuration</h1>
        <p className="mt-3 text-iron-2">Sans paiement et sans engagement : nous gardons votre tour et vos cotes, et nous vous écrivons en premier à l&rsquo;ouverture des ventes.</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <form onSubmit={onSubmit} noValidate className="grid gap-5 rounded-xl border border-stone-3 bg-paper p-5 md:p-7">
          {errors.global && <p role="alert" className="rounded-md border border-signal/40 bg-signal/8 px-3.5 py-3 text-[0.92rem] text-signal">{errors.global}</p>}
          {blocking && (
            <p role="alert" className="rounded-md border border-amber/40 bg-amber/10 px-3.5 py-3 text-[0.92rem] text-amber">
              Votre configuration a un point bloquant. <Link href="/configurateur" className="font-semibold">Corrigez-la dans le configurateur</Link> avant de réserver.
            </p>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="prenom" className="field-label">Prénom</label>
              <input id="prenom" name="prenom" autoComplete="given-name" required className="input" aria-invalid={!!errors.prenom} aria-describedby={errors.prenom ? "e-prenom" : undefined} />
              {errors.prenom && <p id="e-prenom" className="input-error">{errors.prenom}</p>}
            </div>
            <div>
              <label htmlFor="nom" className="field-label">Nom</label>
              <input id="nom" name="nom" autoComplete="family-name" required className="input" aria-invalid={!!errors.nom} aria-describedby={errors.nom ? "e-nom" : undefined} />
              {errors.nom && <p id="e-nom" className="input-error">{errors.nom}</p>}
            </div>
          </div>
          <div>
            <label htmlFor="email" className="field-label">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required className="input" aria-invalid={!!errors.email} aria-describedby={errors.email ? "e-email" : undefined} />
            {errors.email && <p id="e-email" className="input-error">{errors.email}</p>}
          </div>
          <div className="grid gap-5 sm:grid-cols-[1fr_120px_1fr]">
            <div>
              <label htmlFor="telephone" className="field-label">Téléphone <span className="font-normal text-iron-3">(facultatif)</span></label>
              <input id="telephone" name="telephone" type="tel" autoComplete="tel" className="input" aria-invalid={!!errors.telephone} aria-describedby={errors.telephone ? "e-tel" : undefined} />
              {errors.telephone && <p id="e-tel" className="input-error">{errors.telephone}</p>}
            </div>
            <div>
              <label htmlFor="code_postal" className="field-label">Code postal</label>
              <input id="code_postal" name="code_postal" inputMode="numeric" autoComplete="postal-code" className="input tnum" aria-invalid={!!errors.code_postal} aria-describedby={errors.code_postal ? "e-cp" : undefined} />
              {errors.code_postal && <p id="e-cp" className="input-error">{errors.code_postal}</p>}
            </div>
            <div>
              <label htmlFor="ville" className="field-label">Ville</label>
              <input id="ville" name="ville" autoComplete="address-level2" className="input" />
            </div>
          </div>
          <div>
            <label htmlFor="message" className="field-label">Un mot sur votre balcon <span className="font-normal text-iron-3">(facultatif)</span></label>
            <textarea id="message" name="message" rows={3} className="input" placeholder="Une photo du garde-corps nous aide beaucoup : vous pourrez nous l'envoyer par retour de mail." />
          </div>
          <label className="hidden" aria-hidden="true">
            Site web<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
          <label className="flex items-start gap-3 text-[0.92rem]">
            <input type="checkbox" name="consentement" className="mt-1 size-5 shrink-0 accent-leaf" aria-invalid={!!errors.consentement} aria-describedby={errors.consentement ? "e-cons" : undefined} />
            <span>J&rsquo;accepte que jardicup conserve ma configuration et mes coordonnées pour me recontacter au sujet de cette réservation. Rien d&rsquo;autre, pas de newsletter.</span>
          </label>
          {errors.consentement && <p id="e-cons" className="input-error -mt-3">{errors.consentement}</p>}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="submit" className="btn btn-primary" disabled={sending || blocking || !hydrated}>
              {sending ? "Envoi en cours…" : "Envoyer ma réservation"}
            </button>
            <Link href="/configurateur" className="text-[0.92rem] text-iron-2">Modifier ma configuration</Link>
          </div>
        </form>

        <aside className="grid content-start gap-4 rounded-xl bg-sand-2 p-5 md:p-7">
          <h2 className="text-[1.3rem] font-bold">Ce que nous gardons</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.9rem]">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-iron-3">{k}</dt>
                <dd className="min-w-0 font-semibold [overflow-wrap:anywhere]">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-iron/15 pt-4 text-[0.88rem] text-iron-2">Le prix sera communiqué à l&rsquo;ouverture des ventes. Vous pourrez alors confirmer, modifier ou abandonner votre réservation.</p>
        </aside>
      </div>
    </div>
  );
}
