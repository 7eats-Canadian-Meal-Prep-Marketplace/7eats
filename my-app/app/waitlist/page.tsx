import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  DollarSign,
  LayoutList,
  PhoneCall,
  Tag,
  TrendingUp,
  Users,
} from "lucide-react";
import BannerFlash from "@/app/components/BannerFlash";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import s from "./page.module.css";

export const metadata = {
  title: "7eats - Cook for Toronto",
  description:
    "Join 7eats as a founding cook. Turn your home kitchen into a real business. First 40 cooks get lifetime reduced commission.",
};

const features = [
  {
    icon: <LayoutList size={22} />,
    title: "Order & pickup coordination",
    description:
      "Manage every order from one dashboard. Customers confirm pickups, you cook knowing exactly what's needed.",
    hasImage: true,
  },
  {
    icon: <DollarSign size={22} />,
    title: "Deposit security & payment processing",
    description:
      "Get paid upfront. No more chasing e-transfers. Deposits are collected before you cook a single container.",
    hasImage: false,
  },
  {
    icon: <LayoutList size={22} />,
    title: "Customizable listing",
    description:
      "Set your own menu weekly. Include calories, macros, and dietary tags so customers find exactly what you make.",
    hasImage: false,
  },
  {
    icon: <Tag size={22} />,
    title: "Dynamic pricing & timely deals",
    description:
      "Run flash sales on last-minute slots or raise prices when demand is high. Your kitchen, your rules.",
    hasImage: false,
  },
];

const steps = [
  {
    number: "01",
    title: "Onboard and set up your profile",
    description:
      "Create your cook profile, tell customers about your cuisine and kitchen, and upload your story.",
    hasImage: false,
  },
  {
    number: "02",
    title: "List your weekly menu and set your price",
    description:
      "Choose what you're making this week, set your portion price, and publish your availability.",
    hasImage: false,
  },
  {
    number: "03",
    title: "Coordinate pickups through the platform",
    description:
      "Customers pick their slot, you get the full list. No back-and-forth DMs, no missed messages.",
    hasImage: true,
  },
  {
    number: "04",
    title: "Earn and grow your subscriber base",
    description:
      "Build a loyal following in your neighborhood. Returning customers become weekly subscribers.",
    hasImage: false,
  },
];

const stats = [
  { number: "2.9M", label: "Toronto households within 30km" },
  { number: "230+", label: "languages spoken in the city" },
  { number: "$18", label: "average spend per Uber Eats order" },
  { number: "$11B", label: "Canadian meal prep market by 2028" },
];

const offerBenefits = [
  {
    title: "Founding cook badge",
    sub: "Displayed permanently on your profile - visible to every customer.",
  },
  {
    title: "Lifetime reduced commission",
    sub: "Lock in a lower rate forever. Non-founding cooks pay more.",
  },
  {
    title: "Priority neighborhood placement",
    sub: "Your listing appears first in your area, always.",
  },
  {
    title: "Early access to all new features",
    sub: "Shape the product. Founding cooks get first access before public rollout.",
  },
  {
    title: "Direct line to the founders",
    sub: "A private channel for feedback, questions, and support.",
  },
];

const faqs = [
  {
    q: "Is it free to join the waitlist?",
    a: "Yes. Signing up costs nothing. We will reach out before the platform launches to complete your onboarding.",
  },
  {
    q: "What cuisine types are accepted?",
    a: "All of them. 7eats is built on Toronto's diversity. Ghanaian, Filipino, Lebanese, Jamaican, Korean - if you cook it well, there is a customer for it.",
  },
  {
    q: "Do I need a commercial kitchen?",
    a: "Not to join the waitlist. We are working with city regulations and will communicate requirements clearly before launch.",
  },
  {
    q: "How does payment work?",
    a: "Customers pay a deposit upfront when they order. Funds are released to you after successful pickup. No chasing, no risk.",
  },
  {
    q: "When does the platform launch?",
    a: "We are targeting a Toronto pilot with founding cooks first. Waitlist members will be notified several weeks before the public launch.",
  },
  {
    q: "What cities are supported at launch?",
    a: "Toronto only for the initial pilot. We are building this right before expanding.",
  },
];

