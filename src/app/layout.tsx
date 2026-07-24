import type { Metadata } from "next";
import "./globals.css";
import "@/styles/baserow/default.scss";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "FYCD HD Manager",
  description: "全功能雲端資料庫管理平台，提供動態資料表、多維檢視表（Grid / Kanban / Form）、Formula 公式庫、無障礙與高對比權限控管系統。",
  keywords: ["FYCD HD Manager", "Database", "NoCode", "Formula", "Workspace", "Grid View", "Kanban"],
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.jpg",
  },
  openGraph: {
    title: "FYCD HD Manager",
    description: "FYCD HD Manager - 高效能團隊協作與動態資料表管理平台",
    type: "website",
    locale: "zh_TW",
    images: [{ url: "/logo.jpg", width: 800, height: 800, alt: "FYCD HD Manager Logo" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <head>
        <script
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
      </head>
      <body>{children}</body>
    </html>
  );
}
