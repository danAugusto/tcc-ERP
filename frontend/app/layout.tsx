import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lanchonete & Pastelaria — Dashboard",
  description: "Painel administrativo e de automação da Lanchonete & Pastelaria",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}