import Footer from "@/app/components/Footer";
import Header from "@/app/components/Header";

export const metadata = {
  title: "Terms of Service - 7eats",
  description:
    "The terms that apply when customers and cooks use the 7eats marketplace.",
  alternates: {
    canonical: "/terms",
  },
};

const webPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Terms of Service - 7eats",
  url: "https://www.7eats.ca/terms",
  dateModified: "2026-06-15",
  description:
    "The terms that apply when customers and cooks use the 7eats marketplace.",
  isPartOf: {
    "@type": "WebSite",
    name: "7eats",
    url: "https://www.7eats.ca",
  },
};

const SECTIONS = [
  {
    num: "01",
    title: "Introduction",
    content: (
      <>
        <p>
          7eats Inc. (&quot;7eats&quot;, &quot;we&quot;, &quot;our&quot;, or
          &quot;us&quot;) operates a marketplace that helps customers discover
          and order meals from independent meal prep businesses, cooks, and food
          providers.
        </p>
        <p>
          These Terms of Service explain the rules for using 7eats. By creating
          an account, placing an order, listing food, sending a message, or
          otherwise using the platform, you agree to these terms and to our
          Privacy Policy, Food Safety and Allergen Policy, Refund and
          Cancellation Policy, and Community Guidelines.
        </p>
      </>
    ),
  },
  {
    num: "02",
    title: "Our Role",
    content: (
      <>
        <p>
          7eats provides technology that connects customers with independent
          cooks. Unless we say otherwise, 7eats does not prepare, package,
          label, store, transport, or sell the meals listed by cooks.
        </p>
        <p>
          Cooks are responsible for the meals they offer, including food safety,
          permits, ingredient accuracy, allergen information, pricing, taxes,
          availability, fulfillment, and customer service. 7eats may review,
          remove, or pause listings or accounts when we believe it is necessary
          to protect customers, cooks, the platform, or the public.
        </p>
      </>
    ),
  },
  {
    num: "03",
    title: "Accounts",
    content: (
      <>
        <p>
          You must provide accurate information when creating or using an
          account. You are responsible for keeping your login information secure
          and for all activity that happens through your account.
        </p>
        <ul className="policy-list">
          <li>You may not impersonate another person or business.</li>
          <li>You may not create accounts to avoid enforcement actions.</li>
          <li>
            You must promptly update information that becomes inaccurate,
            including contact, delivery, payment, or business details.
          </li>
          <li>
            You must be at least 16 years old to use 7eats as a customer. Cooks
            must be legally able to operate their food business.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "04",
    title: "Orders and Fulfillment",
    content: (
      <>
        <p>
          When you place an order, you are buying from the cook identified in
          the listing. The order details shown at checkout, including price,
          pickup or delivery method, timing, quantities, taxes, fees,
          subscription terms, deposits, and cancellation rules, form part of
          your agreement.
        </p>
        <ul className="policy-list">
          <li>
            Customers must review all order details before submitting payment.
          </li>
          <li>
            Cooks must fulfill accepted orders on time and as described in their
            listings.
          </li>
          <li>
            Pickup codes, delivery confirmations, and fulfillment records may be
            used to confirm completion and release funds.
          </li>
          <li>
            If there is a problem with an order, contact 7eats as soon as
            possible at <a href="mailto:contact@7eats.ca">contact@7eats.ca</a>.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "05",
    title: "Subscriptions",
    content: (
      <>
        <p>
          Some listings may allow recurring orders. If you choose a
          subscription, you authorize recurring charges at the interval shown at
          checkout until you cancel or the subscription ends.
        </p>
        <p>
          Subscription terms, including price, frequency, fulfillment method,
          cancellation timing, and any commitment period, must be shown before
          checkout. You can manage or cancel subscriptions from your account,
          subject to the cancellation rules shown for the listing and described
          in our Refund and Cancellation Policy.
        </p>
      </>
    ),
  },
  {
    num: "06",
    title: "Payments, Fees, and Taxes",
    content: (
      <>
        <p>
          7eats uses Stripe and Stripe Connect to process customer payments and
          cook payouts. 7eats does not store full card numbers or cook bank
          account details on our servers.
        </p>
        <ul className="policy-list">
          <li>
            Customers agree to pay the prices, taxes, delivery charges,
            deposits, subscription charges, and fees shown at checkout.
          </li>
          <li>
            Cooks agree to the platform fees and payout rules shown during
            onboarding or in their account.
          </li>
          <li>
            Cooks are responsible for their own taxes, permits, reporting, and
            business records unless 7eats expressly agrees otherwise in writing.
          </li>
          <li>
            We may delay, reverse, or hold payments when needed to address
            refunds, disputes, fraud, chargebacks, safety concerns, or legal
            obligations.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "07",
    title: "Food Safety and Allergens",
    content: (
      <>
        <p>
          Food can create serious risks, including allergic reactions, foodborne
          illness, choking, injury, or other harm. Customers must review listing
          information carefully and contact the cook before ordering if they
          have allergies, dietary restrictions, medical conditions, or questions
          about ingredients or preparation.
        </p>
        <p>
          Cooks are responsible for complying with food safety laws, keeping
          required certificates and permits current, accurately describing
          ingredients and allergens, and preparing, packaging, storing, and
          fulfilling food safely. Review our Food Safety and Allergen Policy for
          more detail.
        </p>
      </>
    ),
  },
  {
    num: "08",
    title: "Reviews, Messages, and Content",
    content: (
      <>
        <p>
          You may be able to post reviews, send messages, upload photos, create
          listings, or provide other content. You are responsible for the
          content you provide and must follow our Community Guidelines.
        </p>
        <ul className="policy-list">
          <li>Do not post false, misleading, abusive, or unlawful content.</li>
          <li>Do not post private information without permission.</li>
          <li>Do not manipulate reviews or create fake activity.</li>
          <li>
            Do not use 7eats to harass, threaten, discriminate against, or
            exploit another person.
          </li>
        </ul>
        <p>
          You allow 7eats to use content you provide as needed to operate,
          display, promote, moderate, and improve the platform.
        </p>
      </>
    ),
  },
  {
    num: "09",
    title: "Prohibited Uses",
    content: (
      <>
        <p>You may not use 7eats to:</p>
        <ul className="policy-list">
          <li>break the law or help someone else break the law;</li>
          <li>sell unsafe, illegal, mislabelled, or prohibited items;</li>
          <li>
            avoid platform fees or move confirmed platform orders offsite;
          </li>
          <li>interfere with platform security or availability;</li>
          <li>scrape, copy, reverse engineer, or misuse platform data;</li>
          <li>
            commit fraud, process unauthorized payments, or abuse refunds.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "10",
    title: "Disclaimers",
    content: (
      <>
        <p>
          We work to make 7eats reliable, useful, and safe, but the platform is
          provided on an &quot;as is&quot; and &quot;as available&quot; basis.
          We do not guarantee that every listing, cook, meal, delivery estimate,
          review, nutrition detail, allergen note, or availability status will
          be complete, accurate, current, or error-free.
        </p>
        <p>
          7eats does not provide medical, nutritional, allergy, food safety,
          legal, tax, or business advice. Any information on the platform is for
          general marketplace use only.
        </p>
      </>
    ),
  },
  {
    num: "11",
    title: "Limits on Responsibility",
    content: (
      <>
        <p>
          To the maximum extent allowed by law, 7eats is not responsible for
          losses caused by independent cooks, customer misuse, inaccurate
          listing information, food preparation issues, allergic reactions,
          foodborne illness, delivery or pickup problems, payment provider
          issues, outages, or events outside our reasonable control.
        </p>
        <p>
          Nothing in these terms is intended to limit rights that cannot legally
          be limited. If a rule in these terms is not enforceable, the rest of
          the terms will continue to apply.
        </p>
      </>
    ),
  },
  {
    num: "12",
    title: "Changes and Contact",
    content: (
      <>
        <p>
          We may update these terms as 7eats grows. When we do, we will update
          the date on this page. Continued use of 7eats after changes are posted
          means you accept the updated terms.
        </p>
        <p>
          Questions about these terms can be sent to{" "}
          <a href="mailto:contact@7eats.ca">contact@7eats.ca</a>.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, not user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <Header />
      <main className="policy-page">
        <div className="wrap">
          <div className="policy-hero">
            <span className="eyebrow">Legal</span>
            <h1 className="policy-title">Terms of Service</h1>
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
