"use client";

import { type ReactElement, useEffect, useRef, useState } from "react";

interface Props {
  className?: string;
  itemClassName?: string;
  threshold?: number;
  staggerMs?: number;
  children: ReactElement[];
}

export default function FadeInGroup({
  className,
  itemClassName,
  threshold = 0.2,
  staggerMs = 100,
  children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
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
      { threshold, rootMargin: "-40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div ref={ref} className={className}>
      {children.map((child, i) => (
        <div
          key={child.key}
          className={itemClassName}
          style={{
            opacity: active ? 1 : 0,
            transform: active ? "translateY(0)" : "translateY(28px)",
            transition: `opacity 0.5s ease ${i * staggerMs}ms, transform 0.5s ease ${i * staggerMs}ms`,
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
