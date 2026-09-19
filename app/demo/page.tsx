"use client";

import { useEffect, useRef } from "react";
import "./demo.css";

const FEATURES = [
  {
    icon: "IN",
    title: "Invoices that look paid already",
    body: "Send clean, branded invoices in under a minute. Clients get a payment link; you get a record that reconciles itself.",
    radiusClass: "radius-system",
  },
  {
    icon: "TR",
    title: "Track every unpaid hour",
    body: "See open balances, overdue reminders, and cash you can count on this week — without opening a spreadsheet.",
    radiusClass: "radius-system",
  },
  {
    icon: "TX",
    title: "Taxes without the scramble",
    body: "Export income summaries by quarter, tag deductible expenses, and hand your accountant a tidy year-end pack.",
    /* SEEDED: radius drift */
    radiusClass: "radius-stray",
  },
] as const;

export default function DemoPage() {
  const featureRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const nodes = featureRefs.current.filter(Boolean) as HTMLElement[];
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="ledgerly">
      <div className="wrap">
        <header className="ledgerly-nav">
          <a className="brand" href="/demo">
            Ledgerly
          </a>
          <nav className="nav-links" aria-label="Primary">
            <a href="#features">Product</a>
            <a href="#pricing">Pricing</a>
            <a href="#stories">Stories</a>
            <a className="btn" href="#pricing">
              Sign in
            </a>
          </nav>
        </header>

        <section className="ledgerly-hero" aria-labelledby="hero-heading">
          <div>
            <h1 id="hero-heading">Invoicing that keeps freelancers paid on time</h1>
            <p className="lede">
              Ledgerly turns estimates into invoices, invoices into deposits, and
              overdue balances into polite reminders — so you spend evenings on
              the work, not the chase.
            </p>
            <div className="cta-row">
              {/* SEEDED: INTENTIONAL — must stay different */}
              <a className="btn-cta-primary" href="#pricing">
                Start free — 14 days
              </a>
              <a className="btn" href="#features">
                See how it works
              </a>
            </div>
            <p className="fine">No card required. Cancel anytime.</p>
          </div>

          <div className="ledgerly-hero-visual" aria-hidden="true">
            <div className="ledgerly-invoice">
              <div className="inv-top">
                <span className="inv-brand">Ledgerly</span>
                <span>INV-1842 · Due Mar 12</span>
              </div>
              <div>Amount due</div>
              <div className="inv-amount">$2,480.00</div>
              <div className="inv-row">
                <span>Brand identity sprint</span>
                <span>$1,600</span>
              </div>
              <div className="inv-row">
                <span>Landing page polish</span>
                <span>$880</span>
              </div>
            </div>
          </div>
        </section>

        {/* SEEDED: spacing drift — 96px to features */}
        <section
          id="features"
          className="ledgerly-section ledgerly-features"
          aria-labelledby="features-heading"
        >
          <div className="section-head">
            <h2 id="features-heading">Built for solo operators who bill for time</h2>
            <p>
              From first draft to paid-in-full, Ledgerly keeps the money side of
              freelancing as calm as a finished invoice.
            </p>
          </div>

          <div className="ledgerly-feature-grid">
            {FEATURES.map((feature, index) => (
              <article
                key={feature.title}
                ref={(el) => {
                  featureRefs.current[index] = el;
                }}
                className={`ledgerly-card ledgerly-reveal ${feature.radiusClass}`}
              >
                <div className="icon" aria-hidden="true">
                  {feature.icon}
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* SEEDED: spacing drift — 96px to pricing */}
        <section
          id="pricing"
          className="ledgerly-section ledgerly-pricing"
          aria-labelledby="pricing-heading"
        >
          <div className="section-head">
            <h2 id="pricing-heading">Simple pricing that scales with your book</h2>
            <p>
              Start free while you land your next client. Upgrade when invoices
              become a weekly habit.
            </p>
          </div>

          <div className="ledgerly-price-grid">
            <div className="ledgerly-plan">
              <div className="plan-name">Starter</div>
              <div className="plan-price">
                $0 <span>/ month</span>
              </div>
              <ul>
                <li>Up to 5 invoices / month</li>
                <li>Payment links &amp; PDF export</li>
                <li>Email reminders</li>
              </ul>
              <a className="btn" href="#pricing">
                Create account
              </a>
            </div>

            <div className="ledgerly-plan featured">
              <div className="plan-name">Pro</div>
              <div className="plan-price">
                $19 <span>/ month</span>
              </div>
              <ul>
                <li>Unlimited invoices</li>
                <li>Recurring retainers</li>
                <li>Expense tagging &amp; tax packs</li>
              </ul>
              <a className="btn btn-solid" href="#pricing">
                Choose Pro
              </a>
            </div>

            <div className="ledgerly-plan">
              <div className="plan-name">Studio</div>
              <div className="plan-price">
                $49 <span>/ month</span>
              </div>
              <ul>
                <li>Up to 5 teammates</li>
                <li>Shared client ledger</li>
                <li>Priority support</li>
              </ul>
              <a className="btn" href="#pricing">
                Talk to us
              </a>
            </div>
          </div>
        </section>

        {/* SEEDED: spacing drift — 88px to testimonial */}
        <section
          id="stories"
          className="ledgerly-section ledgerly-testimonial"
          aria-labelledby="stories-heading"
        >
          <div className="section-head">
            <h2 id="stories-heading">Trusted by freelancers who got paid faster</h2>
            <p>
              Designers, writers, and consultants use Ledgerly to close the gap
              between delivered work and cleared funds.
            </p>
          </div>

          <figure className="ledgerly-quote">
            <blockquote>
              “I used to chase invoices on Sunday nights. With Ledgerly, clients
              pay from the link and I see the deposit before Monday standup.”
            </blockquote>
            <figcaption className="who">
              <strong>Maya Chen</strong>
              <span>Independent product designer · Portland</span>
            </figcaption>
          </figure>
        </section>

        {/* SEEDED: spacing drift — 96px to footer */}
        <footer className="ledgerly-footer">
          <div className="ledgerly-footer-inner">
            <div className="brand">Ledgerly</div>
            <nav aria-label="Footer">
              <a href="#features">Product</a>
              <a href="#pricing">Pricing</a>
              <a href="#stories">Stories</a>
            </nav>
            <div>© {new Date().getFullYear()} Ledgerly. Invoicing for freelancers.</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
