import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "SANCHEZ — программа события",
  description: "Программа события и вопросы спикерам",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
