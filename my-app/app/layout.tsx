import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import CalendlyBadge from "@/app/components/CalendlyBadge";
import CookieBanner from "@/app/components/CookieBanner";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://7eats.ca"),
  title: "7eats - The Canadian Meal Prep Marketplace",
  description:
    "7eats is the marketplace for Toronto's meal prep businesses. Get discovered by new customers, manage orders, and get paid without the admin overhead.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "7eats - The Canadian Meal Prep Marketplace",
    description:
      "7eats is the marketplace for Toronto's meal prep businesses. Get discovered by new customers, manage orders, and get paid without the admin overhead.",
    url: "https://7eats.ca",
    siteName: "7eats",
    images: [
      {
        url: "/7eats-icon-full.jpg",
        width: 1080,
        height: 1080,
        alt: "7eats - The Canadian meal prep marketplace",
      },
    ],
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "7eats - The Canadian Meal Prep Marketplace",
    description:
      "7eats is the marketplace for Toronto's meal prep businesses. Get discovered by new customers, manage orders, and get paid without the admin overhead.",
    images: ["/7eats-icon-full.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link
          href="https://assets.calendly.com/assets/external/widget.css"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <CalendlyBadge />
        <CookieBanner />
        <Toaster position="top-center" richColors={false} closeButton />
        <Script
          src="https://assets.calendly.com/assets/external/widget.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
