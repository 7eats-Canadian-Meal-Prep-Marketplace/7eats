"use client";

import { useState } from "react";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-kind",
    question: "What kind of cook is 7eats for?",
    answer:
      "For our first year we're onboarding independent cooks who already hold a valid food-handler certification and cook out of a permitted space. If you have your cert and a kitchen - you're our person.",
  },
  {
    id: "how-much",
    question: "How much do I keep per order?",
    answer:
      "You keep 92% of every order. We charge a flat 8% to cover payment processing and the platform. Founding cooks - the first 50 in Toronto - pay nothing for their first 90 days.",
  },
  {
    id: "how-pickup",
    question: "How does pickup work for customers?",
    answer:
      "Customers choose a 15-minute pickup window when they order. We stagger those windows so you're not flooded at the door at once. You stay in control of how many windows you open.",
  },
  {
    id: "how-paid",
    question: "When do I get paid?",
    answer:
      "Payouts land in your bank account every Tuesday for the previous weekend's orders. We use Stripe for payouts, so you'll need a Canadian bank account.",
  },
  {
    id: "need-cert",
    question: "Do I need a food-handler certificate to join?",
    answer:
      "Yes - Ontario requires it for anyone preparing food commercially. If you don't have one yet, founding cooks get their certification sponsored by 7eats as part of the founding cook package.",
  },
  {
    id: "which-neighbourhoods",
    question: "Which neighbourhoods is 7eats launching in?",
    answer:
      "We're starting hyper-local - Scarborough, North York, and Etobicoke first, expanding into the rest of the GTA through 2026. If you're in a neighbourhood not listed, join the waitlist and we'll notify you when we reach you.",
  },
];

export default function FaqAccordion() {
  const [openId, setOpenId] = useState<string>(FAQ_ITEMS[0].id);

  function toggle(id: string) {
    setOpenId((current) => (current === id ? "" : id));
  }

  return (
    <div className="faq-list">
      {FAQ_ITEMS.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className={`faq-item${isOpen ? " is-open" : ""}`}>
            <button
              type="button"
              className="faq-q"
              aria-expanded={isOpen}
              onClick={() => toggle(item.id)}
            >
              {item.question}
              <span className="plus">
                <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path
                    d="M6 1v10M1 6h10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </button>
            <div className="faq-a">
              <div className="faq-a-inner">{item.answer}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
