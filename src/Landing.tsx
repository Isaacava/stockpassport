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
        <button className="landing-nav-cta" onClick={onEnter}>View the portfolio <ArrowIcon /></button>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-kicker"><span /> SOLANA HACKATHON DEMO · DEVNET PORTFOLIO</div>
          <h1>A living passport for a <em>programmable portfolio.</em></h1>
          <p className="landing-lede">StockPassport brings market reference prices, on-chain demo holdings and portfolio rules into one beautifully inspectable record.</p>
          <div className="landing-actions">
            <button className="landing-primary" onClick={onEnter}>View the portfolio <ArrowIcon /></button>
            <a className="landing-secondary" href="#architecture">Explore the model <span>↓</span></a>
          </div>
          <div className="landing-proof-row">
            <div><strong>MAINNET</strong><span>Reference market data</span></div>
            <div><strong>DEVNET</strong><span>Demo assets & settlement</span></div>
            <div><strong>SUPABASE</strong><span>Portfolio records</span></div>
          </div>
        </div>

        <div className="landing-hero-art" aria-label="StockPassport portfolio preview">
          <div className="passport-window">
            <div className="passport-topline"><span>STOCKPASSPORT / PORTFOLIO</span><span className="passport-live"><i /> DEVNET</span></div>
            <div className="passport-heading">
              <div><span className="micro-label">PORTFOLIO VALUE</span><strong>$12,480.42</strong></div>
              <span className="record-chip">LIVE REFERENCE</span>
            </div>
            <div className="passport-chart">
              <div className="chart-grid"><i /><i /><i /><i /></div>
              <svg viewBox="0 0 560 170" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 144 C48 148, 64 128, 96 133 S144 110, 175 120 S221 84, 250 96 S300 74, 325 84 S365 52, 398 68 S448 54, 485 39 S524 48, 558 19" />
              </svg>
              <div className="chart-tag">+8.4% <span>portfolio snapshot</span></div>
            </div>
            <div className="passport-list">
              <div><span className="asset-avatar nvda">N</span><span><b>NVDAx</b><small>Mainnet reference</small></span><strong>$177.42</strong><em>25%</em></div>
              <div><span className="asset-avatar aapl">A</span><span><b>AAPLx</b><small>Mainnet reference</small></span><strong>$239.14</strong><em>22%</em></div>
              <div><span className="asset-avatar msft">M</span><span><b>MSFTx</b><small>Mainnet reference</small></span><strong>$505.81</strong><em>18%</em></div>
            </div>
            <div className="passport-footer"><span>Rules active <b>03</b></span><span>Market data <b>Jupiter / Mainnet</b></span><button onClick={onEnter}>Open portfolio <ArrowIcon /></button></div>
          </div>
          <div className="floating-card float-top"><span className="float-label">TARGET ALLOCATION</span><b>Single asset limit</b><strong>25% of portfolio</strong><span className="float-line" /></div>
          <div className="floating-card float-bottom"><span className="float-label">PORTFOLIO SIGNAL</span><b>Rebalance watch</b><strong>Allocation threshold reached</strong></div>
        </div>
      </section>

      <section className="landing-marquee" aria-label="Product principles">
        <span>Reference</span><b>•</b><span>Hold</span><b>•</b><span>Value</span><b>•</b><span>Rebalance</span><b>•</b><span>Record</span>
      </section>

      <section className="landing-story" id="how-it-works">
        <div className="story-intro"><span className="landing-kicker">THE IDEA</span><h2>Your portfolio should explain itself.</h2></div>
        <div className="story-body"><p>StockPassport is built around one clean separation: Mainnet provides market reference truth, Devnet provides the safe demo environment, and the passport keeps the resulting portfolio state easy to inspect.</p><p className="story-note">A synthetic Devnet asset can be valued against a live reference price without pretending the demo token is a real-world equity claim.</p></div>
      </section>

      <section className="landing-feature-grid" id="architecture">
        <article className="landing-feature feature-large">
          <div className="feature-index">01</div>
          <LineIcon>⌁</LineIcon>
          <div><span className="micro-label">MARKET REFERENCE</span><h3>Prices stay connected to reality.</h3><p>Reference values come from Mainnet market data rather than fixed demo numbers, so the portfolio can respond when the underlying reference moves.</p></div>
          <div className="feature-detail"><span>MAINNET</span><b>Jupiter Price API V3</b></div>
        </article>
        <article className="landing-feature">
          <div className="feature-index">02</div>
          <LineIcon>◫</LineIcon>
          <div><span className="micro-label">PORTFOLIO RULES</span><h3>Turn preferences into measurable guardrails.</h3><p>Asset limits, reserve targets and rebalance thresholds describe how the portfolio should behave.</p></div>
          <div className="mini-rule"><span>MAX ASSET</span><strong>25%</strong><span>RESERVE</span><strong>10%</strong></div>
        </article>
        <article className="landing-feature">
          <div className="feature-index">03</div>
          <LineIcon>◉</LineIcon>
          <div><span className="micro-label">ON-CHAIN STATE</span><h3>Holdings come from the wallet.</h3><p>The portfolio is valued from confirmed Devnet token accounts, so the demo never needs to invent a balance.</p></div>
          <div className="signature-strip"><span>OWNERSHIP SOURCE</span><b>SOLANA DEVNET</b></div>
        </article>
        <article className="landing-feature feature-wide" id="demo">
          <div className="feature-index">04</div>
          <LineIcon>↳</LineIcon>
          <div><span className="micro-label">PRICE-DRIVEN PORTFOLIO</span><h3>When the reference moves, the passport changes with it.</h3><p>A live Mainnet reference price can change the valuation of a synthetic Devnet holding, which can in turn surface an allocation issue or rebalance opportunity.</p></div>
          <div className="workflow-strip"><span>REFERENCE PRICE</span><i>→</i><span>PORTFOLIO VALUE</span><i>→</i><span>RULE CHECK</span><i>→</i><span>DEMO TRADE</span></div>
        </article>
      </section>

      <section className="landing-architecture">
        <div className="architecture-copy"><span className="landing-kicker">ONE PRODUCT. THREE LAYERS.</span><h2>A clean line between market truth, demo ownership and portfolio memory.</h2><p>The architecture deliberately keeps those responsibilities separate, so the demo can show a credible tokenized-stock workflow without confusing synthetic assets with real equity.</p></div>
        <div className="architecture-map">
          <div className="arch-node arch-mainnet"><span>01</span><b>Solana Mainnet</b><small>Live reference prices</small></div>
          <div className="arch-line line-main" />
          <div className="arch-node arch-engine"><span>02</span><b>StockPassport</b><small>Valuation · rules · portfolio view</small></div>
          <div className="arch-line line-dev" />
          <div className="arch-node arch-devnet"><span>03</span><b>Solana Devnet</b><small>Synthetic assets · balances · settlement</small></div>
          <div className="arch-meta"><span>SUPABASE</span><b>Portfolio configuration, activity and historical records</b></div>
        </div>
      </section>

      <section className="landing-final">
        <div><span className="landing-kicker">READY TO SEE YOUR PORTFOLIO?</span><h2>Open the passport.</h2><p>Move from the model into a working Solana Devnet portfolio.</p></div>
        <button className="landing-final-button" onClick={onEnter}>Open portfolio <ArrowIcon /></button>
      </section>

      <footer className="landing-footer"><div className="landing-brand"><span className="landing-brand-mark">SP</span><span>StockPassport</span></div><span>Solana Devnet demo · Mainnet reference data · Synthetic assets</span><button onClick={onEnter}>Portfolio <ArrowIcon /></button></footer>
    </main>
  );
}
