import Image from "next/image";
import Link from "next/link";
import CalendlyButton from "@/app/components/CalendlyButton";
import CtaSection from "@/app/components/CtaSection";
import FadeInGroup from "@/app/components/FadeInGroup";
import FaqAccordion from "@/app/components/FaqAccordion";
import HowItWorksSection from "@/app/components/HowItWorksSection";
import StatsSection from "@/app/components/StatsSection";

export const metadata = {
  title: "7eats - The Canadian Meal Prep Marketplace",
  description:
    "7eats is the marketplace for Toronto's meal prep businesses. List your menu, reach new customers, and get paid without the admin overhead.",
};

export default function WaitlistPage() {
  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">
                Canada&apos;s meal prep marketplace
              </span>
              <h1>
                Your meal prep business is ready to scale.{" "}
                <span className="hero-accent">
                  We&apos;re building&nbsp;the platform for it.
                </span>
              </h1>
              <p className="hero-sub">
                7eats is a marketplace for meal prep businesses. List your menu,
                set your prices, and get discovered by customers actively
                looking for what you sell. Orders and payments handled for you.
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
                alt="A Toronto meal prep business owner in her kitchen"
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
            <span className="eyebrow on-dark">The problem</span>
            <h2 className="h-xl">
              Meal prep cooks are everywhere. Nothing connects them.
            </h2>
            <p className="lead on-dark">
              The cooks are already there. They just needed a platform to reach
              beyond their circle.
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
              <h3>No trust layer between operators and buyers.</h3>
              <p>
                Customers want verified businesses, allergen info, and secure
                payments before committing.{" "}
                <strong>
                  Verified profiles, deposits, allergen fields, and
                  confirmed-order reviews
                </strong>{" "}
                give them that.
              </p>
            </div>
            <div className="problem-item">
              <div className="problem-num">04</div>
              <h3>The tools exist. They just don&apos;t work together.</h3>
              <p>
                Facebook for orders. E-transfer for payment.{" "}
                <strong>
                  One platform that ties it all together changes everything.
                </strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section features">
        <div className="wrap">
          <div className="features-head">
            <span className="eyebrow">What you get</span>
            <h2 className="h-xl">
              New customers finding you. Every day. Without lifting a finger.
            </h2>
            <p className="lead">
              The marketplace finds them. You feed them. We handle everything in
              between.
            </p>
          </div>
          <FadeInGroup className="features-grid" staggerMs={100}>
            {[
              <article key="1" className="feature">
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
                  what to cook, when, and for who before you touch a pan.
                </p>
              </article>,
              <article key="2" className="feature">
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
              </article>,
              <article key="3" className="feature">
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
              </article>,
              <article key="4" className="feature">
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
                  clear extra portions. Your pricing, your call, always.
                </p>
              </article>,
            ]}
          </FadeInGroup>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <HowItWorksSection />

      {/* STATS */}
      <StatsSection />

      {/* OFFER */}
      <section className="section offer" id="offer">
        <div className="wrap">
          <div className="offer-grid">
            <div>
              <span className="offer-tag">First 30 cooks &middot; Toronto</span>
              <h2>0% platform fee for your first 90 days.</h2>
              <p className="offer-lede">
                Found us early? You get the founding cook deal. Every order in
                your first 90 days is yours. Every dollar. While you scale your
                customer base on 7eats.
              </p>
              <FadeInGroup className="offer-perks" staggerMs={120}>
                {[
                  <div key="1" className="offer-perk">
                    <div className="offer-perk-label">0% platform fee</div>
                    <div className="offer-perk-meta">First 90 days</div>
                  </div>,
                  <div key="2" className="offer-perk">
                    <div className="offer-perk-label">Priority listings</div>
                    <div className="offer-perk-meta">
                      Top of your neighbourhood
                    </div>
                  </div>,
                  <div key="3" className="offer-perk">
                    <div className="offer-perk-label">
                      Lifetime discount on premium tools
                    </div>
                    <div className="offer-perk-meta">Locked in forever</div>
                  </div>,
                  <div key="4" className="offer-perk">
                    <div className="offer-perk-label">Early access</div>
                    <div className="offer-perk-meta">
                      First to every new feature
                    </div>
                  </div>,
                ]}
              </FadeInGroup>
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
            <div className="faq-side-top">
              <span className="eyebrow">Questions?</span>
              <h2 className="faq-side h-xl">We&apos;ve got answers.</h2>
            </div>
            <FaqAccordion />
            <div className="faq-side-bottom">
              <p>Still curious? Book 30 minutes with one of the founders.</p>
              <CalendlyButton className="btn btn-secondary">
                Book a call
              </CalendlyButton>
            </div>
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
