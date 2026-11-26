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
  title: "ThreadsHunter — Shopee Affiliate Automation Console",
  description:
    "Precision Threads buying-intent scanner, multi-LLM evaluator, and Shopee Affiliate smart reply studio.",
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
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
      <body className="font-sans bg-[#09090B] text-[#FAFAFA] antialiased min-h-screen flex flex-col">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 pt-10 pb-20">
          {children}
        </main>
        <footer className="border-t border-[#1C1C20] bg-[#09090B]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#52525B]">
            <div className="flex items-center gap-2.5">
              <BrandLogo size="sm" />
              <span className="text-[#71717A] font-medium">ThreadsHunter</span>
              <span>·</span>
              <span>Shopee Affiliate Stealth Automation</span>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-wider">
              SYS // PLAYWRIGHT · FASTAPI · POSTGRES 16
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
