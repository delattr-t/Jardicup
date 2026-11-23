# jardicup — site et configurateur 3D

Site vitrine et de réservation de la tour potagère jardicup : configurateur 3D (Three.js) qui adapte la tour au garde-corps du visiteur, et formulaire de réservation sans paiement (les prix ne sont pas encore publiés).

## Stack

- Next.js 16 (App Router), React 19, Tailwind CSS 4
- Three.js pour la scène du balcon (`src/components/configurator/scene.ts`)
- Supabase (table `reservations`, insertion seule depuis le site via la clé publishable, lecture réservée au dashboard)
- Hébergement prévu sur Vercel

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis renseigner les deux variables
npm run dev
```

Variables d'environnement :

| Clé | Valeur |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase `jardicup` |
| `NEXT_PUBLIC_SUPABASE_KEY` | clé **publishable** (jamais la clé service) |

## Organisation

```
src/lib/config.ts            modèle du configurateur : état, catalogue, calculs, récap
src/lib/supabase.ts          client public + génération de référence
src/components/configurator  scène 3D, panneau 3 étapes, vue, contexte React
src/components/site          en-tête, pied, accueil (hero 3D), lecteur vidéo
src/app                      pages : / , /configurateur, /reservation, /merci, /mentions-legales
public/media                 vidéos (rendus Blender) compressées + posters
public/models/tour.glb       assemblage réel de la tour (export Fusion → glTF, compressé meshopt, 138 Ko)
src/fonts                    Gabarito et Hanken Grotesk, auto-hébergées
```

## Modèle 3D de la tour

`public/models/tour.glb` vient de `Assemblage_tour.fbx` (Fusion) converti avec FBX2glTF puis `gltfpack -cc -kn -km`. Le configurateur le découpe en modules (réservoir, étage « 4 trous », étage « 3 trous », chute + toit, panneau + mât) dans `src/components/configurator/towerModel.ts` et les empile selon le nombre d'étages. Pour mettre à jour : exporter l'assemblage, reconvertir, et vérifier les cotes de `TOWER` et `CUPS` si la géométrie a changé.

## Réservations

Chaque réservation enregistre la configuration complète (JSON), un résumé lisible, les coordonnées et un statut (`nouvelle`, `contactee`, `confirmee`, `annulee`). Consultation et suivi depuis le dashboard Supabase → Table editor → `reservations`.

Pour exporter : Supabase → SQL → `select reference, created_at, prenom, nom, email, resume from reservations order by created_at desc;`

## Ouvrir les ventes plus tard

1. Ajouter les prix dans `VERSIONS` (`src/lib/config.ts`) et les afficher dans la gamme et le récap.
2. Remplacer le bouton « Réserver » par un paiement (Stripe Checkout) dans une route serveur.
3. Compléter les mentions légales (`src/app/mentions-legales/page.tsx`) et l'adresse de contact dans le pied de page.
