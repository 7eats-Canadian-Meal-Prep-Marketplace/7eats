// TODO (next session): Gate this page with a server action + short-lived HttpOnly cookie.
// Implementation (option 2):
//   1. Replace handleSubmit in application/page.tsx with a real server action that inserts
//      the form data into the DB, then sets:
//        Set-Cookie: application_submitted=1; HttpOnly; Path=/; Max-Age=300; SameSite=Strict
//      and calls redirect("/business/application-confirmation").
//   2. In this file, import { cookies } from "next/headers" and { redirect } from "next/navigation".
//      Read the cookie, clear it immediately (Max-Age=0), and redirect to
//      /business/application if absent.

import styles from "./page.module.css";

export const metadata = {
  title: "Application submitted — 7eats",
  description:
    "Your kitchen application has been received. Our team will be in touch within 48 hours.",
  robots: { index: false, follow: true },
};

const STEPS = [
  {
    num: "01",
    title: "We review your information",
    desc: "We go through your submission to confirm the basics and make sure everything checks out.",
  },
  {
    num: "02",
    title: "A representative reaches out",
    desc: "A member of our team will get in touch directly within 2 business days by phone. Not automated. A real conversation.",
  },
  {
    num: "03",
    title: "You receive a setup link",
    desc: "We send you a link to complete your kitchen profile. Once that is done, your menu goes live on 7eats.",
  },
];

export default function ApplicationConfirmationPage() {
  return (
    <main>
      <section className={styles.section}>
        <div className={`wrap ${styles.inner}`}>
          <div className={styles.headlineBlock}>
            <h1 className={styles.headline}>Thank you for applying.</h1>
            <p className={styles.sub}>
              We review every application personally. A member of our team will
              reach out within <strong>2 business days</strong> by phone. Not an
              automated message.
            </p>
          </div>

          <div className={styles.divider} />

          <div className={styles.steps}>
            {STEPS.map((s) => (
              <div key={s.num} className={styles.step}>
                <span className={styles.stepNum}>{s.num}</span>
                <div className={styles.stepText}>
                  <h3 className={styles.stepTitle}>{s.title}</h3>
                  <p className={styles.stepDesc}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className={styles.sig}>The 7eats team, Toronto</p>
        </div>
      </section>
    </main>
  );
}
