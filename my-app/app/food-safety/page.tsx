import Footer from "@/app/components/Footer";

export const metadata = {
  title: "Food Safety and Allergen Policy - 7eats",
  description:
    "How 7eats approaches food safety, allergen information, customer reports, and cook responsibilities.",
  alternates: {
    canonical: "/food-safety",
  },
};

const webPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Food Safety and Allergen Policy - 7eats",
  url: "https://www.7eats.ca/food-safety",
  dateModified: "2026-06-15",
  description:
    "How 7eats approaches food safety, allergen information, customer reports, and cook responsibilities.",
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
          7eats is a marketplace for meals prepared by independent cooks and
          meal prep businesses. Food safety matters because food can cause
          serious harm when it is prepared, stored, labelled, transported, or
          consumed incorrectly.
        </p>
        <p>
          This policy explains the responsibilities of cooks, customers, and
          7eats. It is not medical advice, nutrition advice, legal advice, or a
          substitute for instructions from a doctor, public health unit, or
          regulator.
        </p>
      </>
    ),
  },
  {
    num: "02",
    title: "Emergency Notice",
    content: (
      <>
        <p>
          If you believe you are having a medical emergency, severe allergic
          reaction, or serious foodborne illness, call emergency services or
          seek medical care immediately. Do not wait for a response from 7eats
          or a cook.
        </p>
        <p>
          After you are safe, report the issue to 7eats at{" "}
          <a href="mailto:contact@7eats.ca">contact@7eats.ca</a> with your order
          number, cook name, meal name, symptoms or concern, timing, and any
          photos or packaging details you can safely provide.
        </p>
      </>
    ),
  },
  {
    num: "03",
    title: "7eats Marketplace Role",
    content: (
      <>
        <p>
          7eats provides marketplace tools, account onboarding, listing review,
          payment processing, messaging, and support workflows. Unless we
          expressly say otherwise, 7eats does not prepare, package, inspect,
          store, transport, or serve the meals listed by cooks.
        </p>
        <p>
          We may review cook information and take safety-related actions, but
          our review is not a guarantee that any meal, cook, kitchen, ingredient
          list, allergen statement, or dietary claim is risk-free.
        </p>
      </>
    ),
  },
  {
    num: "04",
    title: "Cook Responsibilities",
    content: (
      <>
        <p>Cooks are responsible for food safety in their own operations.</p>
        <ul className="policy-list">
          <li>
            Follow applicable public health, food premises, inspection, and
            municipal requirements.
          </li>
          <li>
            Keep required food handler certificates, permits, inspections, and
            business information current.
          </li>
          <li>
            Use safe ingredients, safe water, clean equipment, and proper
            sanitation.
          </li>
          <li>
            Maintain safe food temperatures during preparation, storage,
            packaging, pickup, and delivery.
          </li>
          <li>
            Prevent cross-contamination and allergen cross-contact wherever
            possible.
          </li>
          <li>
            Pause orders and notify 7eats immediately if food may be unsafe.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "05",
    title: "Ingredient and Allergen Accuracy",
    content: (
      <>
        <p>
          Cooks must accurately describe ingredients, allergens, dietary tags,
          preparation methods, and any limitations on special requests.
          Inaccurate allergen information can cause serious injury or death.
        </p>
        <ul className="policy-list">
          <li>
            Do not mark a dish as allergen-free unless you can support that
            claim.
          </li>
          <li>
            Do not use dietary labels like halal, kosher, vegan, vegetarian,
            gluten-free, dairy-free, or nut-free unless the claim is accurate.
          </li>
          <li>
            Update listings when suppliers, recipes, ingredients, kitchens, or
            preparation methods change.
          </li>
          <li>
            Decline special requests you cannot safely or accurately fulfill.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "06",
    title: "Customer Responsibilities",
    content: (
      <>
        <p>
          Customers must review meal information carefully before ordering. If
          you have an allergy, intolerance, medical condition, pregnancy-related
          restriction, religious requirement, or other dietary concern, contact
          the cook before ordering and decide whether the meal is appropriate
          for you.
        </p>
        <ul className="policy-list">
          <li>Read ingredients, allergens, dietary tags, and descriptions.</li>
          <li>
            Ask questions before ordering if anything is unclear or important to
            your health.
          </li>
          <li>
            Do not rely on 7eats as a medical, nutrition, or allergy advisor.
          </li>
          <li>
            Store, reheat, and consume food safely after pickup or delivery.
          </li>
          <li>
            Do not eat food that appears spoiled, damaged, contaminated,
            incorrectly labelled, or unsafe.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "07",
    title: "Pickup, Delivery, and Storage",
    content: (
      <>
        <p>
          Food safety continues after preparation. Cooks and customers should
          both take reasonable steps to keep meals safe during pickup, delivery,
          storage, reheating, and consumption.
        </p>
        <ul className="policy-list">
          <li>
            Cooks should package meals securely and provide practical storage or
            reheating instructions when appropriate.
          </li>
          <li>
            Customers should pick up orders on time and refrigerate or consume
            meals promptly.
          </li>
          <li>
            Delivery availability does not remove the cook&apos;s responsibility
            to package and fulfill food safely.
          </li>
          <li>
            If a meal is delayed, damaged, opened, leaking, unusually warm or
            cold, or otherwise unsafe, do not consume it.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "08",
    title: "Reports and Investigations",
    content: (
      <>
        <p>
          7eats takes food safety and allergen reports seriously. Depending on
          the situation, we may ask for order details, photos, packaging,
          ingredient information, cook records, customer symptoms, timing, and
          other information needed to understand the report.
        </p>
        <p>We may take one or more of the following actions:</p>
        <ul className="policy-list">
          <li>contact the cook or customer for more information;</li>
          <li>pause listings, orders, subscriptions, or payouts;</li>
          <li>issue refunds or credits when appropriate;</li>
          <li>remove listings or suspend accounts;</li>
          <li>
            recommend that affected users contact public health or a doctor;
          </li>
          <li>
            cooperate with public health units, regulators, insurers, payment
            providers, or law enforcement when appropriate.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "09",
    title: "Public Health and Recalls",
    content: (
      <>
        <p>
          If a cook, customer, public health unit, supplier, or other source
          reports a possible contamination, allergen, illness, recall, or unsafe
          food issue, 7eats may share relevant information with affected users
          and appropriate authorities.
        </p>
        <p>
          Cooks must cooperate with safety reviews, recalls, customer notices,
          refunds, public health requests, and any reasonable instructions
          needed to reduce risk.
        </p>
      </>
    ),
  },
  {
    num: "10",
    title: "Contact",
    content: (
      <>
        <p>
          To report a food safety or allergen concern, email{" "}
          <a href="mailto:contact@7eats.ca">contact@7eats.ca</a>. Include your
          order number and as much detail as you safely can.
        </p>
      </>
    ),
  },
];

export default function FoodSafetyPage() {
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
            <span className="eyebrow">Safety</span>
            <h1 className="policy-title">Food Safety and Allergen Policy</h1>
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
