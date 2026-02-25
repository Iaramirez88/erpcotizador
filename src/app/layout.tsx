import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { getServerLanguage } from "@/lib/i18n/server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ordex",
  description: "Sistema de cotización y órdenes de trabajo",
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
        <AuthProvider>
          <I18nProvider initialLanguage={language}>{children}</I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