export default function WaitlistPage() {
  return (
    <>
      <BannerFlash />
      <Header />

      <main>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className={s.hero} aria-label="Hero">
          <div className={s.heroContent}>
            <p className={s.heroEyebrow}>Now recruiting founding cooks</p>
            <h1 className={s.heroHeadline}>
              Your cooking deserves more than Instagram DMs.
            </h1>
            <p className={s.heroSubheadline}>
              You are already running a meal prep business - managing orders
              through messages, chasing e-transfers, invisible to anyone outside
              your network. 7eats gives you the infrastructure to turn that into
              something real.
            </p>
            <div className={s.heroActions}>
              {/* Waitlist CTA - scrolls to form */}
              <a href="#waitlist" className={s.btnPrimary}>
                Join the waitlist
              </a>
              {/*
                Calendly popup button - wire up with Calendly widget script in production.
                Script: https://assets.calendly.com/assets/external/widget.js
                Add data-url="YOUR_CALENDLY_URL" and call Calendly.initPopupWidget()
              */}
              <button
                type="button"
                className={s.btnSecondary}
                data-calendly-popup
              >
                <PhoneCall size={16} />
                Book a call with the founder
              </button>
            </div>
            <p className={s.heroPoof}>
              {/* Update this count dynamically once backend is wired */}
              12 cooks have already applied.
            </p>
          </div>

          {/* Hero image - replace placeholder with cook-cooking.jpg */}
          <div className={s.heroImage}>
            <Image
              src="/placeholder.jpg"
              alt="Cook preparing meal prep in their kitchen"
              fill
              style={{ objectFit: "cover" }}
              priority
              sizes="(max-width: 1023px) 100vw, 45vw"
            />
            {/*
              IMAGE RECOMMENDATION:
              cook-cooking.jpg - candid kitchen shot.
              Full-bleed right panel, object-position: center.
              This is the highest trust-building image on the site.
            */}
          </div>
        </section>

        {/* ── Problem ──────────────────────────────────────── */}
        <section className={s.problem} id="problem" aria-label="The problem">
          <div className={s.problemInner}>
            <div>
              <p className={s.sectionLabel}>The gap</p>
              <h2 className={s.sectionHeadline}>
                Great cooks in Toronto are already selling. Nobody can find
                them.
              </h2>
              <p className={s.sectionBody}>
                You are cooking out of your kitchen, texting 30 people every
                Sunday, collecting deposits through Instagram. You are already
                running a business - just without any of the tools a business
                needs.
              </p>
              <p className={s.sectionBody}>
                On the other side, people in your city are paying $25 on Uber
                Eats daily or eating the same centralised meal prep every week.
                The food they want - diverse, home-cooked, affordable - exists.
                There is just no way to find it.
              </p>
              <p className={s.sectionBody}>7eats connects both sides.</p>
            </div>

            {/* IMAGE RECOMMENDATION: meal-prep1.jpg - food shot, use at low opacity as supporting visual */}
            <div className={s.problemImage}>
              <Image
                src="/placeholder.jpg"
                alt="Home-cooked meal prep containers"
                fill
                style={{ objectFit: "cover" }}
                sizes="(max-width: 767px) 100vw, 50vw"
              />
            </div>
          </div>
        </section>

        {/* ── Features & Benefits ───────────────────────────── */}
        <section
          className={s.features}
          id="features"
          aria-label="Features and benefits"
        >
          <div className={s.featuresInner}>
            <div className={s.featuresHeader}>
              <p className={s.sectionLabel}>What you get</p>
              <h2 className={s.sectionHeadline}>
                Built for how you already cook. Just better.
              </h2>
            </div>
            <div className={s.featuresGrid}>
              {features.map((f) => (
                <article key={f.title} className={s.featureCard}>
                  <div className={s.featureIcon}>{f.icon}</div>
                  <h3 className={s.featureTitle}>{f.title}</h3>
                  <p className={s.featureDesc}>{f.description}</p>
                  {f.hasImage && (
                    /* IMAGE RECOMMENDATION: cook-using-app.png - cook looking at phone */
                    <div className={s.featureImageWrap}>
                      <Image
                        src="/placeholder.jpg"
                        alt="Cook coordinating pickup on 7eats app"
                        fill
                        style={{ objectFit: "cover" }}
                        sizes="(max-width: 639px) 100vw, 50vw"
                      />
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ─────────────────────────────────── */}
        <section
          className={s.howItWorks}
          id="how-it-works"
          aria-label="How it works"
        >
          <div className={s.howItWorksInner}>
            <div className={s.howItWorksHeader}>
              <p className={s.sectionLabel}>How it works</p>
              <h2 className={s.sectionHeadline}>
                From your kitchen to your customers in four steps.
              </h2>
            </div>
            <div className={s.stepsGrid}>
              {steps.map((step) => (
                <div key={step.number} className={s.step}>
                  <p className={s.stepNumber}>Step {step.number}</p>
                  <h3 className={s.stepTitle}>{step.title}</h3>
                  <p className={s.stepDesc}>{step.description}</p>
                  {step.hasImage && (
                    /* IMAGE RECOMMENDATION: cook-using-app.png */
                    <div className={s.stepImageWrap}>
                      <Image
                        src="/placeholder.jpg"
                        alt="Cook coordinating pickups through 7eats"
                        fill
                        style={{ objectFit: "cover" }}
                        sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Statistics ───────────────────────────────────── */}
        <section
          className={s.statistics}
          id="statistics"
          aria-label="Market statistics"
        >
          <div className={s.statisticsInner}>
            <p className={s.sectionLabel}>The opportunity</p>
            <h2 className={s.sectionHeadline}>
              The most multicultural city in the world. No platform for its
              cooks.
            </h2>
            <div className={s.statsGrid}>
              {stats.map((stat) => (
                <div key={stat.label} className={s.statItem}>
                  <span className={s.statNumber}>{stat.number}</span>
                  <span className={s.statLabel}>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Special Offer ────────────────────────────────── */}
        <section
          className={s.offer}
          id="founding-cook"
          aria-label="Founding cook offer"
        >
          <div className={s.offerInner}>
            <div>
              <div className={s.offerBadge}>
                <BadgeCheck size={14} />
                Founding Cook - 40 spots only
              </div>
              <p className={s.sectionLabel}>Why join now</p>
              <h2 className={s.sectionHeadline}>
                The first 40 cooks on 7eats get terms no future cook will.
              </h2>
              <p className={s.sectionBody}>
                We are keeping this small deliberately. Founding cooks help us
                build the product right. In return, they earn permanent
                advantages that do not expire.
              </p>
              <ul className={s.offerList}>
                {offerBenefits.map((benefit) => (
                  <li key={benefit.title} className={s.offerItem}>
                    <CheckCircle2 className={s.offerCheck} size={20} />
                    <div>
                      <p className={s.offerItemText}>{benefit.title}</p>
                      <p className={s.offerItemSub}>{benefit.sub}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className={s.offerCallout}>
              <p className={s.offerCalloutTitle}>Ready to lock in your spot?</p>
              <p className={s.offerCalloutBody}>
                Join the waitlist now. We will reach out to each founding cook
                personally before the platform launches to complete your profile
                and get you set up.
              </p>
              <a href="#waitlist" className={s.btnPrimary}>
                Apply for founding cook
              </a>
              <p className={s.spotsLeft}>
                <span className={s.spotsNumber}>28 spots</span> remaining out of
                40.
              </p>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────── */}
        <section
          className={s.faq}
          id="faq"
          aria-label="Frequently asked questions"
        >
          <div className={s.faqInner}>
            <div className={s.faqHeader}>
              <p className={s.sectionLabel}>Questions</p>
              <h2 className={s.sectionHeadline}>Straight answers.</h2>
            </div>
            <div className={s.faqGrid}>
              {faqs.map((item) => (
                <div key={item.q} className={s.faqItem}>
                  <p className={s.faqQuestion}>{item.q}</p>
                  <p className={s.faqAnswer}>{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────── */}
        <section className={s.cta} id="waitlist" aria-label="Join the waitlist">
          <div className={s.ctaInner}>
            <p className={s.sectionLabel}>Get early access</p>
            <h2 className={s.ctaHeadline}>
              Stop selling through DMs. Start building a real business.
            </h2>
            <p className={s.ctaSubtext}>
              Join the waitlist and be among the first cooks on 7eats. We will
              reach out personally when we are ready to onboard you.
            </p>

            {/* Email waitlist form - wire up to /api/waitlist when ready */}
            <form
              className={s.waitlistForm}
              action="#"
              method="POST"
              aria-label="Waitlist signup form"
            >
              <input
                type="email"
                name="email"
                placeholder="your@email.com"
                required
                className={s.emailInput}
                aria-label="Email address"
              />
              <button type="submit" className={s.btnPrimary}>
                Join waitlist
              </button>
            </form>
            <p className={s.ctaNote}>
              No spam. One email when we are ready to launch.
            </p>

            <div className={s.ctaDivider}>
              <span className={s.ctaDividerLine} />
              <span className={s.ctaDividerText}>or</span>
              <span className={s.ctaDividerLine} />
            </div>

            {/*
              Calendly popup button - wire up with:
              <script src="https://assets.calendly.com/assets/external/widget.js"></script>
              Then call: Calendly.initPopupWidget({ url: 'YOUR_CALENDLY_URL' })
            */}
            <button
              type="button"
              className={s.btnSecondary}
              data-calendly-popup
              style={{ width: "100%" }}
            >
              <Calendar size={16} />
              Book a 20-minute call with the founder
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
