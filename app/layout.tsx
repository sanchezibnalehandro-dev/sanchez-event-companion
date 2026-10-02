import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "SANCHEZ Event Companion",
  description: "Web-first event companion foundation",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <header className="site-header">
          <Link className="wordmark" href="/">
            SANCHEZ <span>EVENT COMPANION</span>
          </Link>
          <span className="phase-chip">PHASE 2</span>
        </header>
        {children}
      </body>
    </html>
  );
}
