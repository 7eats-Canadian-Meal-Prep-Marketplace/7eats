import type { Metadata } from "next";

// The application page is a client component, so its page-level metadata lives
// here in a layout. This route is listed in the sitemap and is a key
// conversion page for acquiring cooks.
export const metadata: Metadata = {
  title: "Apply to Cook on 7eats | Toronto Meal Prep Marketplace",
  description:
    "Apply to join 7eats as a cook or meal prep business in Toronto. List your menu, reach new customers, and get paid without the admin overhead. First 30 cooks get 0% platform fee for 90 days.",
  alternates: {
    canonical: "/business/application",
  },
  openGraph: {
    title: "Apply to Cook on 7eats",
    description:
      "Join 7eats as a Toronto meal prep business. List your menu, reach customers, and get paid. First 30 cooks get 0% platform fee for 90 days.",
    url: "https://www.7eats.ca/business/application",
    siteName: "7eats",
    locale: "en_CA",
    type: "website",
  },
};

export default function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
