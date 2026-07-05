import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reef Platform",
  description:
    "Log tank parameters, equipment, and coral inventory — and help build a crowdsourced record linking coral coloration to the conditions that produced it.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a href="/" className="brand">
            Reef Platform
          </a>
          <nav>
            <a href="/dashboard">Dashboard</a>
            <a href="/login">Log in</a>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
