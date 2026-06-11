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
  weight: ["400", "500", "600", "700", "800"],
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

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "7eats",
  url: "https://7eats.ca",
  logo: "https://7eats.ca/7eats-icon-full.jpg",
  description:
    "7eats is the Canadian marketplace connecting meal prep businesses with customers. Home cooks and professional meal preppers in Toronto can list their meals, manage orders, and get paid.",
  sameAs: [],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    url: "https://7eats.ca",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "7eats",
  url: "https://7eats.ca",
  description:
    "The Canadian marketplace for meal prep businesses. Discover local meal prep, manage orders, and get paid without the admin overhead.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://7eats.ca/app?q={search_term_string}",
    "query-input": "required name=search_term_string",
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
        {/* JSON-LD structured data — native script tag required (not next/script) */}
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, not user input
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, not user input
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className={plusJakartaSans.className}>
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
