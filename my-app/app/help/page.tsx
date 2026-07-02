import { Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Footer from "@/app/components/Footer";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Help - 7eats",
  description:
    "Answers to common questions about ordering and cooking with 7eats, plus how to reach our team by email or phone.",
  alternates: { canonical: "/help" },
};

const EMAIL = "team@7eats.ca";
const PHONE_DISPLAY = "(514) 913-0305";
const PHONE_HREF = "tel:+15149130305";

type Faq = { q: string; a: string };

const CUSTOMER_FAQS: Faq[] = [
  {
    q: "How do I place an order?",
    a: "Set your address, browse the cooks serving your area, add the dishes you want, and pick a pickup or delivery window at checkout. You will get a confirmation email with everything you need.",
  },
  {
    q: "How do pickup and delivery work?",
    a: "You choose a time window when you order. For pickup, you collect your food from the cook during that window. For delivery, your cook brings it to the address you entered. We send updates as your order is accepted, prepared, and ready.",
  },
  {
    q: "Can I order without an account?",
    a: "Yes. You can check out as a guest with just your name, email, and phone number. We email your receipt and order updates so you can follow along.",
  },
  {
    q: "Something is wrong with my order. What do I do?",
    a: "Reach out right away by email or phone and we will make it right. The faster you tell us, the more we can do. Our full refund and cancellation terms are linked in the footer below.",
  },
  {
    q: "Is my payment secure?",
    a: "Payments are handled by Stripe, the same processor used by many of the businesses you already buy from. We never see or store your card details.",
  },
];

const COOK_FAQS: Faq[] = [
  {
    q: "Who can cook on 7eats?",
    a: "Meal prep businesses and home cooks with a valid food handler certification and a permitted kitchen. If you have your cert and a space to cook, you are who we are looking for.",
  },
  {
    q: "What does it cost to sell?",
    a: "We charge a 7.5% platform fee per order to cover payment processing and operations. The first 30 cooks to join keep everything they make for 90 days.",
  },
  {
    q: "When do I get paid?",
    a: "Payouts land in your bank account every week through Stripe. You will need a Canadian bank account to receive them.",
  },
  {
    q: "How do I join?",
    a: "Apply from our home page. We review every application personally and reach out within two business days. No automated call, a real conversation.",
  },
];

function FaqList({ items }: { items: Faq[] }) {
  return (
    <div className={styles.faqList}>
      {items.map((item) => (
        <details key={item.q} className={styles.faqItem}>
          <summary className={styles.faqQuestion}>
            <span>{item.q}</span>
            <span className={styles.faqMarker} aria-hidden="true" />
          </summary>
          <p className={styles.faqAnswer}>{item.a}</p>
        </details>
      ))}
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Help center</p>
          <h1 className={styles.title}>How can we help?</h1>
          <p className={styles.lede}>
            Most answers are below. If you would rather talk to a person, we are
            one email or call away.
          </p>
        </header>

        <section className={styles.contact} aria-label="Ways to reach us">
          <a className={styles.cardPrimary} href={`mailto:${EMAIL}`}>
            <span className={styles.cardIcon}>
              <Mail size={20} strokeWidth={2.25} />
            </span>
            <span className={styles.cardLabel}>Email us</span>
            <span className={styles.cardValue}>{EMAIL}</span>
            <span className={styles.cardNote}>
              For anything at all. We usually reply within one business day.
            </span>
          </a>

          <a className={styles.cardSecondary} href={PHONE_HREF}>
            <span className={styles.cardIcon}>
              <Phone size={20} strokeWidth={2.25} />
            </span>
            <span className={styles.cardLabel}>Call or text</span>
            <span className={styles.cardValue}>{PHONE_DISPLAY}</span>
            <span className={styles.cardNote}>
              The fastest way to reach us when something cannot wait.
            </span>
          </a>
        </section>

        <section className={styles.faqSection}>
          <h2 className={styles.sectionTitle}>Ordering and customers</h2>
          <FaqList items={CUSTOMER_FAQS} />
        </section>

        <section className={styles.faqSection}>
          <h2 className={styles.sectionTitle}>Cooking with 7eats</h2>
          <FaqList items={COOK_FAQS} />
        </section>

        <section className={styles.closing}>
          <h2 className={styles.closingTitle}>Still stuck?</h2>
          <p className={styles.closingText}>
            Tell us what is going on and we will help you sort it out.
          </p>
          <div className={styles.closingActions}>
            <a className={styles.closingPrimary} href={`mailto:${EMAIL}`}>
              {EMAIL}
            </a>
            <a className={styles.closingSecondary} href={PHONE_HREF}>
              {PHONE_DISPLAY}
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
