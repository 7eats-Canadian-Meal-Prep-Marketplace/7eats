import Footer from "@/app/components/Footer";
import Header from "@/app/components/Header";

export const metadata = {
  title: "Privacy Policy — 7eats",
  description:
    "How 7eats collects, uses, and protects your personal information.",
};

const SECTIONS = [
  {
    num: "01",
    title: "Introduction",
    content: (
      <>
        <p>
          7eats Inc. ("7eats", "we", "our", "us") operates the website{" "}
          <strong>7eats.ca</strong> (the "Site"). We are committed to protecting
          the personal information of our users in accordance with the{" "}
          <em>Personal Information Protection and Electronic Documents Act</em>{" "}
          (PIPEDA) and Canada's Anti-Spam Legislation (CASL).
        </p>
        <p>
          This Privacy Policy describes what information we collect, how we use
          it, and what rights you have. By using the Site, you agree to the
          practices described here.
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
          For any questions, requests, or complaints regarding your personal
          information, contact us directly.
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
            <a href="mailto:contact@7eats.ca">contact@7eats.ca</a>
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
          We collect only the personal information necessary for the purposes
          described in this policy.
        </p>
        <h3>3.1 Email Address</h3>
        <p>
          When you join our waitlist, we collect your email address. This is the
          only personal information stored on our servers.
        </p>
        <h3>3.2 Booking Data</h3>
        <p>
          If you book a call through our Calendly link, Calendly may collect
          your name, email address, and calendar availability. This data is
          processed directly by Calendly and subject to their privacy policy. We
          receive a copy of your name and email for the purpose of the scheduled
          call only.
        </p>
        <h3>3.3 Cookies and Usage Data</h3>
        <p>
          We do not currently use analytics or tracking cookies. The Site may
          use essential session cookies necessary for basic functionality. We
          will update this policy before deploying any analytics tools.
        </p>
      </>
    ),
  },
  {
    num: "04",
    title: "Purposes of Collection",
    content: (
      <>
        <p>
          Personal information we collect is used only for the following
          purposes, communicated to you at or before the time of collection:
        </p>
        <ul className="policy-list">
          <li>
            <strong>Email address</strong> — to notify you when 7eats launches
            and to send updates about the platform. We will not send unsolicited
            commercial messages without your express or implied consent, in
            accordance with CASL.
          </li>
          <li>
            <strong>Booking data</strong> — to facilitate a scheduled call
            between you and a 7eats founder.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "05",
    title: "Legal Basis for Processing",
    content: (
      <>
        <p>We process your personal information based on your consent:</p>
        <ul className="policy-list">
          <li>
            You provide your email address voluntarily by submitting the
            waitlist form, where the purpose of collection is clearly disclosed.
          </li>
          <li>
            You initiate a booking through Calendly voluntarily and are subject
            to Calendly's own consent flows.
          </li>
        </ul>
        <p>You may withdraw your consent at any time (see Section 8).</p>
      </>
    ),
  },
  {
    num: "06",
    title: "Third-Party Services",
    content: (
      <>
        <p>
          We use the following third-party providers. Personal information may
          be transferred to and processed in jurisdictions outside of Canada by
          these services.
        </p>
        <div className="policy-vendor">
          <div className="policy-vendor-header">
            <span className="policy-vendor-name">Vercel Inc.</span>
            <span className="policy-vendor-location">United States</span>
          </div>
          <p>
            Vercel hosts the Site. Server logs may include technical connection
            data such as IP addresses. Vercel complies with applicable data
            protection standards.
          </p>
        </div>
        <div className="policy-vendor">
          <div className="policy-vendor-header">
            <span className="policy-vendor-name">Neon Inc.</span>
            <span className="policy-vendor-location">United States</span>
          </div>
          <p>
            Neon provides the database where waitlist email addresses are stored
            securely.
          </p>
        </div>
        <div className="policy-vendor">
          <div className="policy-vendor-header">
            <span className="policy-vendor-name">Calendly LLC</span>
            <span className="policy-vendor-location">United States</span>
          </div>
          <p>
            Calendly processes scheduling data including your name and email
            when you book a call with a founder. Their use of your data is
            governed by{" "}
            <a
              href="https://calendly.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Calendly's Privacy Policy
            </a>
            .
          </p>
        </div>
        <p>
          We have taken reasonable steps to ensure each provider maintains
          adequate data protection practices consistent with applicable law.
        </p>
      </>
    ),
  },
  {
    num: "07",
    title: "Data Retention",
    content: (
      <>
        <ul className="policy-list">
          <li>
            <strong>Waitlist email addresses</strong> are retained until the
            purpose for which they were collected has been fulfilled, or until
            you unsubscribe, whichever comes first. Following the public launch
            of 7eats, waitlist emails will be deleted within 90 days unless you
            have explicitly opted in to continued communications.
          </li>
          <li>
            <strong>Booking data</strong> is retained only for the duration
            necessary to facilitate your scheduled call and any agreed
            follow-up.
          </li>
        </ul>
      </>
    ),
  },
  {
    num: "08",
    title: "Your Rights",
    content: (
      <>
        <p>
          Under PIPEDA, you have the right to access, correct, and request
          deletion of your personal information. Specifically:
        </p>
        <ul className="policy-list">
          <li>
            <strong>Right of access</strong> — request a copy of the personal
            information we hold about you.
          </li>
          <li>
            <strong>Right to rectification</strong> — request that inaccurate
            information be corrected.
          </li>
          <li>
            <strong>Right to deletion</strong> — request that your personal
            information be deleted.
          </li>
          <li>
            <strong>Right to withdraw consent</strong> — withdraw consent at any
            time without affecting the lawfulness of prior processing.
          </li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{" "}
          <a href="mailto:contact@7eats.ca">contact@7eats.ca</a>. We will
          respond within 30 days.
        </p>
        <p>
          To unsubscribe from our waitlist, click the unsubscribe link in any
          email we send you.
        </p>
      </>
    ),
  },
  {
    num: "09",
    title: "Security",
    content: (
      <>
        <p>
          We implement appropriate technical and organizational measures to
          protect personal information against unauthorized access, loss, or
          disclosure. In the event of a data breach that poses a real risk of
          significant harm, we will notify affected individuals and the Office
          of the Privacy Commissioner of Canada (OPC) as required under PIPEDA.
        </p>
      </>
    ),
  },
  {
    num: "10",
    title: "Children's Privacy",
    content: (
      <>
        <p>
          The Site is not directed at anyone under the age of 13. We do not
          knowingly collect personal information from children. If you believe a
          minor has submitted information to us, contact us at{" "}
          <a href="mailto:contact@7eats.ca">contact@7eats.ca</a> and we will
          delete it promptly.
        </p>
      </>
    ),
  },
  {
    num: "11",
    title: "Changes to This Policy",
    content: (
      <>
        <p>
          We may update this Privacy Policy from time to time. When we do, we
          will update the "Last updated" date at the top of this page. We
          encourage you to review this policy periodically. Continued use of the
          Site after changes are posted constitutes acceptance of the revised
          policy.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="policy-page">
        <div className="wrap">
          <div className="policy-hero">
            <span className="eyebrow">Legal</span>
            <h1 className="policy-title">Privacy Policy</h1>
            <p className="policy-meta">Last updated: May 17, 2026</p>
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
