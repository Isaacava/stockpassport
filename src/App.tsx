import { useCallback, useEffect, useMemo, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { DEVNET_ASSETS, DEVNET_CASH_MINT, DEVNET_CASH_SYMBOL } from './config/assets';
import { explorerAddressUrl, explorerTxUrl, CONNECTION } from './config/network';
import { getDevnetTokenHoldings, type TokenHolding } from './lib/tokens';
import { executeDevnetTrade, getDevnetQuote, type DevnetQuote, type TradeSide, type WalletSigner } from './lib/execution';

type WalletProvider = WalletSigner & {
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect?: () => Promise<void>;
};

type WindowWithSolana = Window & { solana?: WalletProvider };

type Activity = {
  id: string;
  time: string;
  side: TradeSide | 'faucet';
  symbol: string;
  amount: string;
  cash: string;
  paymentSignature?: string;
  settlementSignature?: string;
};

const nav = ['Overview', 'Discover', 'Portfolio', 'Rules', 'Activity', 'Passport'];
const DEMO_PRICES: Record<string, number> = { NVDA: 175, AAPL: 230, MSFT: 510, GOOG: 250 };

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function useWalletProvider(): WalletProvider | undefined {
  return (window as WindowWithSolana).solana;
}

function App() {
  const [active, setActive] = useState('Overview');
  const [wallet, setWallet] = useState<string | null>(null);
  const [sol, setSol] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyTrade, setBusyTrade] = useState(false);
  const [funding, setFunding] = useState(false);
  const [rpcStatus, setRpcStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [error, setError] = useState<string | null>(null);
  const [tradeSide, setTradeSide] = useState<TradeSide>('buy');
  const [selectedAssetId, setSelectedAssetId] = useState(DEVNET_ASSETS[0]?.id ?? '');
  const [tradeAmount, setTradeAmount] = useState('1');
  const [quote, setQuote] = useState<DevnetQuote | null>(null);
  const [activities, setActivities] = useState<Activity[]>(() => {
    try { return JSON.parse(localStorage.getItem('stockpassport_activity') || '[]') as Activity[]; } catch { return []; }
  });

  const refreshOnChainState = useCallback(async (address: string) => {
    setRefreshing(true);
    setError(null);
    try {
      const publicKey = new PublicKey(address);
      const [balance, tokenHoldings] = await Promise.all([
        CONNECTION.getBalance(publicKey, 'confirmed'),
        getDevnetTokenHoldings(address),
      ]);
      setSol(balance / 1_000_000_000);
      setHoldings(tokenHoldings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to read Devnet state.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    CONNECTION.getEpochInfo().then(() => setRpcStatus('online')).catch(() => setRpcStatus('offline'));
  }, []);

  useEffect(() => {
    localStorage.setItem('stockpassport_activity', JSON.stringify(activities.slice(0, 30)));
  }, [activities]);

  const knownHoldings = holdings.filter((holding) => holding.assetId);
  const cashHolding = holdings.find((holding) => holding.mint === DEVNET_CASH_MINT);
  const portfolioValue = useMemo(() => knownHoldings.reduce((total, holding) => {
    const asset = DEVNET_ASSETS.find((item) => item.id === holding.assetId);
    return total + Number(holding.amount) * (asset ? DEMO_PRICES[asset.referenceSymbol] ?? 0 : 0);
  }, 0), [knownHoldings]);

  async function connectWallet() {
    const provider = useWalletProvider();
    if (!provider?.connect || !provider.signTransaction) {
      setError('A Solana wallet with transaction signing support was not found. Switch the wallet to Devnet.');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const response = await provider.connect();
      const address = response.publicKey.toBase58();
      setWallet(address);
      await refreshOnChainState(address);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Wallet connection failed.');
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectWallet() {
    const provider = useWalletProvider();
    if (provider?.disconnect) await provider.disconnect();
    setWallet(null); setSol(null); setHoldings([]); setQuote(null);
  }

  async function requestQuote(side = tradeSide) {
    const amount = Number(tradeAmount);
    if (!selectedAssetId || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid positive asset amount.');
      return;
    }
    try {
      setError(null);
      const nextQuote = await getDevnetQuote(selectedAssetId, side, amount);
      setQuote(nextQuote);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to get quote.');
    }
  }

  async function requestFaucet() {
    if (!wallet) return setError('Connect a wallet first.');
    setFunding(true); setError(null);
    try {
      const response = await fetch('/api/devnet/faucet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet }) });
      const result = await response.json() as { error?: string; amount?: number; signature?: string };
      if (!response.ok || !result.signature) throw new Error(result.error || 'Demo funding failed');
      await refreshOnChainState(wallet);
      setActivities((previous) => [{ id: crypto.randomUUID(), time: new Date().toISOString(), side: 'faucet', symbol: DEVNET_CASH_SYMBOL, amount: String(result.amount ?? 1000), cash: '1000 DEMO-USDC', settlementSignature: result.signature }, ...previous]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Demo funding failed.');
    } finally {
      setFunding(false);
    }
  }

  async function executeTrade() {
    if (!wallet || !quote) return setError('Connect wallet and request a fresh quote first.');
    const provider = useWalletProvider();
    if (!provider?.signTransaction || provider.publicKey?.toBase58() !== wallet) return setError('Wallet signing is unavailable or no longer connected.');
    if (Date.parse(quote.expiresAt) <= Date.now()) return setError('Quote expired. Request a new quote.');

    setBusyTrade(true); setError(null);
    try {
      const result = await executeDevnetTrade(quote, provider);
      await refreshOnChainState(wallet);
      setActivities((previous) => [{
        id: quote.quoteId,
        time: new Date().toISOString(),
        side: quote.side,
        symbol: quote.referenceSymbol,
        amount: String(quote.assetAmount),
        cash: `${quote.cashAmount.toFixed(2)} DEMO-USDC`,
        paymentSignature: result.paymentSignature,
        settlementSignature: result.settlementSignature,
      }, ...previous]);
      setQuote(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Trade failed.');
      if (wallet) await refreshOnChainState(wallet);
    } finally {
      setBusyTrade(false);
    }
  }

  function renderOverview() {
    return <div className="grid">
      <div className="hero-card">
        <div><div className="eyebrow">PORTFOLIO STATE · DEVNET</div><div className="hero-number">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><p>Valuation is derived from confirmed token balances and controlled Devnet reference prices. The prices are demo references, not live securities prices.</p></div>
        <button className="primary-button" onClick={wallet ? () => refreshOnChainState(wallet) : connectWallet} disabled={connecting || refreshing}>{wallet ? (refreshing ? 'Reading chain…' : 'Refresh chain') : 'Connect wallet'}</button>
      </div>
      <div className="metrics">
        <div className="metric"><span>Demo-USDC</span><strong>{cashHolding?.amount ?? '0'}</strong><small>Confirmed token-account balance</small></div>
        <div className="metric"><span>Wallet SOL</span><strong>{wallet && sol !== null ? sol.toFixed(4) : '—'}</strong><small>Confirmed Devnet balance</small></div>
        <div className="metric"><span>Positions</span><strong>{knownHoldings.length}</strong><small>Known synthetic assets</small></div>
        <div className="metric"><span>Rules</span><strong>0</strong><small>Programmable rules wired next</small></div>
      </div>
      <div className="panel split"><div><div className="eyebrow">CORE FLOW</div><h2>Wallet → Portfolio → Rules → Execution</h2><p>The portfolio layer reads chain state. Rules will produce deterministic proposals. Execution is explicit and signed.</p></div><div className="flow"><span>Confirmed balances</span><b>→</b><span>Valuation</span><b>→</b><span>Rule proposal</span><b>→</b><span>Signed tx</span></div></div>
      <div className="panel"><div className="panel-head"><div><div className="eyebrow">ON-CHAIN HOLDINGS</div><h2>Observed state</h2></div><button className="secondary-button" onClick={requestFaucet} disabled={!wallet || funding}>{funding ? 'Funding…' : 'Get 1,000 demo USDC'}</button></div>{!wallet && <p>Connect a Devnet wallet to read token accounts.</p>}{wallet && knownHoldings.length === 0 && <p>No synthetic positions yet. Use Discover to buy one after funding the demo wallet.</p>}{knownHoldings.map((holding) => <div className="holding-row" key={holding.mint}><div><strong>{holding.symbol}</strong><small>{holding.mint}</small></div><strong>{holding.amount}</strong></div>)}{wallet && <a className="explorer-link" href={explorerAddressUrl(wallet)} target="_blank" rel="noreferrer">Open wallet on Explorer ↗</a>}</div>
    </div>;
  }

  function renderDiscover() {
    const selected = DEVNET_ASSETS.find((asset) => asset.id === selectedAssetId) ?? DEVNET_ASSETS[0];
    return <div className="grid"><div className="panel"><div className="eyebrow">DISCOVER · SYNTHETIC DEVNET ASSETS</div><h2>Trade the real on-chain demo path</h2><p>These tokens are synthetic Devnet assets created for the hackathon demonstration. They do not represent real equity ownership.</p><div className="asset-grid">{DEVNET_ASSETS.map((asset) => <button key={asset.id} className={selectedAssetId === asset.id ? 'asset-card selected' : 'asset-card'} onClick={() => { setSelectedAssetId(asset.id); setQuote(null); }}><span>{asset.referenceSymbol}</span><strong>{asset.symbol}</strong><small>${DEMO_PRICES[asset.referenceSymbol].toFixed(2)} reference</small></button>)}</div></div><div className="panel trade-panel"><div className="trade-head"><div><div className="eyebrow">EXECUTION</div><h2>{selected?.symbol ?? 'Asset'}</h2></div><div className="side-toggle"><button className={tradeSide === 'buy' ? 'selected-side' : ''} onClick={() => { setTradeSide('buy'); setQuote(null); }}>Buy</button><button className={tradeSide === 'sell' ? 'selected-side' : ''} onClick={() => { setTradeSide('sell'); setQuote(null); }}>Sell</button></div></div><label>Asset amount<input inputMode="decimal" value={tradeAmount} onChange={(event) => { setTradeAmount(event.target.value); setQuote(null); }} /></label>{quote && <div className="quote-box"><div><span>Reference</span><strong>${quote.referencePriceUsd.toFixed(2)}</strong></div><div><span>Execution</span><strong>${quote.executionPriceUsd.toFixed(2)}</strong></div><div><span>{quote.side === 'buy' ? 'You pay' : 'You receive'}</span><strong>{quote.cashAmount.toFixed(2)} DEMO-USDC</strong></div><div><span>Expires</span><strong>{Math.max(0, Math.ceil((Date.parse(quote.expiresAt) - Date.now()) / 1000))}s</strong></div></div>}<div className="trade-actions"><button className="secondary-button" onClick={() => requestQuote()} disabled={busyTrade}>Get quote</button><button className="primary-button" onClick={executeTrade} disabled={!quote || busyTrade}>{busyTrade ? 'Settling…' : `${tradeSide === 'buy' ? 'Buy' : 'Sell'} ${selected?.referenceSymbol ?? ''}`}</button></div><p className="trade-note">Settlement is two confirmed on-chain legs. The app never changes a balance locally to simulate success.</p></div></div>;
  }

  function renderPortfolio() {
    return <div className="grid"><div className="panel"><div className="eyebrow">PORTFOLIO</div><h2>Confirmed positions</h2>{knownHoldings.length === 0 ? <p>No positions yet.</p> : knownHoldings.map((holding) => { const asset = DEVNET_ASSETS.find((item) => item.id === holding.assetId)!; const value = Number(holding.amount) * DEMO_PRICES[asset.referenceSymbol]; return <div className="holding-row" key={holding.mint}><div><strong>{asset.symbol}</strong><small>{Number(holding.amount).toLocaleString()} units · {asset.name}</small></div><strong>${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>; })}</div><div className="panel split"><div><div className="eyebrow">RULES PREVIEW</div><h2>Make behavior programmable</h2><p>Next: maximum single-asset allocation, minimum reserve, rebalance threshold and recurring contribution rules.</p></div><button className="primary-button" onClick={() => setActive('Rules')}>Open rules</button></div></div>;
  }

  function renderRules() {
    return <div className="grid"><div className="panel"><div className="eyebrow">RULE ENGINE · NEXT MILESTONE</div><h2>Define how the portfolio should behave</h2><p>Rules will be evaluated from fresh on-chain balances and reference prices. They create proposals only; execution still requires explicit authorization.</p><div className="rule-list"><div><strong>Max single asset</strong><span>25%</span></div><div><strong>Minimum cash reserve</strong><span>10%</span></div><div><strong>Rebalance threshold</strong><span>5%</span></div></div></div></div>;
  }

  function renderActivity() {
    return <div className="grid"><div className="panel"><div className="eyebrow">AUDIT TRAIL</div><h2>Recent on-chain actions</h2>{activities.length === 0 && <p>No actions recorded in this browser yet.</p>}{activities.map((item) => <div className="activity-row" key={item.id}><div><strong>{item.side === 'faucet' ? 'Demo funding' : `${item.side.toUpperCase()} ${item.symbol}`}</strong><small>{new Date(item.time).toLocaleString()} · {item.amount} {item.symbol}</small></div><div className="activity-links">{item.paymentSignature && <a href={explorerTxUrl(item.paymentSignature)} target="_blank" rel="noreferrer">payment ↗</a>}{item.settlementSignature && <a href={explorerTxUrl(item.settlementSignature)} target="_blank" rel="noreferrer">settlement ↗</a>}</div></div>)}</div></div>;
  }

  function renderPassport() {
    return <div className="grid"><div className="hero-card"><div><div className="eyebrow">PASSPORT</div><h2>Verifiable portfolio identity</h2><p>{wallet ? `Owner ${shortAddress(wallet)} · ${knownHoldings.length} positions · ${activities.length} recorded actions.` : 'Connect a wallet to build a verifiable portfolio passport from actual chain state.'}</p></div></div><div className="panel split"><div><div className="eyebrow">WHAT WILL LIVE HERE</div><h2>Assets, rules, executions, history</h2><p>The Passport is a human-readable representation of the portfolio configuration and audit trail. It does not duplicate token ownership.</p></div><div className="flow"><span>Assets</span><b>+</b><span>Rules</span><b>+</b><span>Executions</span><b>=</b><span>Passport</span></div></div></div>;
  }

  return <div className="shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">SP</span><span>StockPassport</span></div><div className="eyebrow">DEVNET BUILD</div><nav>{nav.map((item) => <button key={item} className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item)}>{item}</button>)}</nav><div className="sidebar-foot"><span className={rpcStatus === 'online' ? 'status-dot online' : rpcStatus === 'offline' ? 'status-dot offline' : 'status-dot'} />Solana Devnet {rpcStatus}</div></aside><main className="main"><header className="topbar"><div><div className="eyebrow">{active}</div><h1>{active === 'Overview' ? 'A programmable portfolio for tokenized stocks.' : active}</h1></div><div className="topbar-actions">{wallet && <button className="secondary-button" onClick={() => refreshOnChainState(wallet)} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>}<button className="wallet-button" onClick={wallet ? disconnectWallet : connectWallet} disabled={connecting}>{connecting ? 'Connecting…' : wallet ? shortAddress(wallet) : 'Connect wallet'}</button></div></header><section className="content">{error && <div className="error-banner">{error}</div>}<div className="notice"><div><strong>Devnet-only synthetic market</strong><p>Balances and settlement are verified from Solana. The stock-like tokens are controlled demo assets, not real securities.</p></div><div className="rpc-pill">{rpcStatus === 'online' ? 'RPC ONLINE' : rpcStatus === 'offline' ? 'RPC OFFLINE' : 'CHECKING RPC'}</div></div>{active === 'Overview' && renderOverview()}{active === 'Discover' && renderDiscover()}{active === 'Portfolio' && renderPortfolio()}{active === 'Rules' && renderRules()}{active === 'Activity' && renderActivity()}{active === 'Passport' && renderPassport()}</section></main></div>;
}

export default App;
