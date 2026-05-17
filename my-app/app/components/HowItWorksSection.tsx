"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    num: "01",
    title: "Onboard and list your meals.",
    body: "Set up your cook profile, add your weekly meal prep menu, set portions, prices, and pickup windows. Takes minutes.",
  },
  {
    num: "02",
    title: "Receive orders and coordinate.",
    body: "Customers find you, place orders, and pay upfront. Manage pickup windows or delivery slots from your dashboard. No back-and-forth needed.",
  },
  {
    num: "03",
    title: "Cook, hand off, earn.",
    body: "Prep what you know is sold. Pickups are staggered in timed windows. Payouts hit your account automatically.",
  },
];

export default function HowItWorksSection() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25, rootMargin: "-60px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="section how" id="how" ref={ref}>
      <div className="wrap">
        <div className="how-head how-head-centered">
          <span className="eyebrow">How it works</span>
          <h2 className="h-xl" style={{ marginTop: 18 }}>
            From your kitchen to a real business in three steps.
          </h2>
        </div>
        <div className="how-steps">
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className="how-step"
              style={{
                opacity: active ? 1 : 0,
                transform: active ? "translateY(0)" : "translateY(32px)",
                transition: `opacity 0.55s ease ${i * 120}ms, transform 0.55s ease ${i * 120}ms`,
              }}
            >
              <div className="how-step-num">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
