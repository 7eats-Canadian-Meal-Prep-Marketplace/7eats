import Image from "next/image";
import Link from "next/link";
import BannerFlash from "@/app/components/BannerFlash";
import CalendlyButton from "@/app/components/CalendlyButton";
import CtaSection from "@/app/components/CtaSection";
import FaqAccordion from "@/app/components/FaqAccordion";
import Footer from "@/app/components/Footer";
import Header from "@/app/components/Header";

export const metadata = {
  title: "7eats - The Canadian Meal Prep Marketplace",
  description:
    "7eats is the home for Toronto's independent cooks. List your menu, set your prices, keep the majority of what you make. No restaurant. No middlemen.",
};

export default function WaitlistPage() {
  return (
    <>
      <BannerFlash />
      <Header activePage="home" />

      {/* HERO */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">
                Canada&apos;s meal prep marketplace
              </span>
              <h1>
                Your kitchen is already a business.
                <br />
                <span className="hero-accent">We built the platform for it.</span>
              </h1>
              <p className="hero-sub">
                7eats is a marketplace for meal prep cooks. List your weekly
                menu, set your prices, and get discovered by customers actively
                looking for what you cook. Orders and payments are handled for you.
              </p>
              <div className="hero-ctas">
                <CalendlyButton className="btn btn-secondary">
                  Book a meeting with us
                </CalendlyButton>
                <Link href="#cta" className="btn btn-ghost">
                  Join the waitlist
                </Link>
              </div>
            </div>
            <div className="hero-visual">
              <Image
                src="/woman-cooking.jpg"
                alt="A Toronto independent cook in her kitchen"
                fill
                style={{ objectFit: "cover", objectPosition: "center" }}
                priority
                sizes="(max-width: 900px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="section problem">
        <div className="wrap">
          <div className="problem-intro">
            <div>
              <span className="eyebrow on-dark">The problem</span>
              <h2 className="h-xl" style={{ marginTop: 18 }}>
                Meal prep cooks are everywhere. The infrastructure never caught up.
              </h2>
            </div>
            <p className="lead on-dark">
              Thousands of cooks across Canada already sell meal preps weekly.
              7eats exists so people can discover new cuisines, rotate their
              meals, and eat well without paying fast food prices every day.
              Cooks get the infrastructure to grow beyond their circle.
            </p>
          </div>
          <div className="problem-list">
            <div className="problem-item">
              <div className="problem-num">01</div>
              <h3>Commercial meal prep is boring.</h3>
              <p>
                Same five options, every week. Brands optimise for{" "}
                <strong>shelf life</strong>, not <strong>variety</strong>.
              </p>
            </div>
            <div className="problem-item">
              <div className="problem-num">02</div>
              <h3>Dietary discovery is broken.</h3>
              <p>
                <strong>Halal, vegan, culturally specific</strong> food exists
                everywhere. It just has no place to live online.
              </p>
            </div>
            <div className="problem-item">
              <div className="problem-num">03</div>
              <h3>No trust layer between cooks and buyers.</h3>
              <p>
                Buying food from a stranger feels risky. It shouldn&apos;t.{" "}
                <strong>Verified profiles, deposits, allergen fields, and confirmed-order reviews</strong>{" "}
                fix that.
              </p>
            </div>
            <div className="problem-item">
              <div className="problem-num">04</div>
              <h3>The tools exist. They just don&apos;t work together.</h3>
              <p>
                Facebook for orders. E-transfer for payment.{" "}
                <strong>One platform that ties it all together changes everything.</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section features">
        <div className="wrap">
          <div className="features-head">
            <div>
              <span className="eyebrow">What you get</span>
              <h2 className="h-xl" style={{ marginTop: 18 }}>
                New customers finding you. Every day. Without lifting a finger.
              </h2>
            </div>
            <p className="lead">
              The marketplace finds them. You feed them. We handle everything in
              between.
            </p>
          </div>
          <div className="features-grid">
            <article className="feature">
              <div className="feature-visual">
                <Image
                  src="/cook-with-phone.jpg"
                  alt="Cook reviewing their order dashboard"
                  fill
                  style={{ objectFit: "cover", objectPosition: "center" }}
                  sizes="(max-width: 700px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              </div>
              <h3>Dashboard and management tools.</h3>
              <p>
                Your orders, schedule, and revenue in one place. Know exactly
                what to cook, when, and for who - before you touch a pan.
              </p>
            </article>
            <article className="feature">
              <div className="feature-visual">
                <Image
                  src="/money-handle.jpg"
                  alt="Secure deposit and payment handling"
                  fill
                  style={{ objectFit: "cover", objectPosition: "center" }}
                  sizes="(max-width: 700px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              </div>
              <h3>Deposit and payment security.</h3>
              <p>
                Customers pay upfront. You cook knowing every order is
                confirmed. No-shows, e-transfer chasing, and cash awkwardness
                are gone.
              </p>
            </article>
            <article className="feature">
              <div className="feature-visual">
                <Image
                  src="/meal-preps.jpg"
                  alt="Customisable meal prep listings with dietary info"
                  fill
                  style={{ objectFit: "cover", objectPosition: "center" }}
                  sizes="(max-width: 700px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              </div>
              <h3>Customisable listings.</h3>
              <p>
                Add calories, macros, allergens, and dietary tags to every
                dish. Buyers searching for halal, vegan, or high-protein find
                you directly.
              </p>
            </article>
            <article className="feature">
              <div className="feature-visual">
                <Image
                  src="/cook-talking-customer.png"
                  alt="Cook talking with a customer"
                  fill
                  style={{ objectFit: "cover", objectPosition: "center" }}
                  sizes="(max-width: 700px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              </div>
              <h3>Dynamic pricing and flash deals.</h3>
              <p>
                Raise prices when demand is high. Run a last-minute deal to
                clear extra portions. Your pricing, your call - always.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section how" id="how">
        <div className="wrap">
          <div className="how-head how-head-centered">
            <span className="eyebrow">How it works</span>
            <h2 className="h-xl" style={{ marginTop: 18 }}>
              From your kitchen to a real business in three steps.
            </h2>
          </div>
          <div className="how-steps">
            <div className="how-step">
              <div className="how-step-num">01</div>
              <h3>Onboard and list your meals.</h3>
              <p>
                Set up your cook profile, add your weekly meal prep menu, set
                portions, prices, and pickup windows. Takes minutes.
              </p>
            </div>
            <div className="how-step">
              <div className="how-step-num">02</div>
              <h3>Receive orders and coordinate.</h3>
              <p>
                Customers find you, place orders, and pay upfront. Manage
                pickup windows or delivery slots from your dashboard. No
                back-and-forth needed.
              </p>
            </div>
            <div className="how-step">
              <div className="how-step-num">03</div>
              <h3>Cook, hand off, earn.</h3>
              <p>
                Prep what you know is sold. Pickups are staggered in timed
                windows. Payouts hit your account automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="section stats">
        <div className="wrap">
          <span className="eyebrow on-dark">Why this matters</span>
          <div className="stats-row">
            <div className="stat">
              <div className="stat-num">200<small>+</small></div>
              <p className="stat-label">
                Distinct ethnic origins in Toronto alone - creating unmatched
                demand for authentic, home-style cultural food.
              </p>
            </div>
            <div className="stat">
              <div className="stat-num">87<small>%</small></div>
              <p className="stat-label">
                Of Canadians say rising food prices are making it harder to eat
                healthy. Affordable home-cooked meals are the answer.
              </p>
            </div>
            <div className="stat">
              <div className="stat-num">$28</div>
              <p className="stat-label">
                What a $16 pizza costs on Uber Eats after fees and tip. Customers
                are ready for a better option.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* OFFER */}
      <section className="section offer" id="offer">
        <div className="wrap">
          <div className="offer-grid">
            <div>
              <span className="offer-tag">First 50 cooks &middot; Toronto</span>
              <h2>0% platform fee for your first 90 days.</h2>
              <p className="offer-lede">
                Found us early? You get the founding cook deal. Every order in
                your first 90 days is yours. Every dollar. While you build
                your customer base on 7eats.
              </p>
              <div className="offer-perks">
                <div className="offer-perk">
                  <div className="offer-perk-label">0% platform fee</div>
                  <div className="offer-perk-meta">First 90 days</div>
                </div>
                <div className="offer-perk">
                  <div className="offer-perk-label">Priority listings</div>
                  <div className="offer-perk-meta">Top of your neighbourhood</div>
                </div>
                <div className="offer-perk">
                  <div className="offer-perk-label">Lifetime discount on premium tools</div>
                  <div className="offer-perk-meta">Locked in forever</div>
                </div>
                <div className="offer-perk">
                  <div className="offer-perk-label">
                    Early access
                  </div>
                  <div className="offer-perk-meta">
                    First to every new feature
                  </div>
                </div>
              </div>
              <div className="offer-cta">
                <Link href="#cta" className="btn btn-primary">
                  Claim my founding spot
                </Link>
                <CalendlyButton className="btn btn-ghost on-dark">
                  Ask us anything &middot; 30 min
                </CalendlyButton>
              </div>
            </div>
            <div className="offer-visual">
              <Image
                src="/plated-dish.jpg"
                alt="A plated home-cooked dish"
                fill
                style={{ objectFit: "cover", objectPosition: "center" }}
                sizes="(max-width: 900px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section faq" id="faq">
        <div className="wrap">
          <div className="faq-grid">
            <div className="faq-side">
              <span className="eyebrow">Questions?</span>
              <h2 className="h-xl">We&apos;ve got answers.</h2>
              <p>Still curious? Book 30 minutes with one of the founders.</p>
              <CalendlyButton className="btn btn-secondary">
                Book a call
              </CalendlyButton>
            </div>
            <FaqAccordion />
          </div>
        </div>
      </section>

      <CtaSection />
      <Footer />
    </>
  );
}
