import Footer from "@/app/components/Footer";
import Header from "@/app/components/Header";

export const metadata = {
  title: "Cook Terms - 7eats",
  description:
    "The marketplace terms for cooks and meal prep businesses that list on 7eats.",
  alternates: {
    canonical: "/cook-terms",
  },
};

const webPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Cook Terms - 7eats",
  url: "https://www.7eats.ca/cook-terms",
  dateModified: "2026-06-15",
  description:
    "The marketplace terms for cooks and meal prep businesses that list on 7eats.",
  isPartOf: {
    "@type": "WebSite",
    name: "7eats",
    url: "https://www.7eats.ca",
  },
};

const SECTIONS = [
  {
    num: "01",
    title: "Who These Terms Apply To",
    content: (
      <>
        <p>
          These Cook Terms apply to any cook, meal prep business, caterer,
          kitchen, or other food provider that applies to, lists on, or accepts
          orders through 7eats.
        </p>
        <p>
          These terms work together with the 7eats Terms of Service, Privacy
          Policy, Food Safety and Allergen Policy, Refund and Cancellation
          Policy, and Community Guidelines. If there is a conflict, these Cook
          Terms apply to cook-specific responsibilities.
        </p>
      </>
    ),
  },
  {
    num: "02",
    title: "Independent Businesses",
    content: (
      <>
        <p>
          Cooks are independent businesses or individuals, not employees,
          partners, agents, or representatives of 7eats. You control your own
          food operations, pricing, availability, taxes, permits, supplies,
          employees, contractors, equipment, and customer fulfillment.
        </p>
        <p>
          7eats provides the marketplace tools used to list meals, receive
          orders, communicate with customers, collect payment, and coordinate
          payouts. 7eats does not take over your legal responsibility for the
          food you prepare or the business you operate.
        </p>
      </>
    ),
  },
  {
    num: "03",
    title: "Eligibility and Compliance",
    content: (
      <>
        <p>
          You may only list on 7eats if you are allowed to operate your food
          business where you are located and where you serve customers. You are
          responsible for understanding and following all laws and requirements
          that apply to your food business.
        </p>
        <ul className="policy-list">
          <li>food premises, public health, and inspection requirements;</li>
          <li>food handler training or certification requirements;</li>
          <li>municipal licensing, zoning, fire, water, and waste rules;</li>
          <li>labelling, ingredient, allergen, and nutrition rules;</li>
          <li>business registration, tax, insurance, and employment rules;</li>
          <li>delivery, pickup, packaging, and temperature-control rules.</li>
        </ul>
        <p>
          If you are unsure whether you can legally sell a meal, do not list it
          until you have confirmed your obligations with the appropriate public
          health unit, municipality, advisor, or regulator.
        </p>
      </>
    ),
  },
  {
    num: "04",
    title: "Certificates and Review",
    content: (
      <>
        <p>
          7eats may ask for food handler certificates, business information,
          address information, identity details, photos, menus, inspection
          records, insurance documents, or other materials before allowing a
          listing or account to go live.
        </p>
        <p>
          You must provide accurate, current documents and tell us promptly if
          they expire, are suspended, are revoked, or become inaccurate. Our
          review process is a platform safety step. It is not a guarantee that a
          cook is fully compliant with every legal requirement, and it does not
          transfer your compliance duties to 7eats.
        </p>
      </>
    ),
  },
  {
    num: "05",
    title: "Listings and Menu Accuracy",
    content: (
      <>
        <p>
          You are responsible for every listing, dish, photo, description,
          price, promotion, availability window, fulfillment option, ingredient
          note, dietary tag, allergen tag, and subscription term you publish or
          submit.
        </p>
        <ul className="policy-list">
          <li>Do not exaggerate, hide, or misrepresent ingredients.</li>
          <li>
            Do not mark food as halal, kosher, vegan, vegetarian, gluten-free,
            dairy-free, nut-free, or similar unless you can support that claim.
          </li>
          <li>
            Keep photos and descriptions aligned with what customers actually
            receive.
          </li>
          <li>
            Remove or pause listings when ingredients, preparation, capacity, or
            availability changes.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "06",
    title: "Food Safety Duties",
    content: (
      <>
        <p>
          You are responsible for preparing, storing, packaging, labelling,
          transporting, and fulfilling food safely. This includes preventing
          contamination, maintaining safe temperatures, cleaning and sanitizing
          equipment, using safe water and ingredients, and following public
          health guidance.
        </p>
        <p>
          If you know or suspect that food you prepared may be unsafe, you must
          stop fulfilling affected orders, notify 7eats immediately, cooperate
          with any recall or customer notice, and follow instructions from
          public health officials.
        </p>
      </>
    ),
  },
  {
    num: "07",
    title: "Allergens and Special Requests",
    content: (
      <>
        <p>
          Allergens can cause serious injury or death. You must be careful and
          accurate when describing allergens, ingredients, dietary claims, and
          preparation methods.
        </p>
        <ul className="policy-list">
          <li>
            Disclose known allergens and ingredients clearly in each listing.
          </li>
          <li>
            Do not promise an allergen-free item unless you can control
            cross-contact and support the claim.
          </li>
          <li>
            Review customer notes before preparing orders and decline requests
            you cannot safely fulfill.
          </li>
          <li>
            Tell customers when you cannot accommodate an allergy, intolerance,
            medical restriction, religious requirement, or special request.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "08",
    title: "Order Fulfillment",
    content: (
      <>
        <p>
          When you accept an order, you agree to fulfill it according to the
          listing and checkout details. You must maintain capacity settings,
          pickup windows, delivery options, lead times, and cancellation rules
          that you can realistically meet.
        </p>
        <ul className="policy-list">
          <li>Prepare orders with reasonable care and skill.</li>
          <li>Package food so it can be safely picked up or delivered.</li>
          <li>Be available during stated pickup or delivery windows.</li>
          <li>Use platform tools honestly to confirm fulfillment.</li>
          <li>
            Contact the customer and 7eats promptly if an order cannot be
            fulfilled as promised.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "09",
    title: "Payments, Fees, and Payouts",
    content: (
      <>
        <p>
          7eats uses Stripe Connect to process payouts. You must complete Stripe
          onboarding and keep your payout information current. Stripe may
          require identity, tax, banking, and business details before payouts
          can be made.
        </p>
        <p>
          Platform fees, refunds, chargebacks, disputes, taxes, payout timing,
          reserves, and payment holds may affect the amount or timing of your
          payout. We may withhold or reverse funds when needed to handle
          customer refunds, failed fulfillment, suspected fraud, food safety
          concerns, payment disputes, or legal obligations.
        </p>
      </>
    ),
  },
  {
    num: "10",
    title: "Customer Communication",
    content: (
      <>
        <p>
          Use customer information only to fulfill orders, respond to customer
          questions, handle support issues, and operate through 7eats. Do not
          use customer information for unrelated marketing, resale, scraping,
          harassment, or off-platform solicitation.
        </p>
        <p>
          Keep messages professional, respectful, and focused on the order or
          customer support issue. The Community Guidelines apply to all cook and
          customer communications.
        </p>
      </>
    ),
  },
  {
    num: "11",
    title: "Insurance and Risk",
    content: (
      <>
        <p>
          Food businesses can create serious risk. We strongly recommend that
          cooks maintain appropriate commercial general liability, product
          liability, business property, vehicle, and other insurance for their
          operations. 7eats may require proof of insurance before allowing some
          cooks, listings, or services to remain active.
        </p>
        <p>
          You are responsible for claims, losses, investigations, penalties,
          injuries, illnesses, allergic reactions, property damage, or disputes
          caused by your food, listings, conduct, business operations, or
          failure to follow these terms.
        </p>
      </>
    ),
  },
  {
    num: "12",
    title: "Account Actions",
    content: (
      <>
        <p>
          7eats may reject, pause, remove, suspend, or terminate a cook account,
          application, listing, payout, promotion, review, or message if we
          believe it may create legal, safety, fraud, payment, customer, or
          platform risk.
        </p>
        <p>
          We may also cooperate with public health units, payment providers, law
          enforcement, regulators, insurers, or affected users when a safety,
          legal, or fraud issue is reported.
        </p>
      </>
    ),
  },
  {
    num: "13",
    title: "Contact",
    content: (
      <>
        <p>
          Questions about these Cook Terms or your cook account can be sent to{" "}
          <a href="mailto:contact@7eats.ca">contact@7eats.ca</a>.
        </p>
      </>
    ),
  },
];

export default function CookTermsPage() {
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
            <h1 className="policy-title">Cook Terms</h1>
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
