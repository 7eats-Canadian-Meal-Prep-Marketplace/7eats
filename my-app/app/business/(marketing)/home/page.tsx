import {
  CalendarCheck,
  ListFilter,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata = {
  title: "Cook with 7eats - Join Toronto's meal prep marketplace",
  description:
    "List your menu, take confirmed orders, and get paid without the admin overhead. 7eats is built for Toronto's home cooks and meal prep operators.",
  alternates: {
    canonical: "/business/home",
  },
};

const FEATURES = [
  {
    num: "01",
    icon: <CalendarCheck size={20} strokeWidth={1.75} />,
    title: "New customers, already searching",
    desc: "7eats puts your menu in front of Toronto customers actively looking for meal prep. Halal, vegan, high-protein - they find you by searching for exactly what you cook.",
  },
  {
    num: "02",
    icon: <ShieldCheck size={20} strokeWidth={1.75} />,
    title: "Payment upfront, every time",
    desc: "Customers pay at checkout. No chasing e-transfers, no no-shows. Every order on your calendar is confirmed and paid before you touch a pan.",
  },
  {
    num: "03",
    icon: <ListFilter size={20} strokeWidth={1.75} />,
    title: "Orders and pickups, coordinated",
    desc: "Your weekly schedule, incoming orders, and customer pickups in one place. Know exactly what to prep and for who, days before service.",
  },
  {
    num: "04",
    icon: <TrendingUp size={20} strokeWidth={1.75} />,
    title: "Your pricing. Your call.",
    desc: "Run a flash deal to move extra portions, or raise prices when demand spikes. You control your rates, we never touch them.",
  },
];

const cookPlatformSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "7eats Cook Platform",
  description:
    "7eats is the marketplace platform for Toronto's home cooks and meal prep operators. List your menu, take confirmed upfront-paid orders, and manage every order, payment, and pickup in one place.",
  serviceType: "Marketplace Platform for Meal Prep Businesses",
  provider: {
    "@type": "Organization",
    name: "7eats",
    url: "https://www.7eats.ca",
  },
  areaServed: {
    "@type": "City",
    name: "Toronto",
    addressCountry: "CA",
    addressRegion: "ON",
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Cook Platform Features",
    itemListElement: FEATURES.map((f, i) => ({
      "@type": "Offer",
      position: i + 1,
      name: f.title,
      description: f.desc,
    })),
  },
};

export default function BusinessHomePage() {
  return (
    <main>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, not user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cookPlatformSchema) }}
      />
      {/* HERO — full-bleed video background, content left-aligned */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <video className={styles.heroVideo} autoPlay muted loop playsInline>
            <source src="/chef-cooking.mp4" type="video/mp4" />
          </video>
          <div className={styles.heroFallback}>
            <span className="ph-tag">Hero video</span>
            <span className="ph-note">
              10–30 s looping kitchen clip — meal prep, plating, or packaging.
              Drop chef_cooking.mp4 into /public to replace.
            </span>
          </div>
        </div>

        <div className={styles.heroOverlay} />

        <div className={`wrap ${styles.heroContent}`}>
          <div className={styles.heroTop}>
            <span className={`eyebrow on-dark`}>
              Cooks &amp; meal prep operators · Toronto, ON
            </span>
          </div>

          <h1 className={styles.heroHeadline}>
            The marketplace that fills your meal prep calendar.
          </h1>
          <p className={styles.heroSub}>
            Get discovered by customers searching for your cuisine, then manage
            every order, payment, and pickup in one place.
          </p>
          <div className={styles.heroDivider} />
          <div className={styles.heroBottom}>
            <Link href="/business/application" className="btn btn-primary">
              Join the platform
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className={`section ${styles.features}`}>
        <div className="wrap">
          <div className={styles.featuresHead}>
            <span className={`eyebrow ${styles.featuresEyebrow}`}>
              What you get
            </span>
            <h2 className={styles.featuresHeadline}>
              Attract more customers. Run a tighter operation.
            </h2>
          </div>

          <div className={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <div key={f.num} className={styles.featureCard}>
                <div className={styles.featureTop}>
                  <span className={styles.featureNum}>{f.num}</span>
                  <div className={styles.featureIcon}>{f.icon}</div>
                </div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
      <section className={`section tight ${styles.cta}`}>
        <div className="wrap">
          <div className={styles.ctaInner}>
            <div className={styles.ctaText}>
              <h2 className={styles.ctaHeadline}>
                You built the business. We built the platform.
              </h2>
              <p className={styles.ctaSub}>
                Apply in two minutes. Expect to hear from us within 48 hours.
              </p>
            </div>
            <div className={styles.ctaAction}>
              <Link
                href="/business/application"
                className="btn btn-ghost on-dark"
              >
                Start your application
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
