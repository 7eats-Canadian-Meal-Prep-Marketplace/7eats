import type { Metadata } from "next";

// The browse page itself is a client component, so page-level metadata lives
// here in a layout. This is an indexable, crawlable route (allowed in
// robots.txt) and one of the highest-value pages for local discovery.
export const metadata: Metadata = {
  title: "Browse Meal Prep in Toronto | 7eats",
  description:
    "Browse local meal prep in Toronto. Discover home cooks and meal prep businesses serving halal, vegan, high-protein, and culturally specific meals, and order fresh, made-to-order food near you.",
  alternates: {
    canonical: "/app/browse",
  },
  openGraph: {
    title: "Browse Meal Prep in Toronto | 7eats",
    description:
      "Discover local home cooks and meal prep businesses in Toronto. Order fresh, made-to-order meals near you.",
    url: "https://www.7eats.ca/app/browse",
    siteName: "7eats",
    locale: "en_CA",
    type: "website",
  },
};

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
