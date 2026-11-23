import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mentions légales", robots: { index: false } };

/* À compléter avant mise en ligne publique : identité de l'éditeur (nom, forme juridique,
   SIREN), adresse, responsable de publication, hébergeur. */
export default function Page() {
  return (
    <div className="mx-auto max-w-[760px] px-4 py-16">
      <h1 className="text-[2.2rem] font-extrabold">Mentions légales</h1>
      <div className="mt-8 grid gap-6 text-iron-2">
        <section>
          <h2 className="text-[1.2rem] font-bold text-iron">Éditeur</h2>
          <p className="mt-2">jardicup — projet en cours de création d&rsquo;entreprise. Identité de l&rsquo;éditeur, forme juridique et numéro SIREN à compléter avant l&rsquo;ouverture des ventes.</p>
        </section>
        <section>
          <h2 className="text-[1.2rem] font-bold text-iron">Hébergement</h2>
          <p className="mt-2">Site hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis. Données de réservation stockées par Supabase Inc. dans un centre de données situé à Paris (région eu-west-3).</p>
        </section>
        <section>
          <h2 className="text-[1.2rem] font-bold text-iron">Données personnelles</h2>
          <p className="mt-2">Les coordonnées et la configuration saisies dans le formulaire de réservation servent uniquement à vous recontacter au sujet de cette réservation. Elles ne sont ni cédées ni utilisées à des fins publicitaires. Vous pouvez demander leur consultation, leur modification ou leur suppression en écrivant à l&rsquo;adresse de contact indiquée en pied de page.</p>
          <p className="mt-2">Le site ne dépose aucun cookie de suivi. Votre configuration est conservée dans le stockage local de votre navigateur, sur votre appareil uniquement.</p>
        </section>
      </div>
    </div>
  );
}
