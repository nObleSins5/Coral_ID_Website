import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { AccountMenu } from "@/components/account-menu";
import { HeaderSearch } from "@/components/header-search";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ReefCodex",
  description:
    "Log tank parameters, equipment, and coral inventory — and help build a crowdsourced record linking coral coloration to the conditions that produced it.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={roboto.variable}>
      <body>
        <header className="site-header">
          <a href="/" className="brand">
            Reef<span className="brand-accent">Codex</span>
          </a>
          <HeaderSearch />
          <nav>
            <a href="/identify">Self ID</a>
            <a href="/community">Community ID</a>
            <a href="/wiki">Wiki</a>
            <a href="/dashboard">Dashboard</a>
            <AccountMenu />
          </nav>
        </header>
        <main className="container">{children}</main>
        <Analytics />
      </body>
    </html>
  );
}
