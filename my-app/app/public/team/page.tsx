import Image from "next/image";
import CtaSection from "@/app/components/CtaSection";
import FounderTabs from "@/app/components/FounderTabs";

export const metadata = {
  title: "Meet the team - 7eats",
  description:
    "Three people, fifteen years of marketplaces and kitchens between us, and one shared belief: Toronto's meal prep businesses deserve real infrastructure.",
};

export default function TeamPage() {
  return (
    <>
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
                Toronto has students eating out of convenience, not choice.
                Professionals spending two hundred dollars a week on food they
                do not actually want. People who know something better exists
                nearby but have no way to find it. The demand for real, fresh
                meal prep is there. The discovery is not.
              </p>
              <p>
                The supply is already there too. Thousands of cooks across every
                borough, building customer bases through DMs, bank transfers,
                and word of mouth. They are not short of skill or demand. They
                are short of <em>infrastructure</em> and a real way to grow
                beyond the network they were born into.
              </p>
              <p>
                Toronto is one of the most culturally diverse cities on earth.
                The best food this city makes has never been on a menu. It lives
                in apartment kitchens and home dining rooms, made by people who
                cook with a level of care no chain can replicate. 7eats is how
                both sides finally find each other.
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
    </>
  );
}
