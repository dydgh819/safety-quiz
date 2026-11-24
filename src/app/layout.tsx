import type { Metadata, Viewport } from "next";

import { ko } from "@/messages/ko";

import "./globals.css";

export const metadata: Metadata = {
  title: ko.app.name,
  description: ko.app.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
