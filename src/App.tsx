import { useCallback, useEffect, useMemo, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { DEVNET_ASSETS, DEVNET_CASH_MINT, DEVNET_CASH_SYMBOL } from './config/assets';
import { explorerAddressUrl, explorerTxUrl, CONNECTION } from './config/network';
import { getDevnetTokenHoldings, type TokenHolding } from './lib/tokens';
import { executeDevnetTrade, getDevnetQuote, type DevnetQuote, type TradeSide, type WalletSigner } from './lib/execution';
import { evaluatePortfolio, DEFAULT_PORTFOLIO_RULES, type PortfolioRules } from './lib/rules';
import { loadPortfolioData, recordActivity, recordTradeIntent, savePortfolio, saveRule, type PersistedActivity, type PersistedPortfolio, type PersistedRule } from './lib/data';

type WalletProvider = WalletSigner & { connect: () => Promise<{ publicKey: PublicKey }>; disconnect?: () => Promise<void> };
type WindowWithSolana = Window & { solana?: WalletProvider };

const NAV = ['Overview', 'Discover', 'Portfolio', 'Rules', 'Activity', 'Passport'];
const DEMO_PRICES: Record<string, number> = { NVDA: 175, AAPL: 230, MSFT: 510, GOOG: 250 };

type LocalTrade = { id: string; time: string; side: TradeSide | 'faucet'; symbol: string; amount: string; cash: string; paymentSignature?: string; settlementSignature?: string };

function provider(): WalletProvider | undefined { return (window as WindowWithSolana).solana; }
function shortAddress(address: string): string { return `${address.slice(0, 4)}…${address.slice(-4)}`; }

function App() {
  const [active, setActive] = useState('Overview');
  const [wallet, setWallet] = useState<string | null>(null);
  const [sol, setSol] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [portfolio, setPortfolio] = useState<PersistedPortfolio | null>(null);
  const [rules, setRules] = useState<PersistedRule[]>([]);
  const [activities, setActivities] = useState<PersistedActivity[]>([]);
  const [trades, setTrades] = useState<LocalTrade[]>([]);
  const [rpcStatus, setRpcStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [loadingData, setLoadingData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [funding, setFunding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tradeSide, setTradeSide] = useState<TradeSide>('buy');
  const [selectedAssetId, setSelectedAssetId] = useState(DEVNET_ASSETS[0]?.id ?? '');
  const [tradeAmount, setTradeAmount] = useState('1');
  const [quote, setQuote] = useState<DevnetQuote | null>(null);
  const [rulesForm, setRulesForm] = useState({ max: 25, reserve: 10, threshold: 5, contribution: 50 });
  const [portfolioName, setPortfolioName] = useState('My Portfolio');
  const [portfolioDescription, setPortfolioDescription] = useState('Programmable Devnet portfolio');

  const refreshChain = useCallback(async (address: string) => {
    const publicKey = new PublicKey(address);
    const [balance, tokenHoldings] = await Promise.all([
      CONNECTION.getBalance(publicKey, 'confirmed'),
      getDevnetTokenHoldings(address),
    ]);
    setSol(balance / 1_000_000_000);
    setHoldings(tokenHoldings);
  }, []);

  const refreshData = useCallback(async (address: string) => {
    setLoadingData(true);
    try {
      const data = await loadPortfolioData(address);
      setPortfolio(data.portfolio);
      setPortfolioName(data.portfolio.name);
      setPortfolioDescription(data.portfolio.description ?? '');
      setRules(data.rules);
      setActivities(data.activities);
      setTrades(data.trades.map((trade) => ({
        id: trade.quote_id,
        time: trade.created_at,
        side: trade.side,
        symbol: DEVNET_ASSETS.find((asset) => asset.id === trade.asset_id)?.referenceSymbol ?? trade.asset_id,
        amount: trade.asset_amount_units,
        cash: trade.cash_amount_units,
        paymentSignature: trade.payment_signature ?? undefined,
        settlementSignature: trade.settlement_signature ?? undefined,
      })));
      const max = data.rules.find((rule) => rule.rule_type === 'max_allocation');
      const reserve = data.rules.find((rule) => rule.rule_type === 'min_cash_reserve');
      const threshold = data.rules.find((rule) => rule.rule_type === 'rebalance_threshold');
      const contribution = data.rules.find((rule) => rule.rule_type === 'recurring_contribution');
      setRulesForm({
        max: Number(max?.parameters.value ?? 25),
        reserve: Number(reserve?.parameters.value ?? 10),
        threshold: Number(threshold?.parameters.value ?? 5),
        contribution: Number(contribution?.parameters.value ?? 50),
      });
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    CONNECTION.getEpochInfo().then(() => setRpcStatus('online')).catch(() => setRpcStatus('offline'));
  }, []);

  useEffect(() => {
    if (!wallet) return;
    Promise.all([refreshChain(wallet), refreshData(wallet)]).catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load wallet state.'));
  }, [wallet, refreshChain, refreshData]);

  const knownHoldings = useMemo(() => holdings.filter((holding) => holding.assetId), [holdings]);
  const cashHolding = holdings.find((holding) => holding.mint === DEVNET_CASH_MINT);
  const cashValue = Number(cashHolding?.amount ?? 0);
  const positions = useMemo(() => knownHoldings.map((holding) => {
    const asset = DEVNET_ASSETS.find((item) => item.id === holding.assetId)!;
    return { assetId: asset.id, symbol: asset.symbol, valueUsd: Number(holding.amount) * (DEMO_PRICES[asset.referenceSymbol] ?? 0) };
  }), [knownHoldings]);
  const rulesConfig: PortfolioRules = useMemo(() => ({
    ...DEFAULT_PORTFOLIO_RULES,
    maxSingleAssetPct: rulesForm.max,
    minReservePct: rulesForm.reserve,
    rebalanceThresholdPct: rulesForm.threshold,
  }), [rulesForm]);
  const evaluation = useMemo(() => evaluatePortfolio(positions, cashValue, rulesConfig), [positions, cashValue, rulesConfig]);

  const connectWallet = async () => {
    const p = provider();
    if (!p?.connect || !p.signTransaction) return setError('A Solana wallet with transaction signing support was not found. Switch the wallet to Devnet.');
    setBusy(true); setError(null); setMessage(null);
    try { const result = await p.connect(); setWallet(result.publicKey.toBase58()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Wallet connection failed.'); }
    finally { setBusy(false); }
  };

  const disconnectWallet = async () => {
    await provider()?.disconnect?.();
    setWallet(null); setSol(null); setHoldings([]); setPortfolio(null); setRules([]); setActivities([]); setQuote(null);
  };

  const refreshAll = async () => {
    if (!wallet) return connectWallet();
    setBusy(true); setError(null);
    try { await Promise.all([refreshChain(wallet), refreshData(wallet)]); setMessage('Chain and portfolio state refreshed.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Refresh failed.'); }
    finally { setBusy(false); }
  };

  const requestQuote = async () => {
    const amount = Number(tradeAmount);
    if (!wallet) return setError('Connect your Devnet wallet first.');
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter a valid positive asset amount.');
    setError(null); setMessage(null);
    try { setQuote(await getDevnetQuote(selectedAssetId, tradeSide, amount)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to get quote.'); }
  };

  const requestFaucet = async () => {
    if (!wallet) return setError('Connect a wallet first.');
    setFunding(true); setError(null); setMessage(null);
    try {
      const response = await fetch('/api/devnet/faucet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet }) });
      const result = await response.json() as { error?: string; amount?: number; signature?: string };
      if (!response.ok || !result.signature) throw new Error(result.error || 'Demo funding failed');
      await refreshChain(wallet);
      const event = await recordActivity(wallet, { eventType: 'demo_faucet', signature: result.signature, payload: { amount: result.amount ?? 1000, symbol: DEVNET_CASH_SYMBOL } });
      setActivities((previous) => [event, ...previous]);
      setMessage('1,000 DEMO-USDC funded and confirmed on Devnet.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Demo funding failed.'); }
    finally { setFunding(false); }
  };

  const executeTrade = async () => {
    if (!wallet || !quote) return setError('Connect wallet and request a fresh quote first.');
    const p = provider();
    if (!p?.signTransaction || p.publicKey?.toBase58() !== wallet) return setError('Wallet signing is unavailable or no longer connected.');
    if (Date.parse(quote.expiresAt) <= Date.now()) return setError('Quote expired. Request a new quote.');
    setBusy(true); setError(null); setMessage(null);
    let paymentSignature: string | undefined;
    try {
      await recordTradeIntent(wallet, { quoteId: quote.quoteId, assetId: quote.assetId, side: quote.side, assetAmountUnits: quote.assetAmountUnits, cashAmountUnits: quote.cashAmountUnits, status: 'payment_pending' });
      const result = await executeDevnetTrade(quote, p);
      paymentSignature = result.paymentSignature;
      await recordTradeIntent(wallet, { quoteId: quote.quoteId, assetId: quote.assetId, side: quote.side, assetAmountUnits: quote.assetAmountUnits, cashAmountUnits: quote.cashAmountUnits, status: 'settled', paymentSignature: result.paymentSignature, settlementSignature: result.settlementSignature });
      await recordActivity(wallet, { eventType: `trade_${quote.side}`, signature: result.settlementSignature, payload: { paymentSignature: result.paymentSignature, quoteId: quote.quoteId, assetId: quote.assetId, assetAmountUnits: quote.assetAmountUnits, cashAmountUnits: quote.cashAmountUnits } });
      await Promise.all([refreshChain(wallet), refreshData(wallet)]);
      setQuote(null); setMessage(`${quote.side === 'buy' ? 'Buy' : 'Sell'} confirmed on Devnet.`);
    } catch (cause) {
      await recordTradeIntent(wallet, { quoteId: quote.quoteId, assetId: quote.assetId, side: quote.side, assetAmountUnits: quote.assetAmountUnits, cashAmountUnits: quote.cashAmountUnits, status: paymentSignature ? 'settlement_pending' : 'failed', paymentSignature, errorMessage: cause instanceof Error ? cause.message : 'Trade failed' }).catch(() => undefined);
      setError(cause instanceof Error ? cause.message : 'Trade failed.');
      await Promise.all([refreshChain(wallet), refreshData(wallet)]).catch(() => undefined);
    } finally { setBusy(false); }
  };

  const saveAllRules = async () => {
    if (!wallet || !portfolio) return setError('Connect your wallet first.');
    setBusy(true); setError(null); setMessage(null);
    try {
      const definitions = [
        ['max_allocation', rulesForm.max],
        ['min_cash_reserve', rulesForm.reserve],
        ['rebalance_threshold', rulesForm.threshold],
        ['recurring_contribution', rulesForm.contribution],
      ] as const;
      const saved: PersistedRule[] = [];
      for (const [ruleType, value] of definitions) saved.push(await saveRule(wallet, { portfolioId: portfolio.id, ruleType, enabled: true, parameters: { value } }));
      setRules(saved); setMessage('Portfolio rules saved to Supabase.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save rules.'); }
    finally { setBusy(false); }
  };

  const savePortfolioSettings = async () => {
    if (!wallet) return setError('Connect your wallet first.');
    setBusy(true); setError(null); setMessage(null);
    try { const saved = await savePortfolio(wallet, { id: portfolio?.id, name: portfolioName, description: portfolioDescription }); setPortfolio(saved); setMessage('Portfolio settings saved.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save portfolio.'); }
    finally { setBusy(false); }
  };

  const renderOverview = () => <div className="grid">
    <div className="hero-card"><div><div className="eyebrow">PORTFOLIO STATE · SOLANA DEVNET</div><div className="hero-number">${evaluation.totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><p>Portfolio value is derived from confirmed token-account balances. Devnet prices are controlled demo references and the assets are synthetic.</p></div><button className="primary-button" onClick={refreshAll} disabled={busy}>{busy ? 'Working…' : wallet ? 'Refresh state' : 'Connect wallet'}</button></div>
    <div className="metrics"><div className="metric"><span>DEMO-USDC</span><strong>{cashHolding?.amount ?? '0'}</strong><small>Confirmed token balance</small></div><div className="metric"><span>DEVNET SOL</span><strong>{wallet && sol !== null ? sol.toFixed(4) : '—'}</strong><small>Network fee balance</small></div><div className="metric"><span>POSITIONS</span><strong>{knownHoldings.length}</strong><small>On-chain synthetic assets</small></div><div className="metric"><span>RULES</span><strong>{rules.filter((rule) => rule.enabled).length}</strong><small>Persisted in Supabase</small></div></div>
    <div className="panel split"><div><div className="eyebrow">SYSTEM STATE</div><h2>On-chain truth + programmable behavior</h2><p>Solana owns balances and transaction truth. Supabase stores portfolio configuration, proposals, lifecycle records and audit metadata.</p></div><div className="flow"><span>Wallet</span><b>→</b><span>Chain state</span><b>→</b><span>Rules</span><b>→</b><span>User authorization</span><b>→</b><span>Settlement</span></div></div>
    <div className="panel"><div className="panel-head"><div><div className="eyebrow">LIVE HEALTH</div><h2>{rpcStatus === 'online' ? 'Devnet connected' : rpcStatus === 'offline' ? 'Devnet unavailable' : 'Checking Devnet'}</h2></div><button className="secondary-button" onClick={requestFaucet} disabled={!wallet || funding}>{funding ? 'Funding…' : 'Fund 1,000 DEMO-USDC'}</button></div>{wallet ? <p>{shortAddress(wallet)} · {evaluation.proposals.length} current rule proposals · {evaluation.violations.length} active violations.</p> : <p>Connect a Solana Devnet wallet to begin. The application will never fabricate holdings.</p>} {wallet && <a className="explorer-link" href={explorerAddressUrl(wallet)} target="_blank" rel="noreferrer">Open wallet on Solana Explorer ↗</a>}</div>
  </div>;

  const renderDiscover = () => { const selected = DEVNET_ASSETS.find((asset) => asset.id === selectedAssetId) ?? DEVNET_ASSETS[0]; return <div className="grid"><div className="panel"><div className="eyebrow">DISCOVER</div><h2>Devnet tokenized-stock demos</h2><p>Every asset here is a synthetic Devnet demo token. It is deliberately labelled and does not represent a claim on real-world equity.</p><div className="asset-grid">{DEVNET_ASSETS.map((asset) => <button key={asset.id} className={selectedAssetId === asset.id ? 'asset-card selected' : 'asset-card'} onClick={() => { setSelectedAssetId(asset.id); setQuote(null); }}><span>{asset.referenceSymbol}</span><strong>{asset.symbol}</strong><small>${DEMO_PRICES[asset.referenceSymbol].toFixed(2)} reference</small></button>)}</div></div><div className="panel trade-panel"><div className="trade-head"><div><div className="eyebrow">EXECUTION TICKET</div><h2>{selected.symbol}</h2></div><div className="side-toggle"><button className={tradeSide === 'buy' ? 'selected-side' : ''} onClick={() => { setTradeSide('buy'); setQuote(null); }}>Buy</button><button className={tradeSide === 'sell' ? 'selected-side' : ''} onClick={() => { setTradeSide('sell'); setQuote(null); }}>Sell</button></div></div><label>Asset quantity<input inputMode="decimal" value={tradeAmount} onChange={(event) => { setTradeAmount(event.target.value); setQuote(null); }} /></label>{quote && <div className="quote-box"><div><span>Reference</span><strong>${quote.referencePriceUsd.toFixed(2)}</strong></div><div><span>Execution</span><strong>${quote.executionPriceUsd.toFixed(2)}</strong></div><div><span>{quote.side === 'buy' ? 'You pay' : 'You receive'}</span><strong>{quote.cashAmount.toFixed(2)} DEMO-USDC</strong></div><div><span>Expiry</span><strong>{Math.max(0, Math.ceil((Date.parse(quote.expiresAt) - Date.now()) / 1000))}s</strong></div></div>}<div className="trade-actions"><button className="secondary-button" onClick={requestQuote} disabled={busy}>Get quote</button><button className="primary-button" onClick={executeTrade} disabled={!quote || busy}>{busy ? 'Settling…' : `${tradeSide === 'buy' ? 'Buy' : 'Sell'} ${selected.referenceSymbol}`}</button></div><p className="trade-note">The payment transaction is signed by your wallet. The opposing leg is signed by the controlled Devnet market authority. Both signatures are recorded.</p></div></div>; };

  const renderPortfolio = () => <div className="grid"><div className="panel"><div className="eyebrow">PORTFOLIO SETTINGS</div><h2>{portfolio?.name ?? 'My Portfolio'}</h2><label>Portfolio name<input value={portfolioName} onChange={(event) => setPortfolioName(event.target.value)} /></label><label>Description<textarea value={portfolioDescription} onChange={(event) => setPortfolioDescription(event.target.value)} /></label><button className="primary-button" onClick={savePortfolioSettings} disabled={busy}>Save portfolio</button></div><div className="panel"><div className="eyebrow">CONFIRMED POSITIONS</div><h2>${evaluation.totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>{knownHoldings.length === 0 && <p>No positions yet. Fund Demo-USDC and buy a synthetic asset from Discover.</p>}{knownHoldings.map((holding) => { const asset = DEVNET_ASSETS.find((item) => item.id === holding.assetId)!; const value = Number(holding.amount) * DEMO_PRICES[asset.referenceSymbol]; const pct = evaluation.totalValueUsd ? value / evaluation.totalValueUsd * 100 : 0; return <div className="holding-row" key={holding.mint}><div><strong>{asset.symbol}</strong><small>{Number(holding.amount).toLocaleString()} units · {pct.toFixed(1)}% of portfolio</small></div><strong>${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>; })}</div></div>;

  const renderRules = () => <div className="grid"><div className="panel"><div className="eyebrow">PROGRAMMABLE INVESTING</div><h2>Rules</h2><p>Rules are persisted in Supabase and evaluated against freshly observed Solana balances. Saving a rule never moves funds.</p><div className="rule-form"><label>Maximum single asset %<input type="number" min="1" max="100" value={rulesForm.max} onChange={(event) => setRulesForm({ ...rulesForm, max: Number(event.target.value) })} /></label><label>Minimum cash reserve %<input type="number" min="0" max="100" value={rulesForm.reserve} onChange={(event) => setRulesForm({ ...rulesForm, reserve: Number(event.target.value) })} /></label><label>Rebalance threshold %<input type="number" min="0.1" max="50" value={rulesForm.threshold} onChange={(event) => setRulesForm({ ...rulesForm, threshold: Number(event.target.value) })} /></label><label>Recurring contribution target $<input type="number" min="0" value={rulesForm.contribution} onChange={(event) => setRulesForm({ ...rulesForm, contribution: Number(event.target.value) })} /></label></div><button className="primary-button" onClick={saveAllRules} disabled={busy || !wallet}>{busy ? 'Saving…' : 'Save rules'}</button></div><div className="panel"><div className="eyebrow">CURRENT EVALUATION</div><h2>{evaluation.proposals.length} proposals</h2>{evaluation.violations.length === 0 ? <p>No rule violations in the current on-chain state.</p> : evaluation.violations.map((violation) => <div className="activity-row" key={violation}><strong>{violation}</strong></div>)}{evaluation.proposals.map((proposal) => <div className="activity-row" key={proposal.id}><div><strong>{proposal.symbol ?? 'Cash reserve'}</strong><small>{proposal.kind} · target {proposal.targetPct.toFixed(1)}%</small></div><strong>${proposal.valueUsd.toFixed(2)}</strong></div>)}{evaluation.proposals.length > 0 && <button className="secondary-button" onClick={() => setMessage('Proposal review is available. Explicit execution is intentionally separate from rule evaluation.')}>Review proposal</button>}</div></div>;

  const renderActivity = () => <div className="grid"><div className="panel"><div className="eyebrow">AUDIT TRAIL</div><h2>Persistent activity</h2>{loadingData && <p>Loading activity…</p>}{activities.length === 0 && !loadingData && <p>No persisted activity for this wallet yet.</p>}{activities.map((item) => <div className="activity-row" key={item.id}><div><strong>{item.event_type}</strong><small>{new Date(item.created_at).toLocaleString()}</small></div>{item.signature && <a className="explorer-link" href={explorerTxUrl(item.signature)} target="_blank" rel="noreferrer">View tx ↗</a>}</div>)}</div><div className="panel"><div className="eyebrow">TRADE LIFECYCLE</div><h2>Execution records</h2>{trades.length === 0 && <p>No trade intents for this wallet.</p>}{trades.map((trade) => <div className="activity-row" key={trade.id}><div><strong>{trade.side.toUpperCase()} {trade.symbol}</strong><small>Status: {trade.id === trade.quoteId ? trade.status : trade.status}</small></div><div className="activity-links">{trade.paymentSignature && <a href={explorerTxUrl(trade.paymentSignature)} target="_blank" rel="noreferrer">payment ↗</a>}{trade.settlementSignature && <a href={explorerTxUrl(trade.settlementSignature)} target="_blank" rel="noreferrer">settlement ↗</a>}</div></div>)}</div></div>;

  const renderPassport = () => <div className="grid"><div className="hero-card"><div><div className="eyebrow">STOCKPASSPORT</div><h2>Portable portfolio record</h2><p>{wallet ? `Wallet ${shortAddress(wallet)} · ${knownHoldings.length} live positions · ${rules.length} saved rules · ${activities.length} indexed events.` : 'Connect a wallet to create a verifiable portfolio record from actual Devnet state.'}</p></div></div><div className="panel"><div className="eyebrow">PASSPORT CONTENT</div><div className="holding-row"><span>Network</span><strong>Solana Devnet</strong></div><div className="holding-row"><span>Ownership source</span><strong>On-chain token accounts</strong></div><div className="holding-row"><span>Configuration source</span><strong>Supabase</strong></div><div className="holding-row"><span>Portfolio</span><strong>{portfolio?.name ?? 'Not created'}</strong></div><div className="holding-row"><span>Current proposals</span><strong>{evaluation.proposals.length}</strong></div>{wallet && <a className="explorer-link" href={explorerAddressUrl(wallet)} target="_blank" rel="noreferrer">Verify wallet on Explorer ↗</a>}</div></div>;

  const currentPage = active === 'Overview' ? renderOverview() : active === 'Discover' ? renderDiscover() : active === 'Portfolio' ? renderPortfolio() : active === 'Rules' ? renderRules() : active === 'Activity' ? renderActivity() : renderPassport();

  return <div className="shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">SP</div><span>StockPassport</span></div><nav>{NAV.map((item) => <button key={item} className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item)}>{item}</button>)}</nav><div className="sidebar-foot"><span className={`status-dot ${rpcStatus}`} /> {rpcStatus === 'online' ? 'Solana Devnet online' : rpcStatus === 'offline' ? 'RPC unavailable' : 'Checking RPC'}</div></aside><main className="main"><header className="topbar"><div><div className="eyebrow">STOCKPASSPORT / {active.toUpperCase()}</div><h1>{active}</h1></div><div className="topbar-actions">{wallet ? <button className="wallet-button" onClick={disconnectWallet}>{shortAddress(wallet)}</button> : <button className="wallet-button" onClick={connectWallet} disabled={busy}>{busy ? 'Connecting…' : 'Connect wallet'}</button>}</div></header><section className="content">{message && <div className="notice"><div><strong>{message}</strong><p>State is sourced from Solana and/or persisted application records.</p></div></div>}{error && <div className="error-banner">{error}</div>}{currentPage}</section>{wallet && <a className="wallet-state" href={explorerAddressUrl(wallet)} target="_blank" rel="noreferrer">{shortAddress(wallet)} · Devnet ↗</a>}</main></div>;
}

export default App;
