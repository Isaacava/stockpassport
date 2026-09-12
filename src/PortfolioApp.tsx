import { useCallback, useEffect, useMemo, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { DEVNET_ASSETS, DEVNET_CASH_MINT, DEVNET_CASH_SYMBOL } from './config/assets';
import { CONNECTION, explorerAddressUrl, explorerTxUrl } from './config/network';
import { getDevnetTokenHoldings, type TokenHolding } from './lib/tokens';
import { connectBrowserWallet, disconnectBrowserWallet, getConnectedWalletAddress, getConnectedWalletSigner } from './lib/wallet';
import { executeDevnetTrade, type DevnetQuote, type TradeSide } from './lib/execution';
import { DEFAULT_PORTFOLIO_RULES, evaluatePortfolio, type PortfolioRules } from './lib/rules';
import { fetchMainnetReferencePrices, type MainnetReferencePrice } from './lib/mainnet-prices';
import { loadPortfolioData, recordActivity, recordTradeIntent, savePortfolio, saveRule, type PersistedActivity, type PersistedPortfolio, type PersistedRule } from './lib/data';

const NAV = ['Portfolio', 'Markets', 'Rules', 'History', 'Passport'] as const;
type Tab = typeof NAV[number];
type Trade = { side: TradeSide; symbol: string; status: string; settlement?: string; createdAt: string };
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const apiUrl = (path: string) => `${API_BASE}${path}`;
const short = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;

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
  const [assetId, setAssetId] = useState(DEVNET_ASSETS[0]?.id ?? '');
  const [side, setSide] = useState<TradeSide>('buy');
  const [amount, setAmount] = useState('1');
  const [quote, setQuote] = useState<DevnetQuote | null>(null);
  const [form, setForm] = useState({ max: 25, reserve: 10, threshold: 5 });
  const [portfolioName, setPortfolioName] = useState('My Portfolio');
  const [portfolioDescription, setPortfolioDescription] = useState('');

  const loadChain = useCallback(async (address: string) => {
    const key = new PublicKey(address);
    const [lamports, tokenHoldings] = await Promise.all([CONNECTION.getBalance(key, 'confirmed'), getDevnetTokenHoldings(address)]);
    setSol(lamports / 1e9);
    setHoldings(tokenHoldings);
  }, []);
  const loadPrices = useCallback(async () => {
    const refs = await fetchMainnetReferencePrices();
    setPrices(Object.fromEntries(refs.map((item) => [item.referenceSymbol, item])));
  }, []);
  const loadData = useCallback(async (address: string) => {
    const data = await loadPortfolioData(address);
    setPortfolio(data.portfolio);
    setPortfolioName(data.portfolio.name);
    setPortfolioDescription(data.portfolio.description ?? '');
    setRules(data.rules);
    setActivities(data.activities);
    setTrades(data.trades.map((item) => ({ side: item.side, symbol: DEVNET_ASSETS.find((a) => a.id === item.asset_id)?.referenceSymbol ?? item.asset_id, status: item.status, settlement: item.settlement_signature ?? undefined, createdAt: item.created_at })));
    const valueOf = (type: string, fallback: number) => Number(data.rules.find((rule) => rule.rule_type === type)?.parameters.value ?? fallback);
    setForm({ max: valueOf('max_allocation', 25), reserve: valueOf('min_cash_reserve', 10), threshold: valueOf('rebalance_threshold', 5) });
  }, []);

  useEffect(() => {
    CONNECTION.getEpochInfo().then(() => setNetwork('online')).catch(() => setNetwork('offline'));
    const connected = getConnectedWalletAddress() ?? sessionStorage.getItem('stockpassport.wallet');
    if (connected) setWallet(connected);
    loadPrices().catch(() => undefined);
    const timer = window.setInterval(() => loadPrices().catch(() => undefined), 30_000);
    return () => window.clearInterval(timer);
  }, [loadPrices]);
  useEffect(() => { if (wallet) Promise.all([loadChain(wallet), loadData(wallet)]).catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load portfolio.')); }, [wallet, loadChain, loadData]);

  const cash = Number(holdings.find((item) => item.mint === DEVNET_CASH_MINT)?.amount ?? 0);
  const positions = useMemo(() => holdings.filter((item) => item.assetId).flatMap((item) => {
    const asset = DEVNET_ASSETS.find((a) => a.id === item.assetId);
    const price = asset ? prices[asset.referenceSymbol]?.priceUsd : undefined;
    if (!asset || !price || price <= 0) return [];
    return [{ assetId: asset.id, symbol: asset.symbol, amount: Number(item.amount), valueUsd: Number(item.amount) * price }];
  }), [holdings, prices]);
  const total = cash + positions.reduce((sum, item) => sum + item.valueUsd, 0);
  const rulesConfig: PortfolioRules = useMemo(() => ({ ...DEFAULT_PORTFOLIO_RULES, maxSingleAssetPct: form.max, minReservePct: form.reserve, rebalanceThresholdPct: form.threshold }), [form]);
  const evaluation = useMemo(() => evaluatePortfolio(positions.map((item) => ({ assetId: item.assetId, symbol: item.symbol, valueUsd: item.valueUsd })), cash, rulesConfig), [positions, cash, rulesConfig]);
  const selected = DEVNET_ASSETS.find((item) => item.id === assetId) ?? DEVNET_ASSETS[0];
  const selectedPrice = prices[selected.referenceSymbol]?.priceUsd;

  const signIn = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const signer = await connectBrowserWallet();
      const address = signer.publicKey.toBase58();
      if (!signer.signMessage) throw new Error('This wallet does not support message signing.');
      await signer.signMessage(new TextEncoder().encode(`StockPassport sign in\nWallet: ${address}\nNetwork: Solana Devnet\nPurpose: Portfolio account access`));
      sessionStorage.setItem('stockpassport.wallet', address);
      setWallet(address);
      setMessage('Wallet signed in. Your wallet is your StockPassport account.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Wallet sign-in failed.'); }
    finally { setBusy(false); }
  };
  const signOut = async () => { await disconnectBrowserWallet(); sessionStorage.removeItem('stockpassport.wallet'); setWallet(null); setHoldings([]); setPortfolio(null); setRules([]); setActivities([]); setTrades([]); setQuote(null); };
  const refresh = async () => { if (!wallet) return signIn(); setBusy(true); try { await Promise.all([loadChain(wallet), loadData(wallet), loadPrices()]); setMessage('Portfolio refreshed from your wallet and current market references.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Refresh failed.'); } finally { setBusy(false); } };
  const fund = async () => { if (!wallet) return setError('Sign in with your wallet first.'); setFunding(true); setError(null); try { const response = await fetch(apiUrl('/api/devnet/faucet'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet }) }); const result = await response.json() as { error?: string; signature?: string }; if (!response.ok || !result.signature) throw new Error(result.error || 'Funding failed.'); await Promise.all([loadChain(wallet), loadData(wallet)]); setMessage(`1,000 ${DEVNET_CASH_SYMBOL} added to your Devnet portfolio.`); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Funding failed.'); } finally { setFunding(false); } };
  const getQuote = async () => { if (!wallet) return setError('Sign in with your wallet first.'); const quantity = Number(amount); if (!Number.isFinite(quantity) || quantity <= 0) return setError('Enter a valid quantity.'); setError(null); try { const response = await fetch(apiUrl(`/api/devnet/quote?assetId=${encodeURIComponent(assetId)}&side=${side}&amount=${encodeURIComponent(String(quantity))}`), { cache: 'no-store' }); const result = await response.json() as DevnetQuote & { error?: string }; if (!response.ok) throw new Error(result.error || 'Unable to price this order.'); setQuote(result); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to price this order.'); } };
  const executeTrade = async () => { if (!wallet || !quote) return setError('Sign in and request a fresh quote first.'); setBusy(true); setError(null); try { const signer = getConnectedWalletSigner(); if (signer.publicKey.toBase58() !== wallet) throw new Error('The connected wallet changed. Sign in again.'); const result = await executeDevnetTrade(quote, signer); await recordTradeIntent(wallet, { quoteId: quote.quoteId, assetId: quote.assetId, side: quote.side, assetAmountUnits: quote.assetAmountUnits, cashAmountUnits: quote.cashAmountUnits, status: 'settled', paymentSignature: result.paymentSignature, settlementSignature: result.settlementSignature }); await recordActivity(wallet, { eventType: `portfolio_trade_${quote.side}`, signature: result.settlementSignature, payload: { assetId: quote.assetId, referencePriceUsd: quote.referencePriceUsd, executionPriceUsd: quote.executionPriceUsd, referenceObservedAt: quote.referenceObservedAt, referenceNetwork: quote.referenceNetwork } }); await Promise.all([loadChain(wallet), loadData(wallet), loadPrices()]); setQuote(null); setMessage(`${quote.side === 'buy' ? 'Buy' : 'Sell'} confirmed on Devnet.`); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Trade failed.'); } finally { setBusy(false); } };
  const savePreferences = async () => { if (!wallet || !portfolio) return setError('Sign in with your wallet first.'); setBusy(true); setError(null); try { const saved: PersistedRule[] = []; for (const [ruleType, value] of [['max_allocation', form.max], ['min_cash_reserve', form.reserve], ['rebalance_threshold', form.threshold]] as const) saved.push(await saveRule(wallet, { portfolioId: portfolio.id, ruleType, enabled: true, parameters: { value } })); setRules(saved); setMessage('Portfolio preferences saved with a wallet signature.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save preferences.'); } finally { setBusy(false); } };
  const saveProfile = async () => { if (!wallet) return setError('Sign in with your wallet first.'); setBusy(true); try { setPortfolio(await savePortfolio(wallet, { id: portfolio?.id, name: portfolioName, description: portfolioDescription })); setMessage('Portfolio profile saved.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save profile.'); } finally { setBusy(false); } };

  const portfolioView = <div className="grid portfolio-overview"><div className="hero-card"><div><div className="eyebrow">YOUR PORTFOLIO · DEVNET</div><div className="hero-number">${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><p>Value of this wallet's synthetic holdings using current Mainnet reference prices.</p></div><button className="secondary-button dark-secondary" onClick={refresh} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh portfolio'}</button></div><div className="metrics"><div className="metric"><span>AVAILABLE CASH</span><strong>{cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><small>{DEVNET_CASH_SYMBOL} · Devnet</small></div><div className="metric"><span>POSITIONS</span><strong>{positions.length}</strong><small>Assets held by this wallet</small></div><div className="metric"><span>REFERENCES</span><strong>{Object.keys(prices).length}</strong><small>Mainnet market prices</small></div><div className="metric"><span>DEVNET SOL</span><strong>{sol === null ? '—' : sol.toFixed(4)}</strong><small>Network balance</small></div></div><div className="overview-grid"><div className="panel portfolio-list-panel"><div className="panel-head"><div><div className="eyebrow">HOLDINGS</div><h2>Your positions</h2></div><span className="small-badge">{positions.length} assets</span></div>{positions.length === 0 ? <div className="empty-state"><strong>Your portfolio is empty</strong><span>Add demo cash, then choose an asset from Markets.</span><button className="secondary-button" onClick={fund} disabled={funding || !wallet}>{funding ? 'Funding…' : 'Add demo cash'}</button></div> : positions.map((item) => <div className="holding-card" key={item.assetId}><div className="holding-icon">{item.symbol.slice(0, 1)}</div><div className="holding-main"><strong>{item.symbol}</strong><span>{item.amount.toLocaleString()} units</span></div><div className="holding-value"><strong>${item.valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span>{total ? (item.valueUsd / total * 100).toFixed(1) : '0.0'}% · reference</span></div></div>)}</div><div className="panel market-panel"><div className="panel-head"><div><div className="eyebrow">MARKET WINDOW</div><h2>Reference prices</h2></div><span className={`market-status ${network}`}>{network === 'online' ? 'DEVNET READY' : network === 'offline' ? 'OFFLINE' : 'CHECKING'}</span></div>{DEVNET_ASSETS.map((asset) => { const ref = prices[asset.referenceSymbol]; return <button className="reference-row" key={asset.id} onClick={() => { setAssetId(asset.id); setActive('Markets'); }}><span className="ref-symbol">{asset.referenceSymbol}</span><span className="ref-name">{asset.symbol}</span><strong>{ref ? `$${ref.priceUsd.toFixed(2)}` : '—'}</strong></button>; })}<div className="market-note">Live reference · demo ownership stays on Devnet</div></div></div><div className="panel portfolio-note-card"><div><div className="eyebrow">ACCOUNT</div><h2>{wallet ? short(wallet) : 'Wallet not connected'}</h2><p>{wallet ? 'Your Solana wallet is the account identity for this portfolio.' : 'Connect a wallet to see balances and history.'}</p></div><button className="primary-button" onClick={wallet ? refresh : signIn} disabled={busy}>{wallet ? 'Refresh data' : 'Sign in with wallet'}</button></div></div>;

  const marketsView = <div className="grid"><div className="panel"><div className="eyebrow">MARKETS</div><h2>Synthetic assets</h2><p>Demo-only assets on Solana Devnet, valued using current Mainnet references.</p><div className="asset-grid">{DEVNET_ASSETS.map((asset) => <button key={asset.id} className={assetId === asset.id ? 'asset-card selected' : 'asset-card'} onClick={() => { setAssetId(asset.id); setQuote(null); }}><span>{asset.referenceSymbol}</span><strong>{asset.symbol}</strong><small>{prices[asset.referenceSymbol] ? `$${prices[asset.referenceSymbol].priceUsd.toFixed(2)} reference` : 'Price unavailable'}</small></button>)}</div></div><div className="panel trade-panel"><div className="trade-head"><div><div className="eyebrow">ADD TO PORTFOLIO</div><h2>{selected.symbol}</h2><small>{selectedPrice ? `$${selectedPrice.toFixed(2)} Mainnet reference` : 'Reference unavailable'}</small></div><div className="side-toggle"><button className={side === 'buy' ? 'selected-side' : ''} onClick={() => { setSide('buy'); setQuote(null); }}>Buy</button><button className={side === 'sell' ? 'selected-side' : ''} onClick={() => { setSide('sell'); setQuote(null); }}>Sell</button></div></div><label>Quantity<input value={amount} inputMode="decimal" onChange={(e) => { setAmount(e.target.value); setQuote(null); }} /></label>{quote && <div className="quote-box"><div><span>Reference</span><strong>${quote.referencePriceUsd.toFixed(2)}</strong></div><div><span>Devnet price</span><strong>${quote.executionPriceUsd.toFixed(2)}</strong></div><div><span>{quote.side === 'buy' ? 'Cost' : 'Return'}</span><strong>{quote.cashAmount.toFixed(2)} DEMO-USDC</strong></div><div><span>Network</span><strong>Devnet</strong></div></div>}<div className="trade-actions"><button className="secondary-button" onClick={getQuote} disabled={busy || !wallet}>Price it</button><button className="primary-button" onClick={executeTrade} disabled={!quote || busy}>{busy ? 'Confirming…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${selected.referenceSymbol}`}</button></div></div></div>;

  const rulesView = <div className="grid"><div className="panel"><div className="eyebrow">PORTFOLIO PREFERENCES</div><h2>How should it behave?</h2><p>Saving preferences uses a signature from your connected wallet.</p><label>Maximum single asset %<input type="number" min="1" max="100" value={form.max} onChange={(e) => setForm({ ...form, max: Number(e.target.value) })} /></label><label>Minimum cash reserve %<input type="number" min="0" max="100" value={form.reserve} onChange={(e) => setForm({ ...form, reserve: Number(e.target.value) })} /></label><label>Rebalance threshold %<input type="number" min="0.1" max="50" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} /></label><button className="primary-button" onClick={savePreferences} disabled={busy || !wallet}>{busy ? 'Saving…' : 'Save preferences'}</button></div><div className="panel"><div className="eyebrow">CURRENT PORTFOLIO</div><h2>{evaluation.violations.length ? `${evaluation.violations.length} allocation issue${evaluation.violations.length === 1 ? '' : 's'}` : 'Within your limits'}</h2>{evaluation.violations.length === 0 ? <p>No allocation issue is currently visible.</p> : evaluation.violations.map((item) => <div className="activity-row" key={item}><strong>{item}</strong></div>)}<div className="mini-rule"><span>MAX ASSET</span><strong>{form.max}%</strong><span>CASH RESERVE</span><strong>{form.reserve}%</strong></div></div></div>;

  const historyView = <div className="grid"><div className="panel"><div className="eyebrow">PORTFOLIO HISTORY</div><h2>Recent records</h2>{activities.length === 0 ? <div className="empty-state"><strong>No records yet</strong><span>Trades and portfolio changes will appear here.</span></div> : activities.map((item) => <div className="activity-row" key={item.id}><div><strong>{item.event_type}</strong><small>{new Date(item.created_at).toLocaleString()}</small></div>{item.signature && <a className="explorer-link" href={explorerTxUrl(item.signature)} target="_blank" rel="noreferrer">Explorer ↗</a>}</div>)}</div><div className="panel"><div className="eyebrow">TRADE HISTORY</div><h2>Devnet trades</h2>{trades.length === 0 ? <p>No trades yet.</p> : trades.map((item, index) => <div className="activity-row" key={`${item.createdAt}-${index}`}><div><strong>{item.side.toUpperCase()} {item.symbol}</strong><small>{item.status} · {new Date(item.createdAt).toLocaleString()}</small></div>{item.settlement && <a className="explorer-link" href={explorerTxUrl(item.settlement)} target="_blank" rel="noreferrer">Settlement ↗</a>}</div>)}</div></div>;

  const passportView = <div className="grid"><div className="panel"><div className="eyebrow">PORTFOLIO PROFILE</div><h2>{portfolio?.name ?? 'My Portfolio'}</h2><label>Name<input value={portfolioName} onChange={(e) => setPortfolioName(e.target.value)} /></label><label>Description<textarea value={portfolioDescription} onChange={(e) => setPortfolioDescription(e.target.value)} /></label><button className="primary-button" onClick={saveProfile} disabled={busy || !wallet}>Save profile</button></div><div className="panel"><div className="eyebrow">PASSPORT</div><h2>{wallet ? short(wallet) : 'Not signed in'}</h2><div className="holding-row"><span>Account</span><strong>Connected Solana wallet</strong></div><div className="holding-row"><span>Ownership</span><strong>Devnet token accounts</strong></div><div className="holding-row"><span>Reference values</span><strong>Mainnet · Jupiter</strong></div><div className="holding-row"><span>Storage</span><strong>Supabase</strong></div>{wallet && <a className="explorer-link" href={explorerAddressUrl(wallet)} target="_blank" rel="noreferrer">Open wallet on Explorer ↗</a>}</div></div>;

  const page = active === 'Portfolio' ? portfolioView : active === 'Markets' ? marketsView : active === 'Rules' ? rulesView : active === 'History' ? historyView : passportView;
  return <div className="shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">SP</div><span>StockPassport</span></div><nav>{NAV.map((item) => <button key={item} className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item)}>{item}</button>)}</nav><div className="sidebar-foot"><span className={`status-dot ${network}`} /> {network === 'online' ? 'Devnet connected' : network === 'offline' ? 'Devnet unavailable' : 'Checking network'}</div></aside><main className="main"><header className="topbar"><div><div className="eyebrow">STOCKPASSPORT / {active.toUpperCase()}</div><h1>{active}</h1></div><div className="topbar-actions">{wallet ? <button className="wallet-button" onClick={signOut}>{short(wallet)}</button> : <button className="wallet-button" onClick={signIn} disabled={busy}>{busy ? 'Signing…' : 'Sign in with wallet'}</button>}</div></header><section className="content">{message && <div className="notice"><div><strong>{message}</strong><p>Your wallet is the account identity and signing authority.</p></div></div>}{error && <div className="error-banner">{error}</div>}{page}</section>{wallet && <a className="wallet-state" href={explorerAddressUrl(wallet)} target="_blank" rel="noreferrer">{short(wallet)} · Devnet ↗</a>}</main></div>;
}
