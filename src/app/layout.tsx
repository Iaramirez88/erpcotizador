import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { PwaInstallCta } from "@/components/pwa/pwa-install-cta";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { getServerLanguage } from "@/lib/i18n/server";

const inter = Inter({ subsets: ["latin"] });

const facebookDomainVerification = process.env.NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION?.trim();

export const metadata: Metadata = {
  title: "Ordex",
  description: "Sistema de cotización y órdenes de trabajo",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ordex",
  },
  formatDetection: {
    telephone: false,
  },
  verification: facebookDomainVerification
    ? {
        other: {
          "facebook-domain-verification": [facebookDomainVerification],
        },
      }
    : undefined,
};

export const viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getServerLanguage();

  return (
    <html lang={language}>
      <body className={inter.className}>
        <PwaProvider />
        <PwaInstallCta />
        <AuthProvider>
          <I18nProvider initialLanguage={language}>{children}</I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
