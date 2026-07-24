import type { Metadata } from "next";
import "./globals.css";
import "@/styles/baserow/default.scss";

export const metadata: Metadata = {
  title: "FYCD HD Manager | 高效能雲端資料庫與工作區管理系統",
  description: "全功能 Baserow 風格雲端資料庫管理平台，提供動態資料表、多維檢視表（Grid / Kanban / Form）、Formula 公式庫、無障礙與高對比權限控管系統。",
  keywords: ["Baserow", "Database", "NoCode", "Formula", "Workspace", "Grid View", "Kanban"],
  openGraph: {
    title: "FYCD HD Manager - 雲端資料庫管理系統",
    description: "高效能團隊協作與動態資料表管理平台",
    type: "website",
    locale: "zh_TW",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
