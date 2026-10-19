import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "FindPulse — Discover public Telegram channels & groups",
  description:
    "FindPulse is a search engine over a curated directory of public Telegram channels and groups.",
  applicationName: "FindPulse",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Header />
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
