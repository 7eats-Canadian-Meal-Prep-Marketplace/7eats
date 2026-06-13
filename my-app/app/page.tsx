import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/app/components/Footer";
import Header from "@/app/components/Header";

export const metadata: Metadata = {
  title: "7eats — Canada's Meal Prep Marketplace",
  description:
    "7eats connects Toronto's home cooks and meal prep businesses with customers looking for fresh, local, made-to-order meals. List your menu, reach new customers, and get paid without the admin overhead.",
  alternates: {
    canonical: "/",
  },
};

const homepageSchema = {
  "@context": "https://schema.org",
  "@type": ["WebPage", "ItemPage"],
  name: "7eats — Canada's Meal Prep Marketplace",
  url: "https://www.7eats.ca",
  description:
    "7eats connects Toronto's home cooks and meal prep businesses with customers looking for fresh, local, made-to-order meals. Browse cooks, place orders, get paid.",
  about: {
    "@type": "Service",
    name: "7eats Meal Prep Marketplace",
    areaServed: {
      "@type": "AdministrativeArea",
      name: "Toronto, Ontario, Canada",
    },
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, not user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageSchema) }}
      />
      <Header />
      <main>
        <section className="section">
          <div className="wrap">
            <span className="eyebrow">Canada&apos;s meal prep marketplace</span>
            <h1 className="h-xl">
              Your meal prep business is ready to scale. We&apos;re
              building&nbsp;the platform for it.
            </h1>
            <p className="lead">
              7eats is a marketplace for meal prep businesses and home cooks in
              Toronto. List your menu, set your prices, and get discovered by
              customers actively looking for halal, vegan, high-protein, and
              culturally specific meals. Orders and payments handled for you.
            </p>
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                marginTop: "24px",
              }}
            >
              <Link href="/public/waitlist" className="btn btn-primary">
                Join as a cook
              </Link>
              <Link href="/app/browse" className="btn btn-ghost">
                Browse meal prep
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
