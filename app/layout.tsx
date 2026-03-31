import type { Metadata } from "next";

import { APP_NAME } from "@/lib/constants";

import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} | 跨境电商主图 AI 优化`,
  description:
    "上传商品主图或输入商品 URL，快速完成跨境电商图片本地化、卖点强化与视觉优化。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
