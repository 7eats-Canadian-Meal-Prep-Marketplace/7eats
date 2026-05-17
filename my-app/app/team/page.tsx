import Image from "next/image";
import BannerFlash from "@/app/components/BannerFlash";
import CtaSection from "@/app/components/CtaSection";
import Footer from "@/app/components/Footer";
import FounderTabs from "@/app/components/FounderTabs";
import Header from "@/app/components/Header";

export const metadata = {
  title: "Meet the team - 7eats",
  description:
    "Three people, fifteen years of marketplaces and kitchens between us, and one shared belief: Toronto's independent cooks deserve infrastructure.",
};

export default function TeamPage() {
  return (
    <>
      <BannerFlash />
      <Header activePage="team" />

      {/* FOUNDERS */}
      <section className="section founders team-page-opener">
        <div className="wrap">
          <div className="founders-head">
            <span className="eyebrow">Our story</span>
            <h2 className="h-xl">Built by people who live the problem.</h2>
            <p className="lead">
              We are students juggling internships, tight budgets, and the daily
              reality of spending too much on food. We built 7eats because we
              felt the gap ourselves.
            </p>
          </div>
          <FounderTabs />
        </div>
      </section>

      {/* WHY */}
      <section className="section why">
        <div className="wrap">
          <div className="why-letter">
            <span className="eyebrow on-dark">Why we&apos;re building it</span>
            <p className="why-quote">
              The best food in Toronto is being made at home.{" "}
              <span className="accent-italic">
                Most people never get to try it.
              </span>
            </p>
            <div className="why-body">
              <p>
                Toronto is one of the most culturally diverse cities on earth.
                It shows in its neighbourhoods, its markets, and its people. But
                the best food this city produces has never been in a restaurant.
                It lives in apartment kitchens, basement prep spaces, and home
                dining rooms run by people who learned to cook before they
                learned English.
              </p>
              <p>
                Those cooks already exist. Thousands of them, across every
                borough, feeding regulars through DMs and e-transfers and
                personal networks built entirely on trust. They do not lack
                skill, customers, or demand. They lack the{" "}
                <em>infrastructure</em> to grow beyond the circle they were born
                into.
              </p>
              <p>
                7eats is built for that gap. On the other side of it are the
                students eating out of convenience, not choice. The
                professionals spending two hundred dollars a week on food they
                did not really want. The people who know home-cooked meals exist
                nearby but have no way to find them. We are connecting both
                sides of a market that has always been there.
              </p>
            </div>
            <div className="why-sign">
              <span className="why-sign-name">
                Mohamad, Hendrik &amp; Adnane
              </span>
              <span className="why-sign-meta">
                Co-founders, 7eats &middot; Toronto
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="section values">
        <div className="wrap">
          <div className="values-head">
            <span className="eyebrow">Our values</span>
            <h2 className="h-xl" style={{ marginTop: 18 }}>
              <Image
                src="/7eats-icon-red.svg"
                alt="7eats"
                width={48}
                height={48}
                className="values-icon"
                style={{
                  display: "inline-block",
                  verticalAlign: "top",
                  marginRight: 12,
                  marginTop: -4,
                }}
              />{" "}
              rules we don&apos;t break.
            </h2>
          </div>
          <div className="values-list">
            <div className="values-row">
              <div className="n">01</div>
              <h3>Cooks first.</h3>
              <p>
                Every product decision passes one test: does this make a
                cook&apos;s week better? If not, we don&apos;t ship it.
              </p>
            </div>
            <div className="values-row">
              <div className="n">02</div>
              <h3>Take less.</h3>
              <p>
                A flat rate, no hidden fees, no surprise cuts. The cook should
                always know what they earned before we do.
              </p>
            </div>
            <div className="values-row">
              <div className="n">03</div>
              <h3>Your prices, your call.</h3>
              <p>
                We never touch your pricing. No algorithmic discounts, no
                suggested cuts, no race to the bottom. You set the value of your
                food.
              </p>
            </div>
            <div className="values-row">
              <div className="n">04</div>
              <h3>Your customers belong to you.</h3>
              <p>
                Every repeat customer you earn on 7eats is yours. We don&apos;t
                remarket them to other cooks or hide their data from you.
              </p>
            </div>
            <div className="values-row">
              <div className="n">05</div>
              <h3>Real support when things go wrong.</h3>
              <p>
                No-show customer. Disputed payment. An unfair review. You get a
                real response, not a ticket number and a 3-day wait.
              </p>
            </div>
            <div className="values-row">
              <div className="n">06</div>
              <h3>Visibility is earned, not bought.</h3>
              <p>
                We don&apos;t sell ad slots. A cook with 50 orders and great
                reviews will always outrank one who just paid more. Your
                reputation does the marketing.
              </p>
            </div>
            <div className="values-row">
              <div className="n">07</div>
              <h3>We win when you win.</h3>
              <p>
                We make money when cooks make money. Our incentives are aligned
                by design. If cooks aren&apos;t earning, neither are we.
              </p>
            </div>
          </div>
        </div>
      </section>

      <CtaSection isTeamPage />
      <Footer />
    </>
  );
}
