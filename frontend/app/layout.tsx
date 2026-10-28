import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Archivo } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

// Uma família só, com eixo de largura: extracondensada nos títulos/números, normal no texto
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AuthProvider } from "@/contexts/AuthContext";
import { FeedbackHost } from "@/components/ui/feedback";
import { BrandingTitle } from "@/hooks/useBranding";

export const metadata: Metadata = {
  title: "PL Lanchonete & Pastelaria — ERP & Automação",
  description: "Painel administrativo e App Mobile",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg" },
};

// Base de celular: notch/indicador (viewport-fit), teclado virtual redimensiona o layout e cor da barra do sistema por tema
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-theme="dark" className={`h-full ${archivo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex h-dvh overflow-hidden bg-canvas text-ink antialiased font-sans">
        <AuthProvider>
          <FeedbackHost />
          <BrandingTitle />
          <AuthGuard>
            <div className="flex h-full w-full flex-col overflow-hidden lg:flex-row">
              <Sidebar />
              <div className="flex flex-1 flex-col overflow-hidden min-w-0 bg-canvas h-full">
                <main className="flex-1 overflow-y-auto h-full">
                  {children}
                </main>
              </div>
            </div>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}