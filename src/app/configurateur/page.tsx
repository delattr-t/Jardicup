import type { Metadata } from "next";
import ConfiguratorPage from "./ConfiguratorPage";

export const metadata: Metadata = { title: "Configurateur 3D", description: "Renseignez votre garde-corps, ajustez les cotes et composez votre tour jardicup en 3D." };

export default function Page() {
  return <ConfiguratorPage />;
}
