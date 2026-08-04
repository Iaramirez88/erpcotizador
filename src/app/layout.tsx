import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { GlobalAlertToast } from "@/components/providers/global-alert-toast";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { NotificationToastBridge } from "@/components/providers/notification-toast-bridge";
import ThemeProvider from "@/components/providers/theme-provider";
import { PwaInstallCta } from "@/components/pwa/pwa-install-cta";
import { PushNotificationProvider } from "@/components/pwa/push-notification-provider";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { Toaster } from "@/components/ui/toaster";
import { getServerLanguage } from "@/lib/i18n/server";

const inter = Inter({ subsets: ["latin"] });
const isDevelopment = process.env.NODE_ENV !== "production";
const themeBootstrapScript = `
(() => {
  try {
    const storageKey = 'sg_theme_preference';
    const stored = window.localStorage.getItem(storageKey);
    const preference = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    const resolved = preference === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : preference;
    const root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.style.colorScheme = resolved;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', resolved === 'dark' ? '#08101d' : '#f4f7fb');
    }
  } catch {}
})();`;
const devServiceWorkerCleanupScript = `
(() => {
  if (!('serviceWorker' in navigator)) return;

  const clearOrdexCaches = async () => {
    if (!('caches' in window)) return;
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('ordex-shell-')).map((key) => caches.delete(key)));
  };

  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .then(() => clearOrdexCaches())
    .then(() => {
      if (navigator.serviceWorker.controller) {
        window.location.reload();
      }
    })
    .catch(() => undefined);
})();`;

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
  themeColor: "#f4f7fb",
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
    <html lang={language} suppressHydrationWarning>
      <body className={inter.className}>
        <Script id="theme-bootstrap" strategy="beforeInteractive">{themeBootstrapScript}</Script>
        {isDevelopment ? <Script id="dev-sw-cleanup" strategy="beforeInteractive">{devServiceWorkerCleanupScript}</Script> : null}
        <ThemeProvider>
          <PwaProvider />
          <PwaInstallCta />
          <PushNotificationProvider />
          <AuthProvider>
            <I18nProvider initialLanguage={language}>
              {children}
              <NotificationToastBridge />
            </I18nProvider>
          </AuthProvider>
          <GlobalAlertToast />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
