import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { DEVNET_ASSETS, DEVNET_CASH_MINT, DEVNET_CASH_SYMBOL } from './config/assets';
import { CONNECTION, explorerAddressUrl, explorerTxUrl } from './config/network';
import { getDevnetTokenHoldings, type TokenHolding } from './lib/tokens';
import { connectBrowserWallet, disconnectBrowserWallet, getConnectedWalletAddress, getConnectedWalletSigner } from './lib/wallet';
import { executeDevnetTrade, getDevnetQuote, type DevnetQuote, type TradeSide } from './lib/execution';
import { DEFAULT_PORTFOLIO_RULES, evaluatePortfolio, type PortfolioRules } from './lib/rules';
import { fetchMainnetReferencePrices, type MainnetReferencePrice } from './lib/mainnet-prices';
import { apiUrl, fetchJson } from './lib/api';
import { loadPortfolioData, recordActivity, recordTradeIntent, savePortfolio, saveRule, type PersistedActivity, type PersistedPortfolio, type PersistedRule } from './lib/data';

const NAV = ['Portfolio', 'Markets', 'Rules', 'History', 'Passport'] as const;
type Tab = typeof NAV[number];
type Trade = { side: TradeSide; symbol: string; status: string; settlement?: string; createdAt: string };

const short = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

type IconName = 'portfolio' | 'markets' | 'rules' | 'history' | 'passport' | 'wallet' | 'refresh' | 'external' | 'logout' | 'chevron' | 'cash' | 'chart' | 'shield';

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  const paths: Record<IconName, JSX.Element> = {
    portfolio: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8 4.5V3h8v1.5" /><path d="M7 10h10M7 14h6" /></>,
    markets: <><path d="M4 18V9M10 18V5M16 18v-3M22 18H2" /><path d="M5 8l5-3 6 4 5-5" /></>,
    rules: <><path d="M5 5h14M5 12h14M5 19h14" /><circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="11" cy="19" r="1.5" /></>,
    history: <><path d="M4 6h16v14H4z" /><path d="M8 4v4M16 4v4M4 10h16" /><path d="M8 14h3M13 14h3M8 17h5" /></>,
    passport: <><rect x="4" y="3" width="16" height="18" rx="3" /><circle cx="12" cy="9" r="3" /><path d="M8 17h8" /></>,
    wallet: <><path d="M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11" /><path d="M17 13h3" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.8-3.8L3 9" /><path d="M3 4v5h5" /><path d="M4 13a8 8 0 0 0 14.8 3.8L21 15" /><path d="M21 20v-5h-5" /></>,
    external: <><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" /></>,
    logout: <><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" /><path d="M14 8l4 4-4 4" /><path d="M18 12H8" /></>,
    chevron: <><path d="M7 10l5 5 5-5" /></>,
    cash: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M7 9h.01M17 15h.01" /></>,
    chart: <><path d="M4 19V5M4 19h16" /><path d="M7 15l3-4 3 2 5-7" /></>,
    shield: <><path d="M12 3l7 3v5c0 4.2-2.8 7.8-7 10-4.2-2.2-7-5.8-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function navIcon(tab: Tab): IconName {
  return tab.toLowerCase() as IconName;
}

