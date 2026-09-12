import type { ReactNode } from 'react';
import { connectBrowserWallet } from './lib/wallet';

type LandingProps = { onEnter: (wallet: string) => void };

function ArrowIcon() { return <span aria-hidden="true" className="landing-arrow">↗</span>; }
function LineIcon({ children }: { children: ReactNode }) { return <span aria-hidden="true" className="landing-icon">{children}</span>; }

export default function Landing({ onEnter }: LandingProps) {
  const signIn = async () => {
    try {
      const signer = await connectBrowserWallet();
      const address = signer.publicKey.toBase58();
      if (!signer.signMessage) throw new Error('This wallet does not support message signing.');
      const statement = `StockPassport sign in\nWallet: ${address}\nNetwork: Solana Devnet\nPurpose: Open portfolio account`;
      await signer.signMessage(new TextEncoder().encode(statement));
      sessionStorage.setItem('stockpassport.wallet', address);
      onEnter(address);
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'Wallet sign-in failed.');
    }
  };

  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Primary">
        <button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><span className="landing-brand-mark">SP</span><span>StockPassport</span></button>
        <div className="landing-nav-links"><a href="#how-it-works">How it works</a><a href="#architecture">Architecture</a><a href="#demo">Demo</a></div>
        <button className="landing-nav-cta" onClick={signIn}>Sign in with wallet <ArrowIcon /></button>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-kicker"><span /> SOLANA HACKATHON DEMO · DEVNET PORTFOLIO</div>
          <h1>Your portfolio, with a <em>memory of the market.</em></h1>
          <p className="landing-lede">StockPassport keeps a live view of your Devnet portfolio, values it against current market references, and records how your holdings change over time.</p>
          <div className="landing-actions"><button className="landing-primary" onClick={signIn}>Sign in with wallet <ArrowIcon /></button><a className="landing-secondary" href="#architecture">Explore the model <span>↓</span></a></div>
          <div className="landing-proof-row"><div><strong>MAINNET</strong><span>Market reference data</span></div><div><strong>DEVNET</strong><span>Your demo holdings</span></div><div><strong>PASSPORT</strong><span>Portfolio history</span></div></div>
        </div>

        <div className="landing-hero-art" aria-label="StockPassport portfolio preview">
          <div className="passport-window">
            <div className="passport-topline"><span>STOCKPASSPORT / PORTFOLIO</span><span className="passport-live"><i /> DEVNET</span></div>
            <div className="passport-heading"><div><span className="micro-label">PORTFOLIO VALUE</span><strong>$12,480.42</strong></div><span className="record-chip">LIVE REFERENCE</span></div>
            <div className="passport-chart"><div className="chart-grid"><i /><i /><i /><i /></div><svg viewBox="0 0 560 170" preserveAspectRatio="none" aria-hidden="true"><path d="M2 144 C48 148, 64 128, 96 133 S144 110, 175 120 S221 84, 250 96 S300 74, 325 84 S365 52, 398 68 S448 54, 485 39 S524 48, 558 19" /></svg><div className="chart-tag">+8.4% <span>portfolio snapshot</span></div></div>
            <div className="passport-list"><div><span className="asset-avatar nvda">N</span><span><b>NVDAx</b><small>Mainnet reference</small></span><strong>$177.42</strong><em>25%</em></div><div><span className="asset-avatar aapl">A</span><span><b>AAPLx</b><small>Mainnet reference</small></span><strong>$239.14</strong><em>22%</em></div><div><span className="asset-avatar msft">M</span><span><b>MSFTx</b><small>Mainnet reference</small></span><strong>$505.81</strong><em>18%</em></div></div>
            <div className="passport-footer"><span>Rules active <b>03</b></span><span>Market data <b>Jupiter / Mainnet</b></span><button onClick={signIn}>Open portfolio <ArrowIcon /></button></div>
          </div>
          <div className="floating-card float-top"><span className="float-label">PORTFOLIO VIEW</span><b>Allocation</b><strong>25% / NVDAx</strong><span className="float-line" /></div>
          <div className="floating-card float-bottom"><span className="float-label">MARKET SIGNAL</span><b>Reference moved</b><strong>Portfolio value recalculated</strong></div>
        </div>
      </section>

      <section className="landing-marquee" aria-label="Product principles"><span>Reference</span><b>•</b><span>Holdings</span><b>•</b><span>Value</span><b>•</b><span>History</span><b>•</b><span>Portfolio</span></section>
      <section className="landing-story" id="how-it-works"><div className="story-intro"><span className="landing-kicker">THE IDEA</span><h2>A portfolio should feel like a living record, not a workflow diagram.</h2></div><div className="story-body"><p>StockPassport is centered on the portfolio itself. The wallet is the account. The chain supplies the holdings. Mainnet supplies the reference market. The passport keeps the resulting picture coherent and inspectable.</p><p className="story-note">Synthetic Devnet assets are deliberately separated from real-world equity claims.</p></div></section>

      <section className="landing-feature-grid" id="architecture">
        <article className="landing-feature feature-large"><div className="feature-index">01</div><LineIcon>⌁</LineIcon><div><span className="micro-label">MARKET REFERENCE</span><h3>See what your holdings are worth now.</h3><p>Current Mainnet reference values are used to value your synthetic Devnet positions instead of fixed demo prices.</p></div><div className="feature-detail"><span>PRICE SOURCE</span><b>Jupiter · Mainnet</b></div></article>
        <article className="landing-feature"><div className="feature-index">02</div><LineIcon>◫</LineIcon><div><span className="micro-label">PORTFOLIO RULES</span><h3>Describe the portfolio you want.</h3><p>Allocation targets, reserve preferences and thresholds become part of your portfolio record.</p></div><div className="mini-rule"><span>MAX ASSET</span><strong>25%</strong><span>RESERVE</span><strong>10%</strong></div></article>
        <article className="landing-feature"><div className="feature-index">03</div><LineIcon>◉</LineIcon><div><span className="micro-label">WALLET ACCOUNT</span><h3>Your wallet is your account.</h3><p>Sign in with the same Solana wallet that owns the Devnet holdings and signs portfolio actions.</p></div><div className="signature-strip"><span>ACCOUNT ID</span><b>WALLET ADDRESS</b></div></article>
        <article className="landing-feature feature-wide" id="demo"><div className="feature-index">04</div><LineIcon>↳</LineIcon><div><span className="micro-label">PRICE-DRIVEN PORTFOLIO</span><h3>When the market reference moves, your portfolio view changes with it.</h3><p>A new reference price changes valuation, which can change allocation percentages and highlight opportunities in the portfolio.</p></div><div className="workflow-strip"><span>REFERENCE PRICE</span><i>→</i><span>VALUATION</span><i>→</i><span>ALLOCATION</span><i>→</i><span>PORTFOLIO HISTORY</span></div></article>
      </section>

      <section className="landing-architecture"><div className="architecture-copy"><span className="landing-kicker">THREE DISTINCT SOURCES</span><h2>Market data, wallet ownership and portfolio records stay easy to tell apart.</h2><p>The design follows the product itself: value comes from the market reference, ownership comes from the wallet, and the passport keeps the portfolio record.</p></div><div className="architecture-map"><div className="arch-node arch-mainnet"><span>01</span><b>Solana Mainnet</b><small>Reference prices</small></div><div className="arch-line line-main" /><div className="arch-node arch-engine"><span>02</span><b>StockPassport</b><small>Valuation · rules · history</small></div><div className="arch-line line-dev" /><div className="arch-node arch-devnet"><span>03</span><b>Solana Devnet</b><small>Wallet holdings · demo settlement</small></div><div className="arch-meta"><span>WALLET</span><b>Your address is the account identity and signing authority</b></div></div></section>

      <section className="landing-final"><div><span className="landing-kicker">YOUR PORTFOLIO STARTS WITH YOUR WALLET</span><h2>Sign in. See your holdings.</h2><p>No separate account to create. Your Solana wallet is the account.</p></div><button className="landing-final-button" onClick={signIn}>Sign in with wallet <ArrowIcon /></button></section>
      <footer className="landing-footer"><div className="landing-brand"><span className="landing-brand-mark">SP</span><span>StockPassport</span></div><span>Solana Devnet demo · Mainnet reference data · Synthetic assets</span><button onClick={signIn}>Sign in <ArrowIcon /></button></footer>
    </main>
  );
}
