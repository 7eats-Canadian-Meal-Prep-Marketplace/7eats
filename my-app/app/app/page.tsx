import type { Metadata } from "next";
import { headers } from "next/headers";
import MarketplaceLanding from "@/app/components/MarketplaceLanding";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Order meal prep near you | 7eats",
  description:
    "Canada's first meal prep marketplace. Find cooks near you, browse weekly menus, and pay at checkout.",
  alternates: {
    canonical: "/app",
  },
};

const homepageSchema = {
  "@context": "https://schema.org",
  "@type": ["WebPage", "ItemPage"],
  name: "7eats | Canada's First Meal Prep Marketplace",
  url: "https://www.7eats.ca/app",
  description:
    "Find cooks near you, browse weekly menus, and pay at checkout on Canada's first meal prep marketplace.",
  about: {
    "@type": "Service",
    name: "7eats Meal Prep Marketplace",
    areaServed: {
      "@type": "Country",
      name: "Canada",
    },
  },
};

export default async function AppLandingPage() {
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  let isLoggedIn = false;
  try {
    const session = await auth.api.getSession({ headers: requestHeaders });
    isLoggedIn = session?.user?.role === "client";
  } catch {
    // Public landing — treat as guest if session lookup fails.
  }

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, not user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageSchema) }}
      />
      <MarketplaceLanding isLoggedIn={isLoggedIn} />
    </>
  );
}