export default function PortfolioApp() {
  const [active, setActive] = useState<Tab>('Portfolio');
  const [wallet, setWallet] = useState<string | null>(null);
  const [sol, setSol] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [prices, setPrices] = useState<Record<string, MainnetReferencePrice>>({});
  const [portfolio, setPortfolio] = useState<PersistedPortfolio | null>(null);
  const [rules, setRules] = useState<PersistedRule[]>([]);
  const [activities, setActivities] = useState<PersistedActivity[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [network, setNetwork] = useState<'online' | 'offline' | 'checking'>('checking');
  const [busy, setBusy] = useState(false);
  const [funding, setFunding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [assetId, setAssetId] = useState(DEVNET_ASSETS[0]?.id ?? '');
  const [side, setSide] = useState<TradeSide>('buy');
  const [amount, setAmount] = useState('1');
  const [quote, setQuote] = useState<DevnetQuote | null>(null);
  const [form, setForm] = useState({ max: 25, reserve: 10, threshold: 5 });
  const [portfolioName, setPortfolioName] = useState('My Portfolio');
  const [portfolioDescription, setPortfolioDescription] = useState('');

  const loadChain = useCallback(async (address: string) => {
    const key = new PublicKey(address);
    const [lamports, tokenHoldings] = await Promise.all([
      CONNECTION.getBalance(key, 'confirmed'),
      getDevnetTokenHoldings(address),
    ]);
    setSol(lamports / 1e9);
    setHoldings(tokenHoldings);
  }, []);

  const loadPrices = useCallback(async () => {
    const refs = await fetchMainnetReferencePrices();
    setPrices(Object.fromEntries(refs.map((item) => [item.assetId, item])));
  }, []);

  const loadData = useCallback(async (address: string) => {
    const data = await loadPortfolioData(address);
    setPortfolio(data.portfolio);
    setPortfolioName(data.portfolio.name);
    setPortfolioDescription(data.portfolio.description ?? '');
    setRules(data.rules);
    setActivities(data.activities);
    setTrades(data.trades.map((item) => ({
      side: item.side,
      symbol: DEVNET_ASSETS.find((a) => a.id === item.asset_id)?.referenceSymbol ?? item.asset_id,
      status: item.status,
      settlement: item.settlement_signature ?? undefined,
      createdAt: item.created_at,
    })));
    const valueOf = (type: string, fallback: number) => Number(data.rules.find((rule) => rule.rule_type === type)?.parameters.value ?? fallback);
    setForm({
      max: valueOf('max_allocation', 25),
      reserve: valueOf('min_cash_reserve', 10),
      threshold: valueOf('rebalance_threshold', 5),
    });
  }, []);

  useEffect(() => {
    CONNECTION.getEpochInfo().then(() => setNetwork('online')).catch(() => setNetwork('offline'));
    const connected = getConnectedWalletAddress() ?? sessionStorage.getItem('stockpassport.wallet');
    if (connected) setWallet(connected);
    void loadPrices().catch((cause) => setError(cause instanceof Error ? `Market data unavailable: ${cause.message}` : 'Market data unavailable.'));
    const timer = window.setInterval(() => {
      void loadPrices().catch((cause) => setError(cause instanceof Error ? `Market data unavailable: ${cause.message}` : 'Market data unavailable.'));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [loadPrices]);

  useEffect(() => {
    if (!wallet) return;
    void Promise.all([loadChain(wallet), loadData(wallet)]).catch((cause) => {
      setError(cause instanceof Error ? `Portfolio service unavailable: ${cause.message}` : 'Portfolio service unavailable.');
    });
  }, [wallet, loadChain, loadData]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const cash = Number(holdings.find((item) => item.mint === DEVNET_CASH_MINT)?.amount ?? 0);
  const positions = useMemo(() => holdings.filter((item) => item.assetId).flatMap((item) => {
    const asset = DEVNET_ASSETS.find((a) => a.id === item.assetId);
    const price = asset ? prices[asset.id]?.priceUsd : undefined;
    if (!asset || !price || price <= 0) return [];
    return [{ assetId: asset.id, symbol: asset.symbol, amount: Number(item.amount), valueUsd: Number(item.amount) * price }];
  }), [holdings, prices]);

  const total = cash + positions.reduce((sum, item) => sum + item.valueUsd, 0);
  const rulesConfig: PortfolioRules = useMemo(() => ({
    ...DEFAULT_PORTFOLIO_RULES,
    maxSingleAssetPct: form.max,
    minReservePct: form.reserve,
    rebalanceThresholdPct: form.threshold,
  }), [form]);
  const evaluation = useMemo(() => evaluatePortfolio(
    positions.map((item) => ({ assetId: item.assetId, symbol: item.symbol, valueUsd: item.valueUsd })),
    cash,
    rulesConfig,
  ), [positions, cash, rulesConfig]);

  const selected = DEVNET_ASSETS.find((item) => item.id === assetId) ?? DEVNET_ASSETS[0];
  const selectedPrice = prices[selected.id]?.priceUsd;

  const refresh = async () => {
    if (!wallet) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all([loadChain(wallet), loadData(wallet), loadPrices()]);
      setMessage('Portfolio refreshed from Devnet state and current Mainnet references.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Refresh failed.');
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const signer = await connectBrowserWallet();
      const address = signer.publicKey.toBase58();
      await signer.signMessage(new TextEncoder().encode([
        'StockPassport sign in',
        `Wallet: ${address}`,
        'Network: Solana Devnet',
        'Purpose: Portfolio account access',
      ].join('\n')));
      sessionStorage.setItem('stockpassport.wallet', address);
      setWallet(address);
      setMessage('Wallet signed in.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Wallet sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await disconnectBrowserWallet();
    sessionStorage.removeItem('stockpassport.wallet');
    setWallet(null);
    setHoldings([]);
    setPortfolio(null);
    setRules([]);
    setActivities([]);
    setTrades([]);
    setQuote(null);
    setMessage('Wallet disconnected.');
    setMenuOpen(false);
  };

  const fund = async () => {
    if (!wallet) return setError('Sign in with your wallet first.');
    setFunding(true);
    setError(null);
    try {
      const result = await fetchJson<{ signature: string }>("/api/devnet/faucet", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      });
      if (!result.signature) throw new Error('The demo faucet did not return a transaction signature.');
      await Promise.all([loadChain(wallet), loadData(wallet)]);
      setMessage(`1,000 ${DEVNET_CASH_SYMBOL} added on Devnet.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Funding failed.');
    } finally {
      setFunding(false);
    }
  };

  const getQuote = async () => {
    if (!wallet) return setError('Sign in with your wallet first.');
    const quantity = Number(amount);
    if (!Number.isFinite(quantity) || quantity <= 0) return setError('Enter a valid quantity.');
    setError(null);
    try {
      const nextQuote = await getDevnetQuote(assetId, side, quantity);
      setQuote(nextQuote);
    } catch (cause) {
      setQuote(null);
      setError(cause instanceof Error ? cause.message : 'Unable to price this order.');
    }
  };

  const executeTrade = async () => {
    if (!wallet || !quote) return setError('Sign in and request a fresh quote first.');
    setBusy(true);
    setError(null);
    try {
      const signer = getConnectedWalletSigner();
      if (signer.publicKey.toBase58() !== wallet) throw new Error('The connected wallet changed. Sign in again.');
      const result = await executeDevnetTrade(quote, signer);
      await recordTradeIntent(wallet, {
        quoteId: quote.quoteId,
        assetId: quote.assetId,
        side: quote.side,
        assetAmountUnits: quote.assetAmountUnits,
        cashAmountUnits: quote.cashAmountUnits,
        status: 'settled',
        paymentSignature: result.paymentSignature,
        settlementSignature: result.settlementSignature,
      });
      await recordActivity(wallet, {
        eventType: `portfolio_trade_${quote.side}`,
        signature: result.settlementSignature,
        payload: {
          assetId: quote.assetId,
          referencePriceUsd: quote.referencePriceUsd,
          executionPriceUsd: quote.executionPriceUsd,
          referenceObservedAt: quote.referenceObservedAt,
          referenceNetwork: quote.referenceNetwork,
        },
      });
      await Promise.all([loadChain(wallet), loadData(wallet), loadPrices()]);
      setQuote(null);
      setMessage(`${quote.side === 'buy' ? 'Buy' : 'Sell'} confirmed on Devnet.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Trade failed.');
    } finally {
      setBusy(false);
    }
  };

  const savePreferences = async () => {
    if (!wallet || !portfolio) return setError('Portfolio storage is not ready yet. Refresh after the portfolio service is available.');
    setBusy(true);
    setError(null);
    try {
      const saved: PersistedRule[] = [];
      for (const [ruleType, value] of [
        ['max_allocation', form.max],
        ['min_cash_reserve', form.reserve],
        ['rebalance_threshold', form.threshold],
      ] as const) {
        saved.push(await saveRule(wallet, {
          portfolioId: portfolio.id,
          ruleType,
          enabled: true,
          parameters: { value },
        }));
      }
      setRules(saved);
      setMessage('Portfolio preferences saved with a wallet signature.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save preferences.');
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    if (!wallet) return setError('Sign in with your wallet first.');
    setBusy(true);
    setError(null);
    try {
      const saved = await savePortfolio(wallet, { id: portfolio?.id, name: portfolioName, description: portfolioDescription });
      setPortfolio(saved);
      setMessage('Portfolio profile saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save profile.');
    } finally {
      setBusy(false);
    }
  };

  const navTo = (tab: Tab) => {
    setActive(tab);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const portfolioView = (
    <div className="grid portfolio-overview">
      <div className="hero-card">
        <div>
          <div className="eyebrow">YOUR PORTFOLIO · DEVNET</div>
          <div className="hero-number">${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <p>Value of this wallet's synthetic holdings using current Mainnet reference prices.</p>
        </div>
        <button className="secondary-button dark-secondary" onClick={refresh} disabled={busy}>
          <Icon name="refresh" size={14} /> {busy ? 'Refreshing…' : 'Refresh portfolio'}
        </button>
      </div>

      <div className="metrics">
        <div className="metric"><span>AVAILABLE CASH</span><strong>{cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><small>{DEVNET_CASH_SYMBOL} · Devnet</small></div>
        <div className="metric"><span>POSITIONS</span><strong>{positions.length}</strong><small>Assets held by this wallet</small></div>
        <div className="metric"><span>REFERENCES</span><strong>{Object.keys(prices).length}</strong><small>Mainnet market prices</small></div>
        <div className="metric"><span>DEVNET SOL</span><strong>{sol === null ? '—' : sol.toFixed(4)}</strong><small>Network balance</small></div>
      </div>

      <div className="overview-grid">
        <div className="panel portfolio-list-panel">
          <div className="panel-head"><div><div className="eyebrow">HOLDINGS</div><h2>Your positions</h2></div><span className="small-badge">{positions.length} assets</span></div>
          {positions.length === 0 ? (
            <div className="empty-state">
              <strong>Your portfolio is empty</strong>
              <span>Add demo cash, then choose an asset from Markets.</span>
              <button className="secondary-button" onClick={fund} disabled={funding || !wallet}>{funding ? 'Funding…' : 'Add demo cash'}</button>
            </div>
          ) : positions.map((item) => (
            <div className="holding-card" key={item.assetId}>
              <div className="holding-icon">{item.symbol.slice(0, 1)}</div>
              <div className="holding-main"><strong>{item.symbol}</strong><span>{item.amount.toLocaleString()} units</span></div>
              <div className="holding-value"><strong>${item.valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span>{total ? (item.valueUsd / total * 100).toFixed(1) : '0.0'}% · reference</span></div>
            </div>
          ))}
        </div>

        <div className="panel market-panel">
          <div className="panel-head"><div><div className="eyebrow">MARKET WINDOW</div><h2>Reference prices</h2></div><span className={`market-status ${network}`}>{network === 'online' ? 'DEVNET READY' : network === 'offline' ? 'OFFLINE' : 'CHECKING'}</span></div>
          {DEVNET_ASSETS.map((asset) => {
            const ref = prices[asset.id];
            return <button className="reference-row" key={asset.id} onClick={() => { setAssetId(asset.id); setActive('Markets'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><span className="ref-symbol">{asset.referenceSymbol}</span><span className="ref-name">{asset.symbol}</span><strong>{ref ? `$${ref.priceUsd.toFixed(2)}` : '—'}</strong></button>;
          })}
          <div className="market-note">Live reference · demo ownership stays on Devnet</div>
        </div>
      </div>

      <div className="panel portfolio-note-card"><div><div className="eyebrow">ACCOUNT</div><h2>{wallet ? short(wallet) : 'Wallet not connected'}</h2><p>{wallet ? 'Your Solana wallet is the account identity for this portfolio.' : 'Connect a wallet to see balances and history.'}</p></div><button className="primary-button" onClick={wallet ? refresh : signIn} disabled={busy}>{wallet ? 'Refresh data' : 'Sign in with wallet'}</button></div>
    </div>
  );

  const marketsView = (
    <div className="grid">
      <div className="panel">
        <div className="eyebrow">MARKETS</div><h2>Synthetic assets</h2><p>Demo-only assets on Solana Devnet, valued using current Mainnet references.</p>
        <div className="asset-grid">
          {DEVNET_ASSETS.map((asset) => <button key={asset.id} className={assetId === asset.id ? 'asset-card selected' : 'asset-card'} onClick={() => { setAssetId(asset.id); setQuote(null); }}><span>{asset.referenceSymbol}</span><strong>{asset.symbol}</strong><small>{prices[asset.id] ? `$${prices[asset.id].priceUsd.toFixed(2)} reference` : 'Price unavailable'}</small></button>)}
        </div>
      </div>
      <div className="panel trade-panel">
        <div className="trade-head"><div><div className="eyebrow">ADD TO PORTFOLIO</div><h2>{selected.symbol}</h2><small>{selectedPrice ? `$${selectedPrice.toFixed(2)} Mainnet reference` : 'Reference unavailable'}</small></div><div className="side-toggle"><button className={side === 'buy' ? 'selected-side' : ''} onClick={() => { setSide('buy'); setQuote(null); }}>Buy</button><button className={side === 'sell' ? 'selected-side' : ''} onClick={() => { setSide('sell'); setQuote(null); }}>Sell</button></div></div>
        <label>Quantity<input value={amount} inputMode="decimal" onChange={(event) => { setAmount(event.target.value); setQuote(null); }} /></label>
        {quote && <div className="quote-box"><div><span>Reference</span><strong>${quote.referencePriceUsd.toFixed(2)}</strong></div><div><span>Devnet price</span><strong>${quote.executionPriceUsd.toFixed(2)}</strong></div><div><span>{quote.side === 'buy' ? 'Cost' : 'Return'}</span><strong>{quote.cashAmount.toFixed(2)} DEMO-USDC</strong></div><div><span>Network</span><strong>Devnet</strong></div></div>}
        <div className="trade-actions"><button className="secondary-button" onClick={getQuote} disabled={busy || !wallet}>Price it</button><button className="primary-button" onClick={executeTrade} disabled={!quote || busy}>{busy ? 'Confirming…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${selected.referenceSymbol}`}</button></div>
      </div>
    </div>
  );

  const rulesView = (
    <div className="grid">
      <div className="panel"><div className="eyebrow">PORTFOLIO PREFERENCES</div><h2>How should it behave?</h2><p>Saving preferences uses a signature from your connected wallet.</p>
        <label>Maximum single asset %<input type="number" min="1" max="100" value={form.max} onChange={(e) => setForm({ ...form, max: Number(e.target.value) })} /></label>
        <label>Minimum cash reserve %<input type="number" min="0" max="100" value={form.reserve} onChange={(e) => setForm({ ...form, reserve: Number(e.target.value) })} /></label>
        <label>Rebalance threshold %<input type="number" min="0.1" max="50" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} /></label>
        <button className="primary-button" onClick={savePreferences} disabled={busy || !wallet || !portfolio}>{busy ? 'Saving…' : 'Save preferences'}</button>
      </div>
      <div className="panel"><div className="eyebrow">CURRENT PORTFOLIO</div><h2>{evaluation.violations.length ? `${evaluation.violations.length} allocation issue${evaluation.violations.length === 1 ? '' : 's'}` : 'Within your limits'}</h2>{evaluation.violations.length === 0 ? <p>No allocation issue is currently visible.</p> : evaluation.violations.map((item) => <div className="activity-row" key={item}><strong>{item}</strong></div>)}<div className="mini-rule"><span>MAX ASSET</span><strong>{form.max}%</strong><span>CASH RESERVE</span><strong>{form.reserve}%</strong></div></div>
    </div>
  );

  const historyView = (
    <div className="grid">
      <div className="panel"><div className="eyebrow">PORTFOLIO HISTORY</div><h2>Recent records</h2>{activities.length === 0 ? <div className="empty-state"><strong>No records yet</strong><span>Trades and portfolio changes will appear here.</span></div> : activities.map((item: PersistedActivity) => <div className="activity-row" key={item.id}><div><strong>{item.event_type}</strong><small>{new Date(item.created_at).toLocaleString()}</small></div>{item.signature && <a className="explorer-link" href={explorerTxUrl(item.signature)} target="_blank" rel="noreferrer">Explorer ↗</a>}</div>)}</div>
      <div className="panel"><div className="eyebrow">TRADE HISTORY</div><h2>Devnet trades</h2>{trades.length === 0 ? <p>No trades yet.</p> : trades.map((item, index) => <div className="activity-row" key={`${item.createdAt}-${index}`}><div><strong>{item.side.toUpperCase()} {item.symbol}</strong><small>{item.status} · {new Date(item.createdAt).toLocaleString()}</small></div>{item.settlement && <a className="explorer-link" href={explorerTxUrl(item.settlement)} target="_blank" rel="noreferrer">Settlement ↗</a>}</div>)}</div>
    </div>
  );

  const passportView = (
    <div className="grid">
      <div className="panel"><div className="eyebrow">PORTFOLIO PROFILE</div><h2>{portfolio?.name ?? 'My Portfolio'}</h2><label>Name<input value={portfolioName} onChange={(e) => setPortfolioName(e.target.value)} /></label><label>Description<textarea value={portfolioDescription} onChange={(e) => setPortfolioDescription(e.target.value)} /></label><button className="primary-button" onClick={saveProfile} disabled={busy || !wallet}>{busy ? 'Saving…' : 'Save profile'}</button></div>
      <div className="panel"><div className="eyebrow">PASSPORT</div><h2>{wallet ? short(wallet) : 'Not signed in'}</h2><div className="holding-row"><span>Account</span><strong>Connected Solana wallet</strong></div><div className="holding-row"><span>Ownership</span><strong>Devnet token accounts</strong></div><div className="holding-row"><span>Reference values</span><strong>Mainnet · Jupiter</strong></div><div className="holding-row"><span>Storage</span><strong>Supabase</strong></div>{wallet && <a className="explorer-link" href={explorerAddressUrl(wallet)} target="_blank" rel="noreferrer">Open wallet on Explorer ↗</a>}</div>
    </div>
  );

  const page = active === 'Portfolio' ? portfolioView : active === 'Markets' ? marketsView : active === 'Rules' ? rulesView : active === 'History' ? historyView : passportView;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">SP</div><span>StockPassport</span></div>
        <nav>{NAV.map((item) => <button key={item} className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => navTo(item)}><Icon name={navIcon(item)} size={15} /><span>{item}</span></button>)}</nav>
        <div className="sidebar-foot"><span className={`status-dot ${network}`} /> {network === 'online' ? 'Devnet connected' : network === 'offline' ? 'Devnet unavailable' : 'Checking network'}</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title"><div className="eyebrow">STOCKPASSPORT / {active.toUpperCase()}</div><h1>{active}</h1></div>
          <div className="topbar-actions">
            <div className="workspace-menu" ref={menuRef}>
              <button className={`workspace-trigger ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen((value) => !value)} aria-haspopup="menu" aria-expanded={menuOpen}>
                <span className="workspace-trigger-icon"><Icon name="wallet" size={15} /></span>
                <span className="workspace-trigger-copy"><strong>{wallet ? short(wallet) : 'Connect wallet'}</strong><small>{wallet ? 'Solana · Devnet' : 'StockPassport account'}</small></span>
                <Icon name="chevron" size={15} />
              </button>
              {menuOpen && <div className="workspace-dropdown" role="menu">
                <div className="workspace-account"><span className="workspace-account-mark"><Icon name="wallet" size={15} /></span><div><strong>{wallet ? short(wallet) : 'Wallet not connected'}</strong><small>{wallet ? 'Your wallet is your portfolio account' : 'Connect to unlock your portfolio'}</small></div></div>
                <div className="workspace-divider" />
                <div className="workspace-section-label">WORKSPACE</div>
                {NAV.map((item) => <button key={item} className={`workspace-nav ${active === item ? 'active' : ''}`} onClick={() => navTo(item)} role="menuitem"><Icon name={navIcon(item)} size={15} /><span>{item}</span><small>{item === 'Portfolio' ? 'Overview' : item === 'Markets' ? 'Assets & quotes' : item === 'Rules' ? 'Preferences' : item === 'History' ? 'Activity' : 'Profile & verification'}</small></button>)}
                <div className="workspace-divider" />
                <div className="workspace-section-label">ACCOUNT</div>
                {wallet && <a className="workspace-action" href={explorerAddressUrl(wallet)} target="_blank" rel="noreferrer"><Icon name="external" size={15} /><span>Open on Explorer</span></a>}
                <button className="workspace-action" onClick={() => { setMenuOpen(false); void refresh(); }} disabled={busy}><Icon name="refresh" size={15} /><span>{busy ? 'Refreshing…' : 'Refresh portfolio'}</span></button>
                {wallet ? <button className="workspace-action danger" onClick={() => void signOut()}><Icon name="logout" size={15} /><span>Disconnect wallet</span></button> : <button className="workspace-action" onClick={() => { setMenuOpen(false); void signIn(); }}><Icon name="wallet" size={15} /><span>Sign in with wallet</span></button>}
                <div className="workspace-network"><span className="workspace-network-dot" /> <span>Devnet execution</span><small>Mainnet reference pricing</small></div>
              </div>}
            </div>
          </div>
        </header>

        <section className="content">
          {message && <div className="notice"><div><strong>{message}</strong><p>Your wallet remains the account identity for this portfolio.</p></div><button className="notice-close" onClick={() => setMessage(null)} aria-label="Dismiss">×</button></div>}
          {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss">×</button></div>}
          {page}
        </section>
        {wallet && <a className="wallet-state" href={explorerAddressUrl(wallet)} target="_blank" rel="noreferrer"><Icon name="shield" size={13} /> {short(wallet)} · Devnet ↗</a>}
      </main>
    </div>
  );
}
