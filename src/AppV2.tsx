import { useCallback, useEffect, useMemo, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { DEVNET_ASSETS, DEVNET_CASH_MINT, DEVNET_CASH_SYMBOL } from './config/assets';
import { explorerAddressUrl, explorerTxUrl, CONNECTION } from './config/network';
import { getDevnetTokenHoldings, type TokenHolding } from './lib/tokens';
import { executeDevnetTrade, type DevnetQuote, type TradeSide, type WalletSigner } from './lib/execution';
import { DEFAULT_PORTFOLIO_RULES, evaluatePortfolio, type PortfolioRules, type RuleProposal } from './lib/rules';
import { loadPortfolioData, recordActivity, recordTradeIntent, savePortfolio, saveRule, type PersistedActivity, type PersistedPortfolio, type PersistedRule } from './lib/data';
import { fetchMainnetReferencePrices, type MainnetReferencePrice } from './lib/mainnet-prices';

type WalletProvider = WalletSigner & { connect: () => Promise<{ publicKey: PublicKey }>; disconnect?: () => Promise<void> };
type WindowWithSolana = Window & { solana?: WalletProvider };
type TradeRow = { id: string; side: TradeSide; symbol: string; status: string; paymentSignature?: string; settlementSignature?: string; createdAt: string };
const NAV = ['Overview', 'Discover', 'Portfolio', 'Rules', 'Activity', 'Passport'];
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

function apiUrl(path: string): string { return `${API_BASE}${path}`; }
function provider(): WalletProvider | undefined { return (window as WindowWithSolana).solana; }
function shortAddress(address: string): string { return `${address.slice(0, 4)}…${address.slice(-4)}`; }

export default function AppV2() {
  const [active, setActive] = useState('Overview');
  const [wallet, setWallet] = useState<string | null>(null);
  const [sol, setSol] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [portfolio, setPortfolio] = useState<PersistedPortfolio | null>(null);
  const [rules, setRules] = useState<PersistedRule[]>([]);
  const [activities, setActivities] = useState<PersistedActivity[]>([]);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [referencePrices, setReferencePrices] = useState<Record<string, MainnetReferencePrice>>({});
  const [rpcStatus, setRpcStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [busy, setBusy] = useState(false);
  const [funding, setFunding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tradeSide, setTradeSide] = useState<TradeSide>('buy');
  const [selectedAssetId, setSelectedAssetId] = useState(DEVNET_ASSETS[0]?.id ?? '');
  const [tradeAmount, setTradeAmount] = useState('1');
  const [quote, setQuote] = useState<DevnetQuote | null>(null);
  const [rulesForm, setRulesForm] = useState({ max: 25, reserve: 10, threshold: 5, contribution: 50 });
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [portfolioName, setPortfolioName] = useState('My Portfolio');
  const [portfolioDescription, setPortfolioDescription] = useState('Programmable Devnet portfolio');

  const refreshChain = useCallback(async (address: string) => {
    const key = new PublicKey(address);
    const [balance, tokenHoldings] = await Promise.all([
      CONNECTION.getBalance(key, 'confirmed'),
      getDevnetTokenHoldings(address),
    ]);
    setSol(balance / 1_000_000_000);
    setHoldings(tokenHoldings);
  }, []);

  const refreshPrices = useCallback(async () => {
    const prices = await fetchMainnetReferencePrices();
    setReferencePrices(Object.fromEntries(prices.map((price) => [price.referenceSymbol, price])));
  }, []);

  const refreshData = useCallback(async (address: string) => {
    const data = await loadPortfolioData(address);
    setPortfolio(data.portfolio);
    setPortfolioName(data.portfolio.name);
    setPortfolioDescription(data.portfolio.description ?? '');
    setRules(data.rules);
    setActivities(data.activities);
    setTrades(data.trades.map((trade) => ({
      id: trade.id,
      side: trade.side,
      symbol: DEVNET_ASSETS.find((asset) => asset.id === trade.asset_id)?.referenceSymbol ?? trade.asset_id,
      status: trade.status,
      paymentSignature: trade.payment_signature ?? undefined,
      settlementSignature: trade.settlement_signature ?? undefined,
      createdAt: trade.created_at,
    })));
    const valueOf = (type: string, fallback: number) => Number(data.rules.find((rule) => rule.rule_type === type)?.parameters.value ?? fallback);
    const allocationRule = data.rules.find((rule) => rule.rule_type === 'target_allocation');
    const allocationParams = allocationRule?.parameters.allocations;
    setRulesForm({
      max: valueOf('max_allocation', 25),
      reserve: valueOf('min_cash_reserve', 10),
      threshold: valueOf('rebalance_threshold', 5),
      contribution: valueOf('recurring_contribution', 50),
    });
    setTargets(allocationParams && typeof allocationParams === 'object' ? Object.fromEntries(Object.entries(allocationParams).map(([key, value]) => [key, Number(value)])) : {});
  }, []);

  useEffect(() => {
    CONNECTION.getEpochInfo().then(() => setRpcStatus('online')).catch(() => setRpcStatus('offline'));
    refreshPrices().catch(() => setReferencePrices({}));
    const timer = window.setInterval(() => { refreshPrices().catch(() => undefined); }, 30_000);
    return () => window.clearInterval(timer);
  }, [refreshPrices]);

  useEffect(() => {
    if (!wallet) return;
    Promise.all([refreshChain(wallet), refreshData(wallet)]).catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load wallet state.'));
  }, [wallet, refreshChain, refreshData]);

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
    setWallet(null); setSol(null); setHoldings([]); setPortfolio(null); setRules([]); setActivities([]); setTrades([]); setQuote(null);
  };

  const refreshAll = async () => {
    if (!wallet) return connectWallet();
    setBusy(true); setError(null);
    try { await Promise.all([refreshChain(wallet), refreshData(wallet), refreshPrices()]); setMessage('Chain, Mainnet reference prices and portfolio state refreshed.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Refresh failed.'); }
    finally { setBusy(false); }
  };

  const knownHoldings = useMemo(() => holdings.filter((holding) => holding.assetId), [holdings]);
  const cashHolding = holdings.find((holding) => holding.mint === DEVNET_CASH_MINT);
  const cashValue = Number(cashHolding?.amount ?? 0);
  const positions = useMemo(() => knownHoldings.flatMap((holding) => {
    const asset = DEVNET_ASSETS.find((item) => item.id === holding.assetId);
    const price = asset ? referencePrices[asset.referenceSymbol]?.priceUsd : undefined;
    if (!asset || !Number.isFinite(price) || price <= 0) return [];
    return [{ assetId: asset.id, symbol: asset.symbol, valueUsd: Number(holding.amount) * price }];
  }), [knownHoldings, referencePrices]);
  const rulesConfig: PortfolioRules = useMemo(() => ({
    ...DEFAULT_PORTFOLIO_RULES,
    maxSingleAssetPct: rulesForm.max,
    minReservePct: rulesForm.reserve,
    rebalanceThresholdPct: rulesForm.threshold,
    targetAllocations: targets,
  }), [rulesForm.max, rulesForm.reserve, rulesForm.threshold, targets]);
  const evaluation = useMemo(() => evaluatePortfolio(positions, cashValue, rulesConfig), [positions, cashValue, rulesConfig]);

  const requestQuote = async () => {
    const amount = Number(tradeAmount);
    if (!wallet) return setError('Connect your Devnet wallet first.');
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter a valid positive asset amount.');
    setError(null); setMessage(null);
    try {
      const response = await fetch(apiUrl(`/api/devnet/quote?assetId=${encodeURIComponent(selectedAssetId)}&side=${tradeSide}&amount=${encodeURIComponent(String(amount))}`), { cache: 'no-store' });
      const result = await response.json() as DevnetQuote & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to get quote.');
      setQuote(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to get quote.'); }
  };

  const requestFaucet = async () => {
    if (!wallet) return setError('Connect a wallet first.');
    setFunding(true); setError(null); setMessage(null);
    try {
      const response = await fetch(apiUrl('/api/devnet/faucet'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet }) });
      const result = await response.json() as { error?: string; amount?: number; signature?: string };
      if (!response.ok || !result.signature) throw new Error(result.error || 'Demo funding failed');
      await refreshChain(wallet); await refreshData(wallet);
      setMessage(`1,000 ${DEVNET_CASH_SYMBOL} funded and confirmed on Devnet.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Demo funding failed.'); }
    finally { setFunding(false); }
  };

  const executeQuote = async (nextQuote: DevnetQuote) => {
    if (!wallet) throw new Error('Connect your wallet first.');
    const p = provider();
    if (!p?.signTransaction || p.publicKey?.toBase58() !== wallet) throw new Error('Wallet signing is unavailable or no longer connected.');
    if (Date.parse(nextQuote.expiresAt) <= Date.now()) throw new Error('Quote expired.');

    await recordTradeIntent(wallet, { quoteId: nextQuote.quoteId, assetId: nextQuote.assetId, side: nextQuote.side, assetAmountUnits: nextQuote.assetAmountUnits, cashAmountUnits: nextQuote.cashAmountUnits, status: 'payment_pending' });
    let paymentSignature: string | undefined;
    try {
      const result = await executeDevnetTrade(nextQuote, p);
      paymentSignature = result.paymentSignature;
      await recordTradeIntent(wallet, { quoteId: nextQuote.quoteId, assetId: nextQuote.assetId, side: nextQuote.side, assetAmountUnits: nextQuote.assetAmountUnits, cashAmountUnits: nextQuote.cashAmountUnits, status: 'settled', paymentSignature: result.paymentSignature, settlementSignature: result.settlementSignature });
      await recordActivity(wallet, { eventType: `trade_${nextQuote.side}`, signature: result.settlementSignature, payload: { paymentSignature: result.paymentSignature, quoteId: nextQuote.quoteId, assetId: nextQuote.assetId, assetAmountUnits: nextQuote.assetAmountUnits, cashAmountUnits: nextQuote.cashAmountUnits, source: 'manual-or-rule', referencePriceSource: nextQuote.referencePriceSource, referenceObservedAt: nextQuote.referenceObservedAt, referenceNetwork: nextQuote.referenceNetwork } });
      return result;
    } catch (cause) {
      await recordTradeIntent(wallet, { quoteId: nextQuote.quoteId, assetId: nextQuote.assetId, side: nextQuote.side, assetAmountUnits: nextQuote.assetAmountUnits, cashAmountUnits: nextQuote.cashAmountUnits, status: paymentSignature ? 'settlement_pending' : 'failed', paymentSignature, errorMessage: cause instanceof Error ? cause.message : 'Trade failed' }).catch(() => undefined);
      throw cause;
    }
  };

  const executeManualTrade = async () => {
    if (!quote) return setError('Request a quote first.');
    setBusy(true); setError(null); setMessage(null);
    try { await executeQuote(quote); await Promise.all([refreshChain(wallet!), refreshData(wallet!), refreshPrices()]); setQuote(null); setMessage(`${quote.side === 'buy' ? 'Buy' : 'Sell'} confirmed on Devnet using the current Mainnet reference price.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Trade failed.'); await Promise.all([refreshChain(wallet!), refreshData(wallet!), refreshPrices()]).catch(() => undefined); }
    finally { setBusy(false); }
  };

  const executeProposal = async (proposal: RuleProposal) => {
    if (!wallet || !proposal.assetId) return setError('This proposal does not map to a directly executable asset action.');
    const asset = DEVNET_ASSETS.find((candidate) => candidate.id === proposal.assetId);
    if (!asset) return setError('Proposal asset is not configured.');
    if (proposal.kind === 'buy-underweight' && evaluation.cashPct < rulesConfig.minReservePct) return setError('The current cash reserve is already below its minimum; sell or fund the wallet before buying.');
    const price = referencePrices[asset.referenceSymbol]?.priceUsd;
    if (!Number.isFinite(price) || price <= 0) return setError(`Mainnet reference price for ${asset.referenceSymbol} is unavailable. Refresh prices before executing the proposal.`);
    const quantity = proposal.valueUsd / price;
    if (!Number.isFinite(quantity) || quantity <= 0) return setError('Proposal amount is too small to execute.');
    if (!window.confirm(`Authorize ${proposal.kind === 'sell-overweight' ? 'selling' : 'buying'} approximately ${quantity.toFixed(6)} ${asset.referenceSymbol}? Your wallet will sign a real Devnet transaction priced from the current Mainnet reference.`)) return;

    setBusy(true); setError(null); setMessage(null);
    try {
      const side: TradeSide = proposal.kind === 'sell-overweight' ? 'sell' : 'buy';
      const response = await fetch(apiUrl(`/api/devnet/quote?assetId=${encodeURIComponent(asset.id)}&side=${side}&amount=${encodeURIComponent(String(quantity))}`), { cache: 'no-store' });
      const nextQuote = await response.json() as DevnetQuote & { error?: string };
      if (!response.ok) throw new Error(nextQuote.error || 'Unable to create proposal execution quote.');
      await executeQuote(nextQuote);
      await recordActivity(wallet, { eventType: 'rule_proposal_executed', signature: undefined, payload: { proposalId: proposal.id, kind: proposal.kind, assetId: proposal.assetId, targetPct: proposal.targetPct, valueUsd: proposal.valueUsd, referencePriceSource: nextQuote.referencePriceSource, referenceObservedAt: nextQuote.referenceObservedAt } });
      await Promise.all([refreshChain(wallet), refreshData(wallet), refreshPrices()]);
      setMessage(`Rule action executed for ${asset.referenceSymbol}. Devnet settlement used the current Mainnet reference price.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Rule execution failed.'); await Promise.all([refreshChain(wallet), refreshData(wallet), refreshPrices()]).catch(() => undefined); }
    finally { setBusy(false); }
  };

  const saveAllRules = async () => {
    if (!wallet || !portfolio) return setError('Connect your wallet first.');
    const max = Math.min(100, Math.max(1, Number(rulesForm.max)));
    const reserve = Math.min(100, Math.max(0, Number(rulesForm.reserve)));
    const threshold = Math.min(50, Math.max(0.1, Number(rulesForm.threshold)));
    const contribution = Math.max(0, Number(rulesForm.contribution));
    const cleanTargets = Object.fromEntries(Object.entries(targets).filter(([, value]) => Number(value) > 0).map(([key, value]) => [key, Math.min(100, Math.max(0, Number(value)))]));
    const targetTotal = Object.values(cleanTargets).reduce((sum, value) => sum + value, 0);
    if (targetTotal > 100) return setError('Target allocations cannot exceed 100%.');

    setBusy(true); setError(null); setMessage(null);
    try {
      const definitions = [
        ['max_allocation', max],
        ['min_cash_reserve', reserve],
        ['rebalance_threshold', threshold],
        ['recurring_contribution', contribution],
      ] as const;
      const saved: PersistedRule[] = [];
      for (const [ruleType, value] of definitions) saved.push(await saveRule(wallet, { portfolioId: portfolio.id, ruleType, enabled: true, parameters: { value } }));
      saved.push(await saveRule(wallet, { portfolioId: portfolio.id, ruleType: 'target_allocation', enabled: targetTotal > 0, parameters: { allocations: cleanTargets } }));
      setRules(saved); setRulesForm({ max, reserve, threshold, contribution }); setTargets(cleanTargets); setMessage('Rules and target allocations saved to Supabase.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save rules.'); }
    finally { setBusy(false); }
  };

  const savePortfolioSettings = async () => {
    if (!wallet) return setError('Connect your wallet first.');
    setBusy(true); setError(null);
    try { const saved = await savePortfolio(wallet, { id: portfolio?.id, name: portfolioName, description: portfolioDescription }); setPortfolio(saved); setMessage('Portfolio settings saved.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save portfolio.'); }
    finally { setBusy(false); }
  };

  const renderOverview = () => <div className="grid">
    <div className="hero-card"><div><div className="eyebrow">PORTFOLIO STATE · SOLANA DEVNET</div><div className="hero-number">${evaluation.totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><p>Portfolio value uses confirmed Devnet balances and live Mainnet xStock reference prices. Execution remains on Devnet.</p></div><button className="primary-button" onClick={refreshAll} disabled={busy}>{busy ? 'Working…' : wallet ? 'Refresh state' : 'Connect wallet'}</button></div>
    <div className="metrics"><div className="metric"><span>DEMO-USDC</span><strong>{cashHolding?.amount ?? '0'}</strong><small>Confirmed Devnet token balance</small></div><div className="metric"><span>DEVNET SOL</span><strong>{wallet && sol !== null ? sol.toFixed(4) : '—'}</strong><small>Network fee balance</small></div><div className="metric"><span>POSITIONS</span><strong>{knownHoldings.length}</strong><small>On-chain synthetic assets</small></div><div className="metric"><span>PRICES</span><strong>{Object.keys(referencePrices).length}/{DEVNET_ASSETS.length}</strong><small>Mainnet Jupiter references</small></div></div>
    <div className="panel split"><div><div className="eyebrow">PROGRAMMABLE PORTFOLIO</div><h2>Chain truth → rules → explicit authorization</h2><p>The rule engine never silently moves funds. Every proposal becomes a visible action that must be authorized by the wallet.</p></div><div className="flow"><span>Wallet</span><b>→</b><span>Observe</span><b>→</b><span>Evaluate</span><b>→</b><span>Authorize</span><b>→</b><span>Settle</span></div></div>
    <div className="panel"><div className="panel-head"><div><div className="eyebrow">HEALTH</div><h2>{rpcStatus === 'online' ? 'Solana Devnet online' : rpcStatus === 'offline' ? 'RPC unavailable' : 'Checking RPC'}</h2></div><button className="secondary-button" onClick={requestFaucet} disabled={!wallet || funding}>{funding ? 'Funding…' : 'Fund 1,000 DEMO-USDC'}</button></div>{wallet ? <p>{shortAddress(wallet)} · {evaluation.proposals.length} current proposals · {evaluation.violations.length} violations · {Object.keys(referencePrices).length} live Mainnet prices loaded.</p> : <p>Connect a Devnet wallet to read real token balances.</p>}{wallet && <a className="explorer-link" href={explorerAddressUrl(wallet)} target="_blank" rel="noreferrer">Verify wallet on Solana Explorer ↗</a>}</div>
  </div>;

  const renderDiscover = () => { const selected = DEVNET_ASSETS.find((asset) => asset.id === selectedAssetId) ?? DEVNET_ASSETS[0]; const selectedPrice = referencePrices[selected.referenceSymbol]?.priceUsd; return <div className="grid"><div className="panel"><div className="eyebrow">DISCOVER</div><h2>Synthetic tokenized-stock demos</h2><p>These assets exist only on Solana Devnet. Their displayed/reference prices are sourced from real Mainnet xStock markets; no Mainnet trade is executed by the demo.</p><div className="asset-grid">{DEVNET_ASSETS.map((asset) => { const price = referencePrices[asset.referenceSymbol]?.priceUsd; return <button key={asset.id} className={selectedAssetId === asset.id ? 'asset-card selected' : 'asset-card'} onClick={() => { setSelectedAssetId(asset.id); setQuote(null); }}><span>{asset.referenceSymbol}</span><strong>{asset.symbol}</strong><small>{price ? `$${price.toFixed(2)} Mainnet reference` : 'Mainnet price unavailable'}</small></button>; })}</div></div><div className="panel trade-panel"><div className="trade-head"><div><div className="eyebrow">EXECUTION TICKET · DEVNET</div><h2>{selected.symbol}</h2><small>{selectedPrice ? `$${selectedPrice.toFixed(2)} Mainnet reference` : 'Mainnet reference unavailable'}</small></div><div className="side-toggle"><button className={tradeSide === 'buy' ? 'selected-side' : ''} onClick={() => { setTradeSide('buy'); setQuote(null); }}>Buy</button><button className={tradeSide === 'sell' ? 'selected-side' : ''} onClick={() => { setTradeSide('sell'); setQuote(null); }}>Sell</button></div></div><label>Asset quantity<input inputMode="decimal" value={tradeAmount} onChange={(event) => { setTradeAmount(event.target.value); setQuote(null); }} /></label>{quote && <div className="quote-box"><div><span>Mainnet reference</span><strong>${quote.referencePriceUsd.toFixed(2)}</strong></div><div><span>Devnet execution</span><strong>${quote.executionPriceUsd.toFixed(2)}</strong></div><div><span>{quote.side === 'buy' ? 'You pay' : 'You receive'}</span><strong>{quote.cashAmount.toFixed(2)} DEMO-USDC</strong></div><div><span>Reference source</span><strong>Jupiter / Mainnet</strong></div></div>}<div className="trade-actions"><button className="secondary-button" onClick={requestQuote} disabled={busy}>Get quote</button><button className="primary-button" onClick={executeManualTrade} disabled={!quote || busy}>{busy ? 'Settling…' : `${tradeSide === 'buy' ? 'Buy' : 'Sell'} ${selected.referenceSymbol}`}</button></div></div></div>; };

  const renderPortfolio = () => <div className="grid"><div className="panel"><div className="eyebrow">PORTFOLIO SETTINGS</div><h2>{portfolio?.name ?? 'My Portfolio'}</h2><label>Portfolio name<input value={portfolioName} onChange={(event) => setPortfolioName(event.target.value)} /></label><label>Description<textarea value={portfolioDescription} onChange={(event) => setPortfolioDescription(event.target.value)} /></label><button className="primary-button" onClick={savePortfolioSettings} disabled={busy}>Save portfolio</button></div><div className="panel"><div className="eyebrow">CONFIRMED POSITIONS</div><h2>${evaluation.totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>{knownHoldings.length === 0 && <p>No positions yet. Fund Demo-USDC and buy an asset from Discover.</p>}{knownHoldings.map((holding) => { const asset = DEVNET_ASSETS.find((item) => item.id === holding.assetId)!; const price = referencePrices[asset.referenceSymbol]?.priceUsd ?? 0; const value = Number(holding.amount) * price; const pct = evaluation.totalValueUsd ? value / evaluation.totalValueUsd * 100 : 0; return <div className="holding-row" key={holding.mint}><div><strong>{asset.symbol}</strong><small>{Number(holding.amount).toLocaleString()} units · {pct.toFixed(1)}% of portfolio · ${price.toFixed(2)} Mainnet reference</small></div><strong>${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>; })}</div></div>;

  const renderRules = () => <div className="grid"><div className="panel"><div className="eyebrow">PROGRAMMABLE INVESTING</div><h2>Rules & target allocations</h2><p>Saving these values changes configuration only. Execution always requires an explicit wallet authorization.</p><div className="rule-form"><label>Maximum single asset %<input type="number" min="1" max="100" value={rulesForm.max} onChange={(event) => setRulesForm({ ...rulesForm, max: Number(event.target.value) })} /></label><label>Minimum cash reserve %<input type="number" min="0" max="100" value={rulesForm.reserve} onChange={(event) => setRulesForm({ ...rulesForm, reserve: Number(event.target.value) })} /></label><label>Rebalance threshold %<input type="number" min="0.1" max="50" value={rulesForm.threshold} onChange={(event) => setRulesForm({ ...rulesForm, threshold: Number(event.target.value) })} /></label><label>Recurring contribution target $<input type="number" min="0" value={rulesForm.contribution} onChange={(event) => setRulesForm({ ...rulesForm, contribution: Number(event.target.value) })} /></label></div><div className="eyebrow" style={{ marginTop: 20 }}>TARGET WEIGHTS</div>{DEVNET_ASSETS.map((asset) => <label key={asset.id}>{asset.referenceSymbol} target %<input type="number" min="0" max="100" value={targets[asset.id] ?? 0} onChange={(event) => setTargets({ ...targets, [asset.id]: Number(event.target.value) })} /></label>)}<button className="primary-button" onClick={saveAllRules} disabled={busy || !wallet}>{busy ? 'Saving…' : 'Save rules'}</button></div>
    <div className="panel"><div className="eyebrow">CURRENT EVALUATION</div><h2>{evaluation.proposals.length} actionable proposals</h2>{evaluation.violations.length === 0 ? <p>No active violations in the current on-chain state.</p> : evaluation.violations.map((violation) => <div className="activity-row" key={violation}><strong>{violation}</strong></div>)}{evaluation.proposals.map((proposal) => <div className="activity-row" key={proposal.id}><div><strong>{proposal.symbol ?? 'Cash reserve'}</strong><small>{proposal.reason}</small></div><div><strong>${proposal.valueUsd.toFixed(2)}</strong>{proposal.assetId && <button className="secondary-button" onClick={() => executeProposal(proposal)} disabled={busy} style={{ marginTop: 8 }}>Authorize & execute</button>}</div></div>)}</div></div>;

  const renderActivity = () => <div className="grid"><div className="panel"><div className="eyebrow">AUDIT TRAIL</div><h2>Persistent activity</h2>{activities.length === 0 ? <p>No persisted activity for this wallet yet.</p> : activities.map((item) => <div className="activity-row" key={item.id}><div><strong>{item.event_type}</strong><small>{new Date(item.created_at).toLocaleString()}</small></div>{item.signature && <a className="explorer-link" href={explorerTxUrl(item.signature)} target="_blank" rel="noreferrer">View tx ↗</a>}</div>)}</div><div className="panel"><div className="eyebrow">TRADE LIFECYCLE</div><h2>Execution records</h2>{trades.length === 0 ? <p>No trade intents for this wallet.</p> : trades.map((trade) => <div className="activity-row" key={trade.id}><div><strong>{trade.side.toUpperCase()} {trade.symbol}</strong><small>{trade.status} · {new Date(trade.createdAt).toLocaleString()}</small></div><div className="activity-links">{trade.paymentSignature && <a href={explorerTxUrl(trade.paymentSignature)} target="_blank" rel="noreferrer">payment ↗</a>}{trade.settlementSignature && <a href={explorerTxUrl(trade.settlementSignature)} target="_blank" rel="noreferrer">settlement ↗</a>}</div></div>)}</div></div>;

  const renderPassport = () => <div className="grid"><div className="hero-card"><div><div className="eyebrow">STOCKPASSPORT</div><h2>Portable portfolio record</h2><p>{wallet ? `Wallet ${shortAddress(wallet)} · ${knownHoldings.length} live positions · ${rules.length} saved rules · ${activities.length} indexed events.` : 'Connect a wallet to build a verifiable record from actual Devnet state.'}</p></div></div><div className="panel"><div className="eyebrow">PASSPORT CONTENT</div><div className="holding-row"><span>Network</span><strong>Solana Devnet</strong></div><div className="holding-row"><span>Ownership source</span><strong>On-chain token accounts</strong></div><div className="holding-row"><span>Price source</span><strong>Solana Mainnet · Jupiter</strong></div><div className="holding-row"><span>Execution source</span><strong>Solana Devnet · synthetic assets</strong></div><div className="holding-row"><span>Configuration source</span><strong>Supabase</strong></div><div className="holding-row"><span>Portfolio</span><strong>{portfolio?.name ?? 'Not created'}</strong></div><div className="holding-row"><span>Current proposals</span><strong>{evaluation.proposals.length}</strong></div>{wallet && <a className="explorer-link" href={explorerAddressUrl(wallet)} target="_blank" rel="noreferrer">Verify wallet on Explorer ↗</a>}</div></div>;

  const page = active === 'Overview' ? renderOverview() : active === 'Discover' ? renderDiscover() : active === 'Portfolio' ? renderPortfolio() : active === 'Rules' ? renderRules() : active === 'Activity' ? renderActivity() : renderPassport();
  return <div className="shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">SP</div><span>StockPassport</span></div><nav>{NAV.map((item) => <button key={item} className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item)}>{item}</button>)}</nav><div className="sidebar-foot"><span className={`status-dot ${rpcStatus}`} /> {rpcStatus === 'online' ? 'Solana Devnet online' : rpcStatus === 'offline' ? 'RPC unavailable' : 'Checking RPC'}</div></aside><main className="main"><header className="topbar"><div><div className="eyebrow">STOCKPASSPORT / {active.toUpperCase()}</div><h1>{active}</h1></div><div className="topbar-actions">{wallet ? <button className="wallet-button" onClick={disconnectWallet}>{shortAddress(wallet)}</button> : <button className="wallet-button" onClick={connectWallet} disabled={busy}>{busy ? 'Connecting…' : 'Connect wallet'}</button>}</div></header><section className="content">{message && <div className="notice"><div><strong>{message}</strong><p>State is sourced from Solana and/or persisted application records.</p></div></div>}{error && <div className="error-banner">{error}</div>}{page}</section>{wallet && <a className="wallet-state" href={explorerAddressUrl(wallet)} target="_blank" rel="noreferrer">{shortAddress(wallet)} · Devnet ↗</a>}</main></div>;
}
