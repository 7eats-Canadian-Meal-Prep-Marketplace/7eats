import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import CalendlyBadge from "@/app/components/CalendlyBadge";
import BackToTop from "@/app/components/BackToTop";
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
    "7eats connects meal prep cooks with customers across Canada. List your menu, get discovered, and grow beyond your personal network.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "7eats - The Canadian Meal Prep Marketplace",
    description:
      "7eats connects meal prep cooks with customers across Canada. List your menu, get discovered, and grow beyond your personal network.",
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
      "7eats connects meal prep cooks with customers across Canada. List your menu, get discovered, and grow beyond your personal network.",
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
        <BackToTop />
        <Toaster
          position="top-center"
          richColors={false}
          closeButton
        />
        <Script
          src="https://assets.calendly.com/assets/external/widget.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
