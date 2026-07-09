import { headers } from "next/headers";
import Footer from "@/app/components/Footer";

export const metadata = {
  title: "Privacy Policy - 7eats",
  description:
    "How 7eats collects, uses, shares, and protects personal information.",
  alternates: {
    canonical: "/privacy",
  },
};

const webPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Privacy Policy - 7eats",
  url: "https://www.7eats.ca/privacy",
  dateModified: "2026-06-15",
  description:
    "How 7eats collects, uses, shares, and protects personal information.",
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
          &quot;us&quot;) operates the 7eats marketplace at{" "}
          <strong>7eats.ca</strong>. This Privacy Policy explains how we
          collect, use, share, retain, and protect personal information when
          people use our website, customer app, cook tools, checkout, messaging,
          support, and related services.
        </p>
        <p>
          We are based in Ontario, Canada and aim to handle personal information
          in accordance with the{" "}
          <em>Personal Information Protection and Electronic Documents Act</em>{" "}
          (PIPEDA), Canada&apos;s Anti-Spam Legislation (CASL), and other laws
          that apply to our business.
        </p>
      </>
    ),
  },
  {
    num: "02",
    title: "Privacy Contact",
    content: (
      <>
        <p>
          Contact us with privacy questions, access requests, correction
          requests, deletion requests, withdrawal of consent, or complaints.
        </p>
        <div className="policy-contact-card">
          <div className="policy-contact-row">
            <span className="policy-contact-label">Organization</span>
            <span>7eats Inc.</span>
          </div>
          <div className="policy-contact-row">
            <span className="policy-contact-label">Location</span>
            <span>Ontario, Canada</span>
          </div>
          <div className="policy-contact-row">
            <span className="policy-contact-label">Email</span>
            <a href="mailto:team@7eats.ca">team@7eats.ca</a>
          </div>
        </div>
      </>
    ),
  },
  {
    num: "03",
    title: "Information We Collect",
    content: (
      <>
        <p>
          We collect information needed to operate the marketplace, process
          orders, support customers and cooks, improve safety, prevent fraud,
          and meet legal obligations.
        </p>
        <h3>3.1 Account and Profile Information</h3>
        <p>
          We may collect your name, email address, phone number, password or
          authentication information, date of birth, neighborhood, profile
          photo, role, account status, notification preferences, and other
          information you add to your account.
        </p>
        <h3>3.2 Customer Marketplace Information</h3>
        <p>
          We may collect saved listings, followed cooks, dietary preferences,
          allergies, goals, order history, subscriptions, order notes, pickup or
          delivery details, messages, reviews, support requests, and
          cancellation or refund records.
        </p>
        <h3>3.3 Cook and Business Information</h3>
        <p>
          For cooks and applicants, we may collect kitchen name, business
          contact details, address, pickup address, website, social links,
          business phone and email, contact person information, menu details,
          listing photos, capacity, delivery settings, food handler certificate
          details, certificate uploads, review notes, Stripe Connect status, and
          payout-related identifiers.
        </p>
        <h3>3.4 Payment Information</h3>
        <p>
          Payments are processed by Stripe. 7eats does not store full card
          numbers or cook bank account details. We may store Stripe customer
          IDs, connected account IDs, payment intent IDs, charge IDs, transfer
          IDs, refund IDs, payout IDs, subscription IDs, payment status,
          amounts, currency, fees, deposits, and timestamps needed to run the
          marketplace.
        </p>
        <h3>3.5 Technical, Security, and Usage Information</h3>
        <p>
          We may collect IP addresses, hashed IP addresses, device and browser
          information, user agents, session data, cookies, logs, error reports,
          performance data, rate-limit records, security events, and metadata
          about how the platform is used.
        </p>
        <h3>3.6 Waitlist and Scheduling Information</h3>
        <p>
          If you join our waitlist, book a call, or contact us before launch, we
          may collect your email address, name, scheduling details, messages,
          and related communication records.
        </p>
      </>
    ),
  },
  {
    num: "04",
    title: "How We Use Information",
    content: (
      <>
        <p>We use personal information for the following purposes:</p>
        <ul className="policy-list">
          <li>create, authenticate, secure, and manage user accounts;</li>
          <li>
            process orders, subscriptions, payments, refunds, and payouts;
          </li>
          <li>
            support pickup, delivery, messaging, reviews, and notifications;
          </li>
          <li>
            review cook applications, certificates, listings, and compliance;
          </li>
          <li>
            personalize marketplace features such as saved listings, followed
            cooks, preferences, and account settings;
          </li>
          <li>send transactional emails, SMS messages, and service notices;</li>
          <li>
            send marketing messages only where we have consent or another lawful
            basis under CASL;
          </li>
          <li>
            respond to questions, disputes, refunds, and support requests;
          </li>
          <li>
            investigate food safety, allergen, fraud, payment, security, and
            policy concerns;
          </li>
          <li>debug, monitor, protect, and improve the platform;</li>
          <li>
            meet legal, tax, accounting, regulatory, and recordkeeping duties.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "05",
    title: "Consent and Choices",
    content: (
      <>
        <p>
          We generally collect and use personal information with your consent,
          when it is needed to provide the service you request, when it is
          reasonably required for safety or security, or when the law allows or
          requires us to do so.
        </p>
        <ul className="policy-list">
          <li>
            You can choose not to provide optional information, but some
            features may not work without required account, order, payment, or
            cook onboarding information.
          </li>
          <li>
            You can unsubscribe from marketing emails using the unsubscribe link
            in those emails.
          </li>
          <li>
            You can update some account and notification preferences from your
            account settings.
          </li>
          <li>
            You may withdraw consent where consent is the basis for processing,
            subject to legal, contractual, safety, and operational limits.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "06",
    title: "Cookies and Similar Technologies",
    content: (
      <>
        <p>
          7eats uses cookies, local storage, and similar technologies for
          essential platform functions such as authentication, session security,
          remembering cookie preferences, fraud prevention, rate limiting, and
          checkout functionality.
        </p>
        <p>
          We do not currently use Google Analytics, Meta Pixel, advertising
          pixels, or similar behavioural advertising trackers. If we add
          analytics or advertising tools that use cookies or similar
          identifiers, we will update this policy and our consent flow where
          required.
        </p>
        <p>
          Google Search Console may be used to understand search performance and
          verify site ownership. It does not add tracking scripts or cookies to
          our site for visitor behaviour tracking.
        </p>
      </>
    ),
  },
  {
    num: "07",
    title: "Third-Party Services",
    content: (
      <>
        <p>
          We use trusted service providers to operate 7eats. These providers may
          process personal information for us or receive information needed to
          provide their services. Some providers process information outside
          Canada.
        </p>
        <div className="policy-vendor">
          <div className="policy-vendor-header">
            <span className="policy-vendor-name">Vercel</span>
            <span className="policy-vendor-location">Hosting</span>
          </div>
          <p>
            Hosts the website and application. Server logs may include technical
            information such as IP addresses, user agents, request metadata, and
            security logs.
          </p>
        </div>
        <div className="policy-vendor">
          <div className="policy-vendor-header">
            <span className="policy-vendor-name">Neon</span>
            <span className="policy-vendor-location">Database</span>
          </div>
          <p>
            Provides database infrastructure used to store marketplace, account,
            order, cook, listing, preference, payment identifier, and support
            records.
          </p>
        </div>
        <div className="policy-vendor">
          <div className="policy-vendor-header">
            <span className="policy-vendor-name">Better Auth</span>
            <span className="policy-vendor-location">Authentication</span>
          </div>
          <p>
            Supports account creation, login, sessions, verification, password
            reset, and related authentication flows.
          </p>
        </div>
        <div className="policy-vendor">
          <div className="policy-vendor-header">
            <span className="policy-vendor-name">Stripe</span>
            <span className="policy-vendor-location">Payments</span>
          </div>
          <p>
            Processes card payments, subscriptions, refunds, disputes, connected
            cook accounts, identity and tax checks, bank payout details, and
            related payment records.
          </p>
        </div>
        <div className="policy-vendor">
          <div className="policy-vendor-header">
            <span className="policy-vendor-name">Twilio</span>
            <span className="policy-vendor-location">Phone Verification</span>
          </div>
          <p>
            Sends and verifies SMS one-time passcodes for phone verification and
            account security.
          </p>
        </div>
        <div className="policy-vendor">
          <div className="policy-vendor-header">
            <span className="policy-vendor-name">Resend</span>
            <span className="policy-vendor-location">Email</span>
          </div>
          <p>
            Sends transactional and service emails such as verification,
            account, order, support, and notification messages.
          </p>
        </div>
        <div className="policy-vendor">
          <div className="policy-vendor-header">
            <span className="policy-vendor-name">Sentry</span>
            <span className="policy-vendor-location">Monitoring</span>
          </div>
          <p>
            Helps us detect errors, performance issues, logs, and security
            problems. Depending on the error and context, Sentry may receive IP
            addresses, request metadata, user or account identifiers, URLs,
            browser details, logs, and other diagnostic information. We use this
            information to debug and protect the platform.
          </p>
        </div>
        <div className="policy-vendor">
          <div className="policy-vendor-header">
            <span className="policy-vendor-name">Cloudflare R2</span>
            <span className="policy-vendor-location">File Storage</span>
          </div>
          <p>
            Stores uploaded or generated files such as dish photos, profile
            images, certificate uploads, and other marketplace media.
          </p>
        </div>
        <div className="policy-vendor">
          <div className="policy-vendor-header">
            <span className="policy-vendor-name">Mapbox</span>
            <span className="policy-vendor-location">
              Address and Distance Tools
            </span>
          </div>
          <p>
            Supports address search, place IDs, maps, location lookup, distance
            estimates, and delivery-related calculations.
          </p>
        </div>
        <div className="policy-vendor">
          <div className="policy-vendor-header">
            <span className="policy-vendor-name">Calendly</span>
            <span className="policy-vendor-location">Scheduling</span>
          </div>
          <p>
            Processes scheduling data such as name, email address, call time,
            and messages when you book a call with the 7eats team.
          </p>
        </div>
      </>
    ),
  },
  {
    num: "08",
    title: "How We Share Information",
    content: (
      <>
        <p>We may share personal information in the following ways:</p>
        <ul className="policy-list">
          <li>
            with cooks and customers as needed to complete orders, resolve
            issues, support pickup or delivery, and show marketplace activity;
          </li>
          <li>
            with service providers that process information for hosting,
            payments, authentication, messaging, monitoring, storage, mapping,
            support, and communications;
          </li>
          <li>
            with payment providers, banks, card networks, and dispute processors
            to handle payments, refunds, fraud, chargebacks, and payouts;
          </li>
          <li>
            with public health units, regulators, law enforcement, insurers, or
            advisors when needed for safety, legal, fraud, or compliance
            reasons;
          </li>
          <li>
            in connection with a business transaction such as financing, merger,
            acquisition, reorganization, or sale of assets;
          </li>
          <li>with your consent or at your direction.</li>
        </ul>
        <p>
          We do not sell personal information in the ordinary sense of selling
          customer lists to data brokers.
        </p>
      </>
    ),
  },
  {
    num: "09",
    title: "Cross-Border Processing",
    content: (
      <>
        <p>
          Some of our service providers are located in or process information in
          the United States and other jurisdictions. Personal information
          processed outside Canada may be accessible to courts, law enforcement,
          national security authorities, or regulators in those jurisdictions
          according to local law.
        </p>
        <p>
          We remain responsible for personal information under our control and
          use contractual, technical, and organizational measures intended to
          provide a comparable level of protection when information is processed
          by service providers.
        </p>
      </>
    ),
  },
  {
    num: "10",
    title: "Retention",
    content: (
      <>
        <p>
          We keep personal information only as long as reasonably needed for the
          purposes described in this policy, unless a longer period is required
          or allowed by law.
        </p>
        <ul className="policy-list">
          <li>
            Account records are kept while your account is active and for a
            reasonable period after closure for security, tax, legal, dispute,
            and recordkeeping reasons.
          </li>
          <li>
            Order, payment, payout, refund, subscription, and tax-related
            records may be retained for legal, accounting, chargeback, audit,
            and business purposes.
          </li>
          <li>
            Cook application, certificate, review, and compliance records may be
            kept while the cook uses 7eats and for a reasonable period after.
          </li>
          <li>
            Safety, allergen, fraud, dispute, and support records may be kept as
            needed to protect users and the platform.
          </li>
          <li>
            Waitlist records are retained until the launch purpose has been
            fulfilled or until you unsubscribe, unless you opt in to continued
            communications.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "11",
    title: "Security",
    content: (
      <>
        <p>
          We use reasonable technical and organizational measures to protect
          personal information against unauthorized access, loss, misuse,
          alteration, or disclosure. No online system is perfectly secure, so we
          cannot guarantee absolute security.
        </p>
        <p>
          If we experience a breach of security safeguards involving personal
          information under our control, we will assess whether it creates a
          real risk of significant harm. Where required by PIPEDA, we will
          notify affected individuals, report to the Office of the Privacy
          Commissioner of Canada, and keep required breach records.
        </p>
      </>
    ),
  },
  {
    num: "12",
    title: "Your Rights",
    content: (
      <>
        <p>
          Subject to legal and operational limits, you may request access to,
          correction of, or deletion of personal information we hold about you.
          You may also ask questions or make a complaint about how we handle
          your information.
        </p>
        <ul className="policy-list">
          <li>
            Right of access - request a copy of your personal information.
          </li>
          <li>
            Right to correction - ask us to correct inaccurate or incomplete
            information.
          </li>
          <li>
            Right to deletion - ask us to delete information where deletion is
            legally and operationally possible.
          </li>
          <li>
            Right to withdraw consent - withdraw consent where consent is the
            basis for processing.
          </li>
        </ul>
        <p>
          To make a request, email{" "}
          <a href="mailto:team@7eats.ca">team@7eats.ca</a>. We may need to
          verify your identity before responding. We aim to respond within 30
          days unless more time is reasonably required.
        </p>
      </>
    ),
  },
  {
    num: "13",
    title: "Children and Minors",
    content: (
      <>
        <p>
          7eats is not directed to children under 16. We do not knowingly
          collect personal information from children under 16. If you believe a
          child has provided personal information to us, contact us and we will
          take appropriate steps.
        </p>
        <p>
          Some platform features may require users to meet minimum age or legal
          capacity requirements. Cooks must be legally able to operate their
          food business.
        </p>
      </>
    ),
  },
  {
    num: "14",
    title: "Changes to This Policy",
    content: (
      <>
        <p>
          We may update this Privacy Policy as 7eats changes. When we do, we
          will update the &quot;Last updated&quot; date on this page. If changes
          are material, we may provide additional notice through the platform,
          email, or another appropriate method.
        </p>
      </>
    ),
  },
];

export default async function PrivacyPage() {
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
            <span className="eyebrow">Legal</span>
            <h1 className="policy-title">Privacy Policy</h1>
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
