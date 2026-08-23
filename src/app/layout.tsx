import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import UserAccentController from "@/components/user/UserAccentController";
import OfflineRuntime from "@/components/app/OfflineRuntime";
import { getSiteUrl } from "@/lib/site-url";
import { getOgLogoUrl } from "@/lib/og-logo";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Bookstream — Платформа для чтения",
  description: "Интерактивная платформа для чтения книг с комментариями к абзацам, несколькими вариантами текста и настраиваемым интерфейсом",
  keywords: ["Bookstream", "книги", "чтение", "комментарии", "читалка"],
  authors: [{ name: "Bookstream" }],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <meta property="og:logo" content={getOgLogoUrl()} />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-background text-foreground`}
      >
        <OfflineRuntime />
        <UserAccentController />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
