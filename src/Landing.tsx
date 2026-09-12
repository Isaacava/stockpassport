import type { ReactNode } from 'react';

type LandingProps = {
  onEnter: () => void;
};

function ArrowIcon() {
  return <span aria-hidden="true" className="landing-arrow">↗</span>;
}

function LineIcon({ children }: { children: ReactNode }) {
  return <span aria-hidden="true" className="landing-icon">{children}</span>;
}

export default function Landing({ onEnter }: LandingProps) {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Primary">
        <button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="landing-brand-mark">SP</span>
          <span>StockPassport</span>
        </button>
        <div className="landing-nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#architecture">Architecture</a>
          <a href="#demo">Demo</a>
        </div>
        <button className="landing-nav-cta" onClick={onEnter}>Open workspace <ArrowIcon /></button>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-kicker"><span /> SOLANA HACKATHON DEMO · DEVNET EXECUTION</div>
          <h1>Make a portfolio <em>programmable.</em></h1>
          <p className="landing-lede">StockPassport connects live market reference data, on-chain demo assets and explicit portfolio rules into one verifiable workflow.</p>
          <div className="landing-actions">
            <button className="landing-primary" onClick={onEnter}>Enter StockPassport <ArrowIcon /></button>
            <a className="landing-secondary" href="#architecture">See the architecture <span>↓</span></a>
          </div>
          <div className="landing-proof-row">
            <div><strong>MAINNET</strong><span>Price reference</span></div>
            <div><strong>DEVNET</strong><span>Execution & ownership</span></div>
            <div><strong>SUPABASE</strong><span>Rules & audit metadata</span></div>
          </div>
        </div>

        <div className="landing-hero-art" aria-label="StockPassport product preview">
          <div className="passport-window">
            <div className="passport-topline"><span>STOCKPASSPORT / LIVE RECORD</span><span className="passport-live"><i /> DEVNET</span></div>
            <div className="passport-heading">
              <div><span className="micro-label">PORTFOLIO VALUE</span><strong>$12,480.42</strong></div>
              <span className="record-chip">VERIFIED STATE</span>
            </div>
            <div className="passport-chart">
              <div className="chart-grid"><i /><i /><i /><i /></div>
              <svg viewBox="0 0 560 170" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 144 C48 148, 64 128, 96 133 S144 110, 175 120 S221 84, 250 96 S300 74, 325 84 S365 52, 398 68 S448 54, 485 39 S524 48, 558 19" />
              </svg>
              <div className="chart-tag">+8.4% <span>demo state</span></div>
            </div>
            <div className="passport-list">
              <div><span className="asset-avatar nvda">N</span><span><b>NVDAx</b><small>Mainnet reference</small></span><strong>$177.42</strong><em>25%</em></div>
              <div><span className="asset-avatar aapl">A</span><span><b>AAPLx</b><small>Mainnet reference</small></span><strong>$239.14</strong><em>22%</em></div>
              <div><span className="asset-avatar msft">M</span><span><b>MSFTx</b><small>Mainnet reference</small></span><strong>$505.81</strong><em>18%</em></div>
            </div>
            <div className="passport-footer"><span>Rules checked <b>03</b></span><span>Reference source <b>Jupiter / Mainnet</b></span><button onClick={onEnter}>Open record <ArrowIcon /></button></div>
          </div>
          <div className="floating-card float-top"><span className="float-label">RULE ENGINE</span><b>Target allocation</b><strong>25% max / asset</strong><span className="float-line" /></div>
          <div className="floating-card float-bottom"><span className="float-label">AUTHORIZATION</span><b>Wallet-signed</b><strong>Every execution is explicit</strong></div>
        </div>
      </section>

      <section className="landing-marquee" aria-label="Product principles">
        <span>Observe</span><b>•</b><span>Evaluate</span><b>•</b><span>Authorize</span><b>•</b><span>Settle</span><b>•</b><span>Verify</span>
      </section>

      <section className="landing-story" id="how-it-works">
        <div className="story-intro"><span className="landing-kicker">THE IDEA</span><h2>Portfolio automation without hidden behavior.</h2></div>
        <div className="story-body"><p>StockPassport treats a portfolio as a living, inspectable record—not a black box. The chain owns the balances. The market supplies reference prices. Your rules create proposals. Your wallet gives the final authorization.</p><p className="story-note">The demo is intentionally split: real market data on Solana Mainnet; all demo ownership and settlement on Solana Devnet.</p></div>
      </section>

      <section className="landing-feature-grid" id="architecture">
        <article className="landing-feature feature-large">
          <div className="feature-index">01</div>
          <LineIcon>⌁</LineIcon>
          <div><span className="micro-label">MARKET REFERENCE</span><h3>Prices stay tied to the source.</h3><p>Reference values come from Mainnet market data instead of invented demo numbers, while execution stays safely isolated on Devnet.</p></div>
          <div className="feature-detail"><span>MAINNET</span><b>Jupiter Price API V3</b></div>
        </article>
        <article className="landing-feature">
          <div className="feature-index">02</div>
          <LineIcon>◫</LineIcon>
          <div><span className="micro-label">RULES</span><h3>Turn intent into proposals.</h3><p>Allocation limits, cash reserves and thresholds become visible, persistent actions.</p></div>
          <div className="mini-rule"><span>MAX ASSET</span><strong>25%</strong><span>RESERVE</span><strong>10%</strong></div>
        </article>
        <article className="landing-feature">
          <div className="feature-index">03</div>
          <LineIcon>◉</LineIcon>
          <div><span className="micro-label">AUTHORIZATION</span><h3>Your wallet remains the gate.</h3><p>No silent movement of funds. A proposed action has to cross an explicit wallet signature boundary.</p></div>
          <div className="signature-strip"><span>WALLET SIGNATURE</span><b>ED25519</b></div>
        </article>
        <article className="landing-feature feature-wide" id="demo">
          <div className="feature-index">04</div>
          <LineIcon>↳</LineIcon>
          <div><span className="micro-label">VERIFIABLE DEMO</span><h3>From rule evaluation to on-chain settlement.</h3><p>Every demo trade produces a real Devnet transaction and leaves a persistent activity trail, so the workflow can be inspected rather than merely described.</p></div>
          <div className="workflow-strip"><span>CHAIN STATE</span><i>→</i><span>RULE PROPOSAL</span><i>→</i><span>WALLET SIGN</span><i>→</i><span>DEVNET SETTLE</span></div>
        </article>
      </section>

      <section className="landing-architecture">
        <div className="architecture-copy"><span className="landing-kicker">ONE PRODUCT. THREE SOURCES OF TRUTH.</span><h2>A cleaner separation between what is real, what is demo, and what is recorded.</h2><p>That separation is the point. The demo can show a credible financial workflow without pretending a synthetic Devnet token is a real equity claim.</p></div>
        <div className="architecture-map">
          <div className="arch-node arch-mainnet"><span>01</span><b>Solana Mainnet</b><small>Reference prices</small></div>
          <div className="arch-line line-main" />
          <div className="arch-node arch-engine"><span>02</span><b>StockPassport</b><small>Rules · proposals · authorization</small></div>
          <div className="arch-line line-dev" />
          <div className="arch-node arch-devnet"><span>03</span><b>Solana Devnet</b><small>Demo assets · balances · settlement</small></div>
          <div className="arch-meta"><span>SUPABASE</span><b>Portfolio records, lifecycle, audit metadata</b></div>
        </div>
      </section>

      <section className="landing-final">
        <div><span className="landing-kicker">READY TO INSPECT THE SYSTEM?</span><h2>Open the passport.</h2><p>Move from the story into a working Solana Devnet workspace.</p></div>
        <button className="landing-final-button" onClick={onEnter}>Open workspace <ArrowIcon /></button>
      </section>

      <footer className="landing-footer"><div className="landing-brand"><span className="landing-brand-mark">SP</span><span>StockPassport</span></div><span>Solana Devnet demo · Mainnet reference data · Synthetic assets</span><button onClick={onEnter}>Workspace <ArrowIcon /></button></footer>
    </main>
  );
}
