import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Lato, Playfair_Display, Source_Sans_3 } from "next/font/google";
import { getSession } from "@/lib/auth/session";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-lato",
  display: "swap",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "House of Alchemie", template: "%s | House of Alchemie" },
  description: "AI business advisors for luxury service entrepreneurs.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "House of Alchemie" },
};

export const viewport: Viewport = {
  themeColor: "#f7f5f0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let fontPreset = "house";
  let textScale = 100;
  try {
    const s = await getSession();
    if (s) {
      fontPreset = s.user.fontPreset;
      textScale = s.user.textScale;
    }
  } catch {
    // Database unreachable: render with defaults rather than a blank page.
  }

  return (
    <html
      lang="en"
      data-font={fontPreset}
      data-scale={textScale}
      className={`${cormorant.variable} ${lato.variable} ${playfair.variable} ${sourceSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
