"use client";

import { useState } from "react";
import { FAQ_ITEMS } from "@/app/data/faq-items";

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
