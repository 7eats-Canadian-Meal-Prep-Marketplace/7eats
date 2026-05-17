import Image from "next/image";
import { Calendar, PhoneCall } from "lucide-react";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import s from "./page.module.css";

export const metadata = {
  title: "About - 7eats",
  description:
    "Meet the founders of 7eats and understand why we are building this for Toronto's home cooks.",
};

const founders = [
  {
    name: "Founder Name",
    role: "Co-founder & CEO",
    bio: "Placeholder bio - replace with real founder story. Where did the idea come from? What in your experience made this feel necessary? Keep it personal, not a LinkedIn summary.",
  },
  {
    name: "Founder Name",
    role: "Co-founder & CTO",
    bio: "Placeholder bio - replace with real founder story. What is your background and what specifically drew you to this problem? Write like a person, not a press release.",
  },
];

const values = [
  {
    title: "Cooks keep what they earn.",
    description:
      "Our commission is set to be the lowest viable rate - not the maximum we can extract. If you earn more, we earn more. That alignment matters.",
  },
  {
    title: "Cultural diversity is the product, not a feature.",
    description:
      "Toronto's food culture is the entire point. We are not a generic meal prep platform that accepts diverse food. We are built around it.",
  },
  {
    title: "Your neighbourhood should feed you.",
    description:
      "We are hyper-local by design. A cook in Scarborough should not need to compete with a cook in Etobicoke. Proximity matters for food.",
  },
  {
    title: "Transparency over extraction.",
    description:
      "We will publish our commission rate, our fee structure, and our decisions publicly. Cooks deserve to know exactly how the platform they depend on works.",
  },
];

export default function FoundersPage() {
  return (
    <>
      <Header />

      <main>
        {/* ── Our Story ─────────────────────────────────────── */}
        <section className={s.story} aria-label="Our story">
          <div className={s.storyInner}>
            <div>
              <p className={s.sectionLabel}>Who we are</p>
              <h1 className={s.sectionHeadline}>
                We saw something broken in Toronto's food scene. We could not
                leave it alone.
              </h1>
              <p className={s.bodyText}>
                Placeholder - replace with the real origin story. How did you
                first notice this problem? Was it a cook you knew personally? A
                neighbourhood you grew up in? A meal you could not stop thinking
                about? Write it like you would tell a friend, not a pitch deck.
              </p>
              <p className={s.bodyText}>
                The observation was simple: extraordinary cooks were operating
                entirely through DMs and word of mouth, invisible to anyone
                outside their personal network. The food was there. The talent
                was there. The infrastructure was not.
              </p>
            </div>

            {/*
              IMAGE RECOMMENDATION:
              cook-cooking.jpg - candid, warm, human kitchen shot.
              This is the most trust-building image on the site.
              Place it here, full-height of the text column, object-fit: cover.
            */}
            <div className={s.storyImage}>
              <Image
                src="/placeholder.jpg"
                alt="Founder in the kitchen - placeholder for cook-cooking.jpg"
                fill
                style={{ objectFit: "cover" }}
                sizes="(max-width: 767px) 100vw, 50vw"
              />
            </div>
          </div>
        </section>

        {/* ── Founders ──────────────────────────────────────── */}
        <section className={s.founders} aria-label="The founders">
          <div className={s.foundersInner}>
            <p className={s.sectionLabel}>The team</p>
            <h2 className={s.sectionHeadline}>
              Two people. One problem. All of Toronto.
            </h2>

            <div className={s.foundersGrid}>
              {founders.map((f, i) => (
                <div key={i} className={s.founderCard}>
                  {/*
                    IMAGE RECOMMENDATION:
                    Use a real founder portrait here - natural light, candid preferred over studio.
                    Aspect ratio 3:4, object-fit: cover. Warm and human, not LinkedIn headshot.
                  */}
                  <div className={s.founderPhoto}>
                    <Image
                      src="/placeholder.jpg"
                      alt={`${f.name} - placeholder for founder portrait`}
                      fill
                      style={{ objectFit: "cover" }}
                      sizes="(max-width: 639px) 100vw, 50vw"
                    />
                  </div>
                  <div>
                    <p className={s.founderName}>{f.name}</p>
                    <p className={s.founderRole}>{f.role}</p>
                    <p className={s.founderBio}>{f.bio}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Conviction / Why We Are Building This ─────────── */}
        <section className={s.conviction} aria-label="Why we are building this">
          <div className={s.convictionInner}>
            {/*
              IMAGE RECOMMENDATION:
              meal-prep2.jpg or meal-prep3.jpg - real food shot, looks made with care.
              Warm, close-up, slightly imperfect. Not a stock-photo-perfect spread.
            */}
            <div className={s.convictionImage}>
              <Image
                src="/placeholder.jpg"
                alt="Home-cooked meal prep - placeholder for meal-prep2.jpg or meal-prep3.jpg"
                fill
                style={{ objectFit: "cover" }}
                sizes="(max-width: 767px) 100vw, 50vw"
              />
            </div>

            <div>
              <p className={s.sectionLabel}>Why this</p>
              <h2 className={s.sectionHeadline}>
                Toronto has extraordinary culinary talent that no platform can
                reach.
              </h2>
              <p className={s.bodyText}>
                Every immigrant community in this city has food culture that
                does not exist in restaurants. It lives in home kitchens,
                community events, and family gatherings. There is no platform
                designed to bring that food to the people one neighbourhood over
                who would pay for it.
              </p>
              <p className={s.bodyText}>
                Meanwhile, consumers are paying Uber Eats prices for food that
                is assembled in a commercial kitchen, not cooked by someone who
                cares. The imbalance is obvious once you see it.
              </p>
              <p className={s.bodyText}>
                We are not building this to disrupt food delivery. We are
                building it because this specific thing - home-cooked meal prep
                from real cooks in your city - deserves to exist as a real
                business for the people making it.
              </p>
            </div>
          </div>
        </section>

        {/* ── Values ────────────────────────────────────────── */}
        <section className={s.values} aria-label="Our values">
          <div className={s.valuesInner}>
            <p className={s.sectionLabel}>How we operate</p>
            <h2 className={s.sectionHeadline}>What we actually believe.</h2>
            <div className={s.valuesGrid}>
              {values.map((v, i) => (
                <div key={v.title} className={s.valueItem}>
                  <p className={s.valueIndex}>
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className={s.valueTitle}>{v.title}</h3>
                  <p className={s.valueDesc}>{v.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Strip ─────────────────────────────────────── */}
        <section className={s.ctaStrip} aria-label="Join the waitlist">
          <div className={s.ctaStripInner}>
            <h2 className={s.ctaTitle}>
              If this resonates, we want to hear from you.
            </h2>
            <p className={s.ctaBody}>
              Join the waitlist and be among the first cooks on 7eats. Or book a
              call - we genuinely want to talk to every cook considering this.
            </p>
            <div className={s.ctaActions}>
              <a href="/waitlist#waitlist" className={s.btnPrimary}>
                Join the waitlist
              </a>
              {/*
                Calendly popup button - wire up with Calendly popup widget script in production.
                data-calendly-popup will be used as the hook for the widget initialisation.
              */}
              <button
                type="button"
                className={s.btnSecondary}
                data-calendly-popup
              >
                <PhoneCall size={16} />
                Book a call
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
