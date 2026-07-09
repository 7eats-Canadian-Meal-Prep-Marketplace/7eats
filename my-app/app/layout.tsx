import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { headers } from "next/headers";
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
  metadataBase: new URL("https://www.7eats.ca"),
  title: "7eats - The Canadian Meal Prep Marketplace",
  description:
    "7eats is the marketplace for Toronto's meal prep businesses. Get discovered by new customers, manage orders, and get paid without the admin overhead.",
  icons: {
    icon: "/favicon.svg",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "7eats - The Canadian Meal Prep Marketplace",
    description:
      "7eats is the marketplace for Toronto's meal prep businesses. Get discovered by new customers, manage orders, and get paid without the admin overhead.",
    url: "https://www.7eats.ca",
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
    card: "summary_large_image",
    title: "7eats - The Canadian Meal Prep Marketplace",
    description:
      "7eats is the marketplace for Toronto's meal prep businesses. Get discovered by new customers, manage orders, and get paid without the admin overhead.",
    images: ["/7eats-icon-full.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": ["Organization", "LocalBusiness"],
  name: "7eats",
  url: "https://www.7eats.ca",
  logo: "https://www.7eats.ca/7eats-icon-full.jpg",
  description:
    "7eats is the marketplace for Toronto's meal prep businesses. Get discovered by new customers, manage orders, and get paid without the admin overhead.",
  email: "team@7eats.ca",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Toronto",
    addressRegion: "ON",
    addressCountry: "CA",
  },
  areaServed: {
    "@type": "AdministrativeArea",
    name: "Toronto, Ontario, Canada",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: "team@7eats.ca",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "7eats",
  url: "https://www.7eats.ca",
  description:
    "7eats is the marketplace for Toronto's meal prep businesses. List your menu, reach new customers, and get paid without the admin overhead.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://www.7eats.ca/app/browse?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en-CA" className={plusJakartaSans.variable}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link
          href="https://assets.calendly.com/assets/external/widget.css"
          rel="stylesheet"
        />
        {/* JSON-LD structured data — native script tag required (not next/script) */}
        <script
          type="application/ld+json"
          nonce={nonce}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, not user input
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, not user input
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className={plusJakartaSans.className}>
        {children}
        <CalendlyBadge />
        <CookieBanner />
        <Toaster position="top-center" richColors={false} closeButton={false} />
        <Script
          src="https://assets.calendly.com/assets/external/widget.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
