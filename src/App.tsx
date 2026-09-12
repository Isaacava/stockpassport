import { useCallback, useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { DEVNET_ASSETS } from './config/assets';
import { explorerAddressUrl, CONNECTION } from './config/network';
import { getDevnetTokenHoldings, type TokenHolding } from './lib/tokens';

type WalletProvider = {
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect?: () => Promise<void>;
};

type WindowWithSolana = Window & { solana?: WalletProvider };

const nav = ['Overview', 'Discover', 'Portfolio', 'Rules', 'Activity'];

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function App() {
  const [active, setActive] = useState('Overview');
  const [wallet, setWallet] = useState<string | null>(null);
  const [sol, setSol] = useState<number | null>(null);
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rpcStatus, setRpcStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [error, setError] = useState<string | null>(null);

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
    CONNECTION.getEpochInfo()
      .then(() => setRpcStatus('online'))
      .catch(() => setRpcStatus('offline'));
  }, []);

  async function connectWallet() {
    const provider = (window as WindowWithSolana).solana;
    if (!provider?.connect) {
      setError('No compatible Solana wallet was found. Use a wallet that exposes window.solana and switch it to Devnet.');
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
    const provider = (window as WindowWithSolana).solana;
    if (provider?.disconnect) await provider.disconnect();
    setWallet(null);
    setSol(null);
    setHoldings([]);
  }

  const knownHoldings = holdings.filter((holding) => holding.assetId);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">SP</span><span>StockPassport</span></div>
        <div className="eyebrow">DEVNET BUILD</div>
        <nav>
          {nav.map((item) => (
            <button key={item} className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item)}>
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className={rpcStatus === 'online' ? 'status-dot online' : rpcStatus === 'offline' ? 'status-dot offline' : 'status-dot'} />
          Solana Devnet {rpcStatus}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">{active}</div>
            <h1>{active === 'Overview' ? 'A programmable portfolio for tokenized stocks.' : active}</h1>
          </div>
          <div className="topbar-actions">
            {wallet && <button className="secondary-button" onClick={() => refreshOnChainState(wallet)} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh state'}</button>}
            <button className="wallet-button" onClick={wallet ? disconnectWallet : connectWallet} disabled={connecting}>
              {connecting ? 'Connecting…' : wallet ? shortAddress(wallet) : 'Connect wallet'}
            </button>
          </div>
        </header>

        <section className="content">
          {error && <div className="error-banner">{error}</div>}
          <div className="notice">
            <div>
              <strong>Devnet is authoritative</strong>
              <p>Ownership comes from confirmed Solana token-account state. Synthetic assets are test securities and never imply real-world equity ownership.</p>
            </div>
            <div className="rpc-pill">{rpcStatus === 'online' ? 'RPC ONLINE' : rpcStatus === 'offline' ? 'RPC OFFLINE' : 'CHECKING RPC'}</div>
          </div>

          {active === 'Overview' && (
            <div className="grid">
              <div className="hero-card">
                <div>
                  <div className="eyebrow">PORTFOLIO STATE</div>
                  <div className="hero-number">$0.00</div>
                  <p>{wallet ? 'Portfolio valuation will be added after reference-price and position layers are wired.' : 'Connect a Devnet wallet to begin the real on-chain flow.'}</p>
                </div>
                <button className="primary-button" onClick={wallet ? () => refreshOnChainState(wallet) : connectWallet} disabled={connecting || refreshing}>
                  {wallet ? (refreshing ? 'Reading chain…' : 'Refresh on-chain state') : 'Connect wallet'}
                </button>
              </div>

              <div className="metrics">
                <div className="metric"><span>Wallet SOL</span><strong>{wallet && sol !== null ? sol.toFixed(4) : '—'}</strong><small>Confirmed Devnet balance</small></div>
                <div className="metric"><span>Known holdings</span><strong>{knownHoldings.length}</strong><small>Derived from token accounts</small></div>
                <div className="metric"><span>Configured assets</span><strong>{DEVNET_ASSETS.length}</strong><small>Synthetic Devnet registry</small></div>
                <div className="metric"><span>Network</span><strong>Devnet</strong><small>Confirmed RPC state</small></div>
              </div>

              <div className="panel split">
                <div>
                  <div className="eyebrow">SOURCE OF TRUTH</div>
                  <h2>On-chain first</h2>
                  <p>StockPassport reads the wallet and token accounts after every confirmed transaction. Frontend state is only a presentation cache.</p>
                </div>
                <div className="flow">
                  <span>Wallet</span><b>→</b><span>Token accounts</span><b>→</b><span>Portfolio</span><b>→</b><span>Rules</span><b>→</b><span>Execution</span>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head"><div><div className="eyebrow">CURRENT DEVNET HOLDINGS</div><h2>Observed token state</h2></div></div>
                {!wallet && <p>Connect a wallet to read token accounts.</p>}
                {wallet && knownHoldings.length === 0 && <p>No configured synthetic asset balances were found in this wallet yet.</p>}
                {knownHoldings.map((holding) => (
                  <div className="holding-row" key={holding.mint}>
                    <div><strong>{holding.symbol}</strong><small>{holding.mint}</small></div>
                    <strong>{holding.amount}</strong>
                  </div>
                ))}
                {wallet && (
                  <a className="explorer-link" href={explorerAddressUrl(wallet)} target="_blank" rel="noreferrer">
                    Open wallet on Solana Explorer ↗
                  </a>
                )}
              </div>
            </div>
          )}

          {active !== 'Overview' && (
            <div className="panel empty-panel">
              <div className="eyebrow">SCAFFOLD</div>
              <h2>{active} module</h2>
              <p>This module will consume the same authoritative on-chain layer rather than introducing a separate fake balance model.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
