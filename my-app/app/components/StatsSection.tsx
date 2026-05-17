"use client";

import { useEffect, useRef, useState } from "react";

interface Stat {
  prefix?: string;
  value: number;
  suffix?: string;
  label: string;
  decimals?: number;
}

const STATS: Stat[] = [
  {
    value: 200,
    suffix: "+",
    label:
      "Distinct ethnic origins in Toronto alone - creating unmatched demand for authentic, home-style cultural food.",
  },
  {
    value: 87,
    suffix: "%",
    label:
      "Of Canadians say rising food prices are making it harder to eat healthy. Affordable home-cooked meals are the answer.",
  },
  {
    prefix: "$",
    value: 28,
    label:
      "What a $16 pizza costs on Uber Eats after fees and tip. Customers are ready for a better option.",
  },
];

const DURATION = 1800;

function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4;
}

function useCountUp(target: number, decimals = 0, active: boolean) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = easeOutQuart(progress);
      setCount(Number((eased * target).toFixed(decimals)));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setCount(target);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, target, decimals]);

  return count;
}

function StatItem({ stat, active }: { stat: Stat; active: boolean }) {
  const count = useCountUp(stat.value, stat.decimals ?? 0, active);

  return (
    <div className="stat">
      <div className="stat-num">
        {stat.prefix}
        {count}
        {stat.suffix && <small>{stat.suffix}</small>}
      </div>
      <p className="stat-label">{stat.label}</p>
    </div>
  );
}

export default function StatsSection() {
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
      { threshold: 0.5, rootMargin: "-80px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="section stats" ref={ref}>
      <div className="wrap">
        <span className="eyebrow on-dark">Why this matters</span>
        <div className="stats-row">
          {STATS.map((stat) => (
            <StatItem key={stat.label} stat={stat} active={active} />
          ))}
        </div>
      </div>
    </section>
  );
}
