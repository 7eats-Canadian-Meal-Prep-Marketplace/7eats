"use client";

import { useState } from "react";
import { toast } from "sonner";
import CalendlyButton from "./CalendlyButton";

interface CtaSectionProps {
  isTeamPage?: boolean;
}

export default function CtaSection({
  isTeamPage: _isTeamPage = false,
}: CtaSectionProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    let response: Response;
    try {
      response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      toast.error("Something went wrong. Please try again.");
      return;
    } finally {
      setLoading(false);
    }

    if (response.ok) {
      toast.success("You're on the list!");
      setEmail("");
      return;
    }

    if (response.status === 409) {
      toast.info("You're already on the list.");
      setEmail("");
      return;
    }

    if (response.status === 429) {
      toast.error("Too many attempts. Try again later.");
      return;
    }

    toast.error("Something went wrong. Please try again.");
  }

  return (
    <section className="section cta" id="cta">
      <div className="wrap">
        <div className="cta-grid">
          <div>
            <span className="eyebrow on-dark">Get started</span>
            <h2 style={{ marginTop: 18 }}>
              Your next customers are already looking.{" "}
              <span className="accent-red">Let them find you.</span>
            </h2>
            <p>
              Join the waitlist and we&apos;ll be in touch within 12 hours. Or
              grab 30 minutes directly with a founder.
            </p>
          </div>
          <form className="cta-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Join the cook waitlist</label>
            <div className="cta-form-row">
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="your-name@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                Notify me
              </button>
            </div>
            <p className="cta-trust">
              No spam. You&apos;ll hear from us when it matters.
            </p>
            <div className="cta-divider">
              <span>or</span>
            </div>
            <CalendlyButton
              className="btn btn-ghost on-dark"
              style={{ width: "100%" }}
            >
              Book a 30-minute call with the founders
            </CalendlyButton>
          </form>
        </div>
      </div>
    </section>
  );
}
