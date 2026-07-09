import { headers } from "next/headers";
import Footer from "@/app/components/Footer";

export const metadata = {
  title: "Community Guidelines - 7eats",
  description:
    "Rules for respectful, honest, and safe use of the 7eats marketplace.",
  alternates: {
    canonical: "/community-guidelines",
  },
};

const webPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Community Guidelines - 7eats",
  url: "https://www.7eats.ca/community-guidelines",
  dateModified: "2026-06-15",
  description:
    "Rules for respectful, honest, and safe use of the 7eats marketplace.",
  isPartOf: {
    "@type": "WebSite",
    name: "7eats",
    url: "https://www.7eats.ca",
  },
};

const SECTIONS = [
  {
    num: "01",
    title: "Purpose",
    content: (
      <>
        <p>
          7eats should feel safe, useful, and respectful for customers, cooks,
          and the team that supports the platform. These Community Guidelines
          explain what we expect when people use listings, reviews, messages,
          support, checkout, and cook tools.
        </p>
        <p>
          These guidelines apply in addition to the Terms of Service, Cook
          Terms, Privacy Policy, Food Safety and Allergen Policy, and Refund and
          Cancellation Policy.
        </p>
      </>
    ),
  },
  {
    num: "02",
    title: "Be Honest",
    content: (
      <>
        <p>
          Use accurate information and do not mislead people. Customers rely on
          listings, reviews, messages, prices, photos, ingredients, allergens,
          dietary tags, fulfillment details, and account information when making
          decisions.
        </p>
        <ul className="policy-list">
          <li>Do not create fake accounts, orders, reviews, or messages.</li>
          <li>Do not impersonate another person, cook, business, or 7eats.</li>
          <li>Do not manipulate ratings, rankings, promotions, or payouts.</li>
          <li>
            Do not hide material information about food, pricing, or timing.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "03",
    title: "Be Respectful",
    content: (
      <>
        <p>
          Treat others professionally and respectfully. Disagreements, order
          issues, refunds, and reviews should be handled without abuse.
        </p>
        <ul className="policy-list">
          <li>No harassment, threats, bullying, stalking, or intimidation.</li>
          <li>No hateful, discriminatory, or degrading content.</li>
          <li>No sexual content or unwanted personal comments.</li>
          <li>No doxxing or sharing private information without permission.</li>
          <li>No spam, scams, phishing, or abusive support requests.</li>
        </ul>
      </>
    ),
  },
  {
    num: "04",
    title: "Reviews",
    content: (
      <>
        <p>
          Reviews should reflect real experiences with real orders. They help
          customers make decisions and help cooks improve.
        </p>
        <ul className="policy-list">
          <li>Do not post reviews for orders you did not experience.</li>
          <li>Do not pay for, trade for, pressure, or threaten reviews.</li>
          <li>Do not review your own listing or a competitor in bad faith.</li>
          <li>
            Do not include private information, hate, threats, or unrelated
            disputes in a review.
          </li>
          <li>
            Cooks may respond to reviews, but responses must remain respectful
            and focused on the issue.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "05",
    title: "Messages",
    content: (
      <>
        <p>
          Platform messages should be used for order questions, pickup or
          delivery details, allergy or ingredient questions, support, and other
          legitimate marketplace communication.
        </p>
        <ul className="policy-list">
          <li>Do not use messages to harass, threaten, or pressure anyone.</li>
          <li>Do not send spam, unrelated promotions, or deceptive links.</li>
          <li>
            Do not ask users to move confirmed platform orders off 7eats to
            avoid platform fees or protections.
          </li>
          <li>
            Do not share sensitive personal, payment, or medical information
            unless it is necessary for the order and you are comfortable doing
            so.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "06",
    title: "Listings and Food Claims",
    content: (
      <>
        <p>
          Cooks must keep listings accurate, lawful, and safe. Customers should
          be able to trust that a listing describes what they are ordering.
        </p>
        <ul className="policy-list">
          <li>No unsafe, illegal, recalled, expired, or mislabelled food.</li>
          <li>No unsupported health, nutrition, allergy, or medical claims.</li>
          <li>No misleading photos, prices, quantities, or availability.</li>
          <li>
            No prohibited or regulated items unless expressly allowed by law.
          </li>
          <li>
            No claims about certifications, inspections, insurance, or permits
            unless they are accurate and current.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "07",
    title: "Payments and Fraud",
    content: (
      <>
        <p>
          Do not misuse payments, refunds, promotions, subscriptions, deposits,
          disputes, chargebacks, or payouts.
        </p>
        <ul className="policy-list">
          <li>No stolen payment methods or unauthorized transactions.</li>
          <li>No refund abuse, chargeback abuse, or false order reports.</li>
          <li>No attempts to bypass platform fees on confirmed orders.</li>
          <li>No artificial order volume or fake transactions.</li>
          <li>
            No attempts to access another user&apos;s account or payment data.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "08",
    title: "Safety Reports",
    content: (
      <>
        <p>
          If you report a safety, allergen, illness, fraud, harassment, or
          payment concern, provide accurate information. False reports can harm
          customers, cooks, and legitimate investigations.
        </p>
        <p>
          If you are involved in a report, cooperate with reasonable requests
          for order details, photos, packaging, timing, messages, certificates,
          ingredient information, or other information needed to review the
          concern.
        </p>
      </>
    ),
  },
  {
    num: "09",
    title: "Enforcement",
    content: (
      <>
        <p>
          7eats may take action when we believe these guidelines, our terms, or
          the safety of the platform may be at risk.
        </p>
        <ul className="policy-list">
          <li>warning or education;</li>
          <li>content removal or editing requests;</li>
          <li>listing pause, review, or removal;</li>
          <li>refund, payout hold, or payment review;</li>
          <li>account suspension or termination;</li>
          <li>
            cooperation with payment providers, public health units, regulators,
            law enforcement, or other affected parties.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "10",
    title: "Contact",
    content: (
      <>
        <p>
          To report a concern, email{" "}
          <a href="mailto:team@7eats.ca">team@7eats.ca</a> with relevant
          details, screenshots, order numbers, and any safety information.
        </p>
      </>
    ),
  },
];

export default async function CommunityGuidelinesPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, not user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <main className="policy-page">
        <div className="wrap">
          <div className="policy-hero">
            <span className="eyebrow">Community</span>
            <h1 className="policy-title">Community Guidelines</h1>
            <p className="policy-meta">Last updated: June 15, 2026</p>
          </div>

          <div className="policy-body">
            <aside className="policy-nav">
              <ul>
                {SECTIONS.map((s) => (
                  <li key={s.num}>
                    <a href={`#section-${s.num}`}>
                      <span className="policy-nav-num">{s.num}</span>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="policy-content">
              {SECTIONS.map((s) => (
                <section
                  key={s.num}
                  id={`section-${s.num}`}
                  className="policy-section"
                >
                  <div className="policy-section-header">
                    <span className="policy-section-num">{s.num}</span>
                    <h2 className="policy-section-title">{s.title}</h2>
                  </div>
                  <div className="policy-section-body">{s.content}</div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
