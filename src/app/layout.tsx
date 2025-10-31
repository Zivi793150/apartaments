import type { Metadata } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import ClientShell from "./ClientShell";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const garamond = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
  weight: ["300","400","500","600","700"],
  style: ["normal","italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AUREO Residences",
  description: "Интерактивный выбор корпуса, этажа и квартиры",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} ${garamond.variable} antialiased bg-background text-foreground`}>
        <ClientShell>
          {children}
        </ClientShell>
      </body>
    </html>
  );
}
