import Image from "next/image";
import Link from "next/link";
import CalendlyButton from "@/app/components/CalendlyButton";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand">
            <Image
              src="/7eats-logo.svg"
              alt="7eats"
              width={120}
              height={36}
              style={{ height: 36, width: "auto" }}
            />
            <p>
              The home for Toronto&apos;s independent cooks. Built in Toronto,
              for Toronto.
            </p>
          </div>
          <div className="footer-col">
            <h4>Site</h4>
            <ul>
              <li>
                <Link href="/waitlist">Home</Link>
              </li>
              <li>
                <Link href="/team">Meet the team</Link>
              </li>
              <li>
                <Link href="#faq">FAQ</Link>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>For cooks</h4>
            <ul>
              <li>
                <Link href="#cta">Join the waitlist</Link>
              </li>
              <li>
                <Link href="#offer">Founding cook offer</Link>
              </li>
              <li>
                <CalendlyButton>Book a call</CalendlyButton>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Contact</h4>
            <ul>
              <li>
                <a href="mailto:hello@7eats.ca">hello@7eats.ca</a>
              </li>
              <li>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; 2026 7eats Inc. &middot; Toronto, ON</span>
          <div className="footer-legal">
            <a href="/privacy">Privacy policy</a>
            <a href="/cookies">Cookie consent</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
