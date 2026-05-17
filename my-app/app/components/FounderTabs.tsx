"use client";

import Image from "next/image";
import { useState } from "react";

type FounderId = "amara" | "dev" | "adnane";

interface Founder {
  id: FounderId;
  name: string;
  city: string;
  linkedin: string;
  portraitTag: string;
  portraitNote: string;
  image?: string;
  bio: string[];
  quote: string;
  email: string;
}

const FOUNDERS: Founder[] = [
  {
    id: "amara",
    name: "Mohamad Addasi",
    city: "Montreal",
    linkedin: "https://www.linkedin.com/in/mohamad-addasi/",
    portraitTag: "PORTRAIT · 800 × 1000",
    portraitNote:
      "Founder portrait - Mohamad, warm natural light. Vertical crop.",
    image: "/mohamad_profile.jpg",
    bio: [
      "Mohamad is a software engineering student at Concordia University, currently a software development intern at Autodesk and previously a data science intern at Intact. What drives him is not technology for its own sake but the kind of systems that quietly make something difficult feel simple for the people using them.",
      "7eats is exactly that kind of problem. Talented cooks exist in every neighbourhood, already running informal businesses with minimal infrastructure behind them. Mohamad saw the gap and knew what it would take to close it.",
    ],
    quote:
      "There are incredible cooks hiding in plain sight. Customers want variety and do not know where to look. That gap only exists because nobody built the right connector yet.",
    email: "maddasi04@gmail.com",
  },
  {
    id: "dev",
    name: "Hendrik Tebeng",
    city: "Toronto",
    linkedin: "https://www.linkedin.com/in/hendrik-tebeng/",
    portraitTag: "PORTRAIT · 800 × 1000",
    portraitNote:
      "Founder portrait - Hendrik, natural light. Vertical crop.",
    image: "/hendrik_profile.png",
    bio: [
      "Hendrik is a software engineering student at Concordia University and an intern at CIBC. Between school, work, and projects, cooking became a challenge early on. He started looking into meal prep as a way to stay on top of it and realized how hard it was to find the right options.",
      "Moving to Toronto sharpened the problem. Many apartments do not come with a kitchen, so ordering out stops being a choice and becomes a reflex. He watched people around him spend hundreds a month on food, feel bad about it, and do it all over again the following week. That cycle of guilt needed a fix.",
    ],
    quote:
      "Meal prep fits a budget. Fast food feeds a habit and leaves you feeling bad about it. We are building 7eats so people can actually take control of that part of their lives.",
    email: "hendriktebeng@gmail.com",
  },
  {
    id: "adnane",
    name: "Adnane Bejja",
    city: "Montreal",
    linkedin: "https://linkedin.com/in/adnane-bejja",
    portraitTag: "PORTRAIT · 800 × 1000",
    portraitNote:
      "Founder portrait - Adnane, natural light. Vertical crop.",
    bio: [
      "Adnane is a software engineering student at Concordia University and a software developer at Intact Financial Corporation.",
      "Placeholder — add Adnane's personal story and connection to the 7eats mission here.",
    ],
    quote:
      "Placeholder — add Adnane's quote here.",
    email: "adnane@7eats.ca",
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
            <span className="small">Co-founder &middot; {founder.city}</span>
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
              {founder.image ? (
                <Image
                  src={founder.image}
                  alt={`${founder.name} portrait`}
                  fill
                  style={{ objectFit: "cover", objectPosition: "center top" }}
                  sizes="(max-width: 900px) 100vw, 45vw"
                />
              ) : (
                <div className="placeholder">
                  <div>
                    <span className="ph-tag">{founder.portraitTag}</span>
                    <em className="ph-note">{founder.portraitNote}</em>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="founder-body">
            <span className="role">Co-founder &middot; {founder.city}</span>
            <h2>{founder.name}</h2>
            {founder.bio.map((paragraph, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static array
              <p key={i}>{paragraph}</p>
            ))}
            <div className="founder-quote">{founder.quote}</div>
            <div className="founder-links">
              <a
                href={founder.linkedin}
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
