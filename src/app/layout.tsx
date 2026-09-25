import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Jost } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

const display = Bodoni_Moda({ subsets: ["latin"], variable: "--font-display", display: "swap", style: ["normal", "italic"] });
const sans = Jost({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Aurora Studio", template: "%s · Aurora Studio" },
  description: "Cílios, sobrancelhas, maquiagem, epilação e micropigmentação com hora marcada.",
};

export const viewport: Viewport = { themeColor: "#5E1A2C", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
