import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ConfigProvider } from "@/components/configurator/ConfigContext";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";

/* Polices auto-hébergées (variables) : Gabarito pour les titres, Hanken Grotesk pour le texte. */
const gabarito = localFont({
  src: [
    { path: "../fonts/gabarito-latin-wght-normal.woff2", weight: "400 900", style: "normal" },
    { path: "../fonts/gabarito-latin-ext-wght-normal.woff2", weight: "400 900", style: "normal" },
  ],
  variable: "--font-gabarito",
  display: "swap",
});
const hanken = localFont({
  src: [
    { path: "../fonts/hanken-grotesk-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "../fonts/hanken-grotesk-latin-ext-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "../fonts/hanken-grotesk-latin-wght-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "jardicup — la tour potagère qui s'accroche à votre garde-corps", template: "%s · jardicup" },
  description:
    "Tour potagère aéroponique pour balcon, imprimée en France aux cotes de votre garde-corps. Configurez-la en 3D, réservez la vôtre.",
  metadataBase: new URL("https://jardicup.vercel.app"),
  openGraph: { title: "jardicup", description: "La tour potagère taillée pour votre balcon.", images: ["/media/rendu-tour.jpg"], locale: "fr_FR", type: "website" },
};
export const viewport: Viewport = { themeColor: "#e7e3da", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${gabarito.variable} ${hanken.variable}`}>
      <body>
        <ConfigProvider>
          <Header />
          <main id="contenu">{children}</main>
          <Footer />
        </ConfigProvider>
      </body>
    </html>
  );
}
