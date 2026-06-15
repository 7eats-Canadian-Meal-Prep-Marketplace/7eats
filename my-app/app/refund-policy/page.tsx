import Footer from "@/app/components/Footer";
import Header from "@/app/components/Header";

export const metadata = {
  title: "Refund and Cancellation Policy - 7eats",
  description:
    "How refunds, cancellations, deposits, subscriptions, and order disputes work on 7eats.",
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
  description:
    "How refunds, cancellations, deposits, subscriptions, and order disputes work on 7eats.",
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
          cancellations, refunds, deposits, subscriptions, failed fulfillment,
          customer concerns, and payment disputes.
        </p>
        <p>
          The exact rules for a specific order may depend on the listing,
          checkout details, order status, cook cancellation settings, payment
          status, and whether the order is one-time or recurring.
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
          meal, cook, price, taxes, fees, quantity, pickup or delivery method,
          timing, subscription frequency, cancellation cutoff, deposit terms,
          and any special notes.
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
          If a customer cancels before the cancellation cutoff shown for the
          order, the customer will generally receive a full refund for the
          cancellable portion of the order.
        </p>
        <p>
          If a customer cancels after the cutoff, the cook may already have
          purchased ingredients, prepared food, reserved capacity, or declined
          other orders. Late cancellations may be non-refundable or may result
          in a partial refund, deposit retention, or late cancellation fee as
          shown at checkout.
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
          or inaccurate availability may lead to listing review, account limits,
          payout holds, or removal from 7eats.
        </p>
      </>
    ),
  },
  {
    num: "05",
    title: "Deposits and Held Payments",
    content: (
      <>
        <p>
          Some orders may use deposits, payment holds, or staged payment
          release. These tools help protect both customers and cooks when food
          is prepared in advance.
        </p>
        <ul className="policy-list">
          <li>
            A refundable deposit may be returned if cancellation happens before
            the stated cutoff.
          </li>
          <li>
            A non-refundable or late-cancellation deposit may be kept by the
            cook if the customer cancels too late.
          </li>
          <li>
            Funds may be held until fulfillment is confirmed through platform
            tools such as pickup codes, delivery confirmation, or order status.
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
    title: "Subscriptions",
    content: (
      <>
        <p>
          Subscription orders renew at the interval shown at checkout until they
          are cancelled or end. Cancelling a subscription stops future renewal
          charges, but it may not automatically cancel an order that is already
          inside the cook&apos;s cutoff window.
        </p>
        <p>
          If a subscription order has already been accepted, prepared, or moved
          past the cancellation cutoff, the regular order cancellation rules may
          apply to that order. Customers should cancel subscriptions before the
          next cutoff to avoid unwanted recurring orders.
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
          If an order is missing, materially different from the listing, unsafe,
          spoiled, damaged, incorrectly labelled, or affected by a serious
          allergen concern, contact 7eats as soon as possible.
        </p>
        <p>
          We may request photos, packaging, timing, message history, medical or
          public health details, and other information needed to review the
          concern. Depending on the situation, 7eats may issue a full refund,
          partial refund, credit, replacement coordination, listing action, or
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
          caused by failed fulfillment, inaccurate listings, unsafe food, fraud,
          or violation of platform rules.
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
          <a href="mailto:contact@7eats.ca">contact@7eats.ca</a>. Include your
          order number, cook name, issue summary, photos if useful, and any
          relevant messages.
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
      <Header />
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
