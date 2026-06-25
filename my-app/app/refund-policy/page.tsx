import Footer from "@/app/components/Footer";

export const metadata = {
  title: "Refund and Cancellation Policy - 7eats",
  description: "How refunds, cancellations, and order disputes work on 7eats.",
  alternates: {
    canonical: "/refund-policy",
  },
};

const webPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Refund and Cancellation Policy - 7eats",
  url: "https://www.7eats.ca/refund-policy",
  dateModified: "2026-06-15",
  description: "How refunds, cancellations, and order disputes work on 7eats.",
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
          This Refund and Cancellation Policy explains how 7eats handles order
          cancellations, refunds, failed fulfillment, customer concerns, and
          payment disputes.
        </p>
        <p>
          The exact rules for a specific order depend on the cook&apos;s
          cancellation policy shown at checkout, the order status, and the
          payment status.
        </p>
      </>
    ),
  },
  {
    num: "02",
    title: "Before Checkout",
    content: (
      <>
        <p>
          Customers should review all order details before paying, including the
          meals, cook, price, taxes, fees, quantity, pickup or delivery method,
          timing, the cook&apos;s cancellation policy, and any special notes.
        </p>
        <p>
          If something is unclear, contact the cook before ordering. 7eats may
          not be able to refund an order simply because a customer missed
          information that was shown before checkout.
        </p>
      </>
    ),
  },
  {
    num: "03",
    title: "Customer Cancellations",
    content: (
      <>
        <p>
          Each cook sets one of two cancellation policies, shown to you at
          checkout before you pay:
        </p>
        <ul className="policy-list">
          <li>
            <strong>Refund before the lead date.</strong> You may cancel for a
            full refund up until the cook&apos;s lead time before your pickup or
            delivery. After that point, the order is final.
          </li>
          <li>
            <strong>All sales final.</strong> The cook does not accept
            cancellations or refunds for the order once it is placed.
          </li>
        </ul>
        <p>
          The applicable policy and, where refunds are allowed, the exact
          cancel-by time are displayed on the cook&apos;s menu and again at
          checkout, where you must confirm you understand them before paying.
        </p>
      </>
    ),
  },
  {
    num: "04",
    title: "Cook Cancellations",
    content: (
      <>
        <p>
          If a cook cancels or cannot fulfill an accepted order as promised, the
          customer will generally receive a full refund for the affected order
          unless the customer accepts a replacement arrangement.
        </p>
        <p>
          Repeated cook cancellations, late fulfillment, unsafe food concerns,
          or inaccurate availability may lead to account review, limits, payout
          holds, or removal from 7eats.
        </p>
      </>
    ),
  },
  {
    num: "05",
    title: "How Payments Are Handled",
    content: (
      <>
        <p>
          When you place an order, your payment is authorized and held. Funds
          are released to the cook through platform tools such as pickup codes,
          delivery confirmation, or order status.
        </p>
        <ul className="policy-list">
          <li>
            If you cancel while a refund is allowed by the cook&apos;s policy,
            the held payment is refunded in full.
          </li>
          <li>
            If the cook&apos;s policy is &quot;all sales final&quot; or the
            refund window has passed, the payment is released to the cook.
          </li>
          <li>
            7eats may delay release of funds during a dispute, safety report,
            chargeback, fraud review, or technical issue.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "06",
    title: "Cook Cancellation Settings",
    content: (
      <>
        <p>
          Cooks choose their cancellation policy during setup and can change it
          in their settings. The policy that applies to your order is the one
          shown at the time you place it.
        </p>
        <p>
          Cooks are expected to keep this policy accurate and honor it. Repeated
          disputes or failure to honor a stated policy may lead to account
          review.
        </p>
      </>
    ),
  },
  {
    num: "07",
    title: "Food Quality and Safety Concerns",
    content: (
      <>
        <p>
          If an order is missing, materially different from the menu
          description, unsafe, spoiled, damaged, incorrectly labelled, or
          affected by a serious allergen concern, contact 7eats as soon as
          possible.
        </p>
        <p>
          We may request photos, packaging, timing, message history, medical or
          public health details, and other information needed to review the
          concern. Depending on the situation, 7eats may issue a full refund,
          partial refund, credit, replacement coordination, account action, or
          no refund.
        </p>
      </>
    ),
  },
  {
    num: "08",
    title: "No-Shows and Missed Pickup",
    content: (
      <>
        <p>
          Customers are responsible for arriving during the pickup window or
          being available for the agreed delivery arrangement. If a customer
          does not pick up an order or is unavailable for delivery, the order
          may not be refundable.
        </p>
        <p>
          Cooks should make reasonable efforts to communicate through the
          platform when there is a pickup or delivery issue, but they are not
          required to remake or hold food indefinitely.
        </p>
      </>
    ),
  },
  {
    num: "09",
    title: "Payment Disputes and Chargebacks",
    content: (
      <>
        <p>
          If a customer disputes a payment with their card issuer, Stripe, or
          another payment provider, 7eats may share order records, messages,
          fulfillment confirmations, refund decisions, and related evidence with
          the payment provider.
        </p>
        <p>
          Cooks may be responsible for chargebacks, dispute fees, refunds, or
          reversals connected to their orders, especially when the dispute is
          caused by failed fulfillment, inaccurate menus, unsafe food, fraud, or
          violation of platform rules.
        </p>
      </>
    ),
  },
  {
    num: "10",
    title: "Processing Time",
    content: (
      <>
        <p>
          Approved refunds are processed through the original payment method
          where possible. Banks, card networks, and payment providers may take
          additional time to show the refund on a customer&apos;s statement.
        </p>
        <p>
          7eats cannot control bank processing times after a refund has been
          submitted.
        </p>
      </>
    ),
  },
  {
    num: "11",
    title: "How To Request Help",
    content: (
      <>
        <p>
          To request help with a cancellation, refund, or order issue, email{" "}
          <a href="mailto:team@7eats.ca">team@7eats.ca</a>. Include your order
          number, cook name, issue summary, photos if useful, and any relevant
          messages.
        </p>
      </>
    ),
  },
];

export default function RefundPolicyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, not user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <main className="policy-page">
        <div className="wrap">
          <div className="policy-hero">
            <span className="eyebrow">Legal</span>
            <h1 className="policy-title">Refund and Cancellation Policy</h1>
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
