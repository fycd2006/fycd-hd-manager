import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./theme.css";
import "@/styles/baserow/default.scss";

export const viewport: Viewport = {
  themeColor: "#EA580C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "FYCD HD Manager",
  description: "全功能雲端資料庫管理平台，提供動態資料表、多維檢視表（Grid / Kanban / Form）、Formula 公式庫、無障礙與高對比權限控管系統。",
  keywords: ["FYCD HD Manager", "Database", "NoCode", "Formula", "Workspace", "Grid View", "Kanban"],
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FYCD HD",
  },
  openGraph: {
    title: "FYCD HD Manager",
    description: "FYCD HD Manager - 高效能團隊協作與動態資料表管理平台",
    type: "website",
    locale: "zh_TW",
    images: [{ url: "/logo.png", width: 800, height: 800, alt: "FYCD HD Manager Logo" }],
  },
};

import { I18nProvider } from "@/lib/i18n/i18nContext";
import { FYCDBrandIntro } from "@/modules/database/components/intro/FYCDBrandIntro";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>
        <Script
          id="pointer-capture-fix"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof Element !== 'undefined' && Element.prototype.releasePointerCapture) {
                const origRelease = Element.prototype.releasePointerCapture;
                Element.prototype.releasePointerCapture = function(id) {
                  try {
                    if (this.hasPointerCapture && this.hasPointerCapture(id)) {
                      origRelease.call(this, id);
                    }
                  } catch(e) {}
                };
              }
            `,
          }}
        />
        <FYCDBrandIntro />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
