import type { Metadata, Viewport } from "next";
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
import "@/lib/pointer-capture-fix";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}

