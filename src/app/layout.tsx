import type { Metadata } from "next";
import "./globals.css";
import "@/styles/baserow/default.scss";

export const metadata: Metadata = {
  title: "Baserow",
  description: "Baserow-like database workspace",
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
