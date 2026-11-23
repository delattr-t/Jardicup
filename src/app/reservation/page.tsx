import type { Metadata } from "next";
import ReservationForm from "./ReservationForm";

export const metadata: Metadata = { title: "Réserver ma configuration", description: "Réservez votre tour jardicup sans paiement : nous vous prévenons à l'ouverture des ventes." };

export default function Page() {
  return <ReservationForm />;
}
