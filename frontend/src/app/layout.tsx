import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { BrandLogo } from "@/components/BrandLogo";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ThreadsHunter — Autonomous Threads Affiliate AI Engine",
  description:
    "Obsidian & Electric Orange editorial command center for Threads buying-intent discovery, universal multi-LLM scoring, and Shopee Affiliate reply automation.",
  icons: {
    icon: [
      { url: "/logo.jpg", type: "image/jpeg" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    apple: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`dark ${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans bg-[#0B0B0C] text-white antialiased min-h-screen flex flex-col">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 pt-10 pb-20">
          {children}
        </main>
        <footer className="border-t border-[#26262A]/80 py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#63636B]">
            <div className="flex items-center gap-2.5">
              <BrandLogo size="sm" />
              <p>Threads Affiliate AI Hunter · Anti-Ban Stealth Engine v3.0</p>
            </div>
            <p className="font-mono">
              Obsidian &amp; Electric Orange Editorial UI
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
