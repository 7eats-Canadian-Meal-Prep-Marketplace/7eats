"use client";

import { useState } from "react";

type FounderId = "amara" | "dev" | "leyla";

interface Founder {
  id: FounderId;
  name: string;
  role: string;
  born: string;
  background: string;
  cooks: string;
  portraitTag: string;
  portraitNote: string;
  bio: string[];
  quote: string;
  email: string;
}

const FOUNDERS: Founder[] = [
  {
    id: "amara",
    name: "Amara Osei",
    role: "CEO & co-founder",
    born: "Accra → Scarborough",
    background: "12 years in marketplaces",
    cooks: "Jollof rice on Sundays",
    portraitTag: "PORTRAIT · 800 × 1000",
    portraitNote:
      "Founder portrait - Amara, warm natural light, in a Toronto kitchen. Vertical crop.",
    bio: [
      "Amara grew up watching her mother run an unofficial Ghanaian kitchen out of their Scarborough apartment - sixty plates of jollof every weekend, every customer a friend, no website, no system, just a battered notebook and a WhatsApp group named “Auntie Ama’s.”",
      "She spent the last decade building marketplaces at scale - early at a delivery unicorn, then a stint at a global fintech - before deciding the one she actually wanted to build was the one her mother needed twenty years ago.",
    ],
    quote:
      "“My mum sold out every weekend for two decades and never once felt like she had a business. We’re building 7eats so the next Auntie Ama gets to feel like a founder.”",
    email: "amara@7eats.ca",
  },
  {
    id: "dev",
    name: "Dev Saini",
    role: "CTO & co-founder",
    born: "Brampton",
    background: "10 years shipping product",
    cooks: "Dal makhani at midnight",
    portraitTag: "PORTRAIT · 800 × 1000",
    portraitNote:
      "Founder portrait - Dev, casual, mid-laugh, holding a coffee. Vertical crop.",
    bio: [
      "Dev led platform engineering at two Canadian marketplaces before this one, including the team that built the pickup-orchestration system at a national grocer. He thinks in queues, edge cases, and Sunday-evening loads.",
      "He joined the moment Amara showed him a spreadsheet of forty Brampton aunties manually copying WhatsApp orders into Google Sheets every Friday at 5pm.",
    ],
    quote:
      "“Most marketplace software was built for restaurants. Independent cooks have completely different physics. The tools should match.”",
    email: "dev@7eats.ca",
  },
  {
    id: "leyla",
    name: "Leyla Haddad",
    role: "COO & co-founder",
    born: "Beirut → North York",
    background: "9 years in food & ops",
    cooks: "Kibbeh that ruins you for any other",
    portraitTag: "PORTRAIT · 800 × 1000",
    portraitNote:
      "Founder portrait - Leyla, sharp, mid-conversation in a kitchen. Vertical crop.",
    bio: [
      "Leyla spent her twenties running operations for a fast-growing meal-kit company before opening a small commissary kitchen in North York that has hosted forty independent food businesses to date.",
      "She handles cook onboarding, food-safety certification, and the part of the business where things actually have to happen on time. She also tests every dish that goes live on the platform.",
    ],
    quote:
      "“A platform without trust is a phone book. We’re not trying to be the biggest. We’re trying to be the one cooks recommend to their cousins.”",
    email: "leyla@7eats.ca",
  },
];

export default function FounderTabs() {
  const [activeId, setActiveId] = useState<FounderId>("amara");

  return (
    <>
      <div className="founders-tabs" role="tablist">
        {FOUNDERS.map((founder) => (
          <button
            type="button"
            key={founder.id}
            className={`founder-tab${activeId === founder.id ? " is-active" : ""}`}
            role="tab"
            aria-selected={activeId === founder.id}
            onClick={() => setActiveId(founder.id)}
          >
            <span>{founder.name}</span>
            <span className="small">{founder.role}</span>
          </button>
        ))}
      </div>

      {FOUNDERS.map((founder) => (
        <div
          key={founder.id}
          className={`founder-panel founder-card${activeId === founder.id ? " is-active" : ""}`}
          role="tabpanel"
          aria-hidden={activeId !== founder.id}
        >
          <div>
            <div className="founder-portrait">
              <div className="placeholder">
                <div>
                  <span className="ph-tag">{founder.portraitTag}</span>
                  <em className="ph-note">{founder.portraitNote}</em>
                </div>
              </div>
            </div>
          </div>
          <div className="founder-body">
            <span className="role">{founder.role}</span>
            <h2>{founder.name}</h2>
            {founder.bio.map((paragraph, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static array
              <p key={i}>{paragraph}</p>
            ))}
            <div className="founder-quote">{founder.quote}</div>
            <div className="founder-links">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                LinkedIn
              </a>
              <a href={`mailto:${founder.email}`}>{founder.email}</a>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
