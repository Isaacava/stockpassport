import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { DEVNET_CONNECTION, explorerTxUrl, getDevnetBalance } from './lib/solana';

type WalletState = {
  address: string;
  sol: number;
};

const nav = ['Overview', 'Discover', 'Portfolio', 'Rules', 'Activity'];

function App() {
  const [active, setActive] = useState('Overview');
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [rpcStatus, setRpcStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    DEVNET_CONNECTION.getEpochInfo()
      .then(() => setRpcStatus('online'))
      .catch(() => setRpcStatus('offline'));
  }, []);

  async function connectWallet() {
    const provider = (window as Window & {
      solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: PublicKey }> };
    }).solana;

    if (!provider?.connect) {
      window.alert('Install a Solana wallet extension/app that exposes window.solana.');
      return;
    }

    setConnecting(true);
    try {
      const response = await provider.connect();
      const address = response.publicKey.toBase58();
      const sol = await getDevnetBalance(address);
      setWallet({ address, sol });
    } finally {
      setConnecting(false);
    }
  }

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
          <button className="wallet-button" onClick={connectWallet} disabled={connecting}>
            {connecting ? 'Connecting…' : wallet ? `${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}` : 'Connect wallet'}
          </button>
        </header>

        <section className="content">
          <div className="notice">
            <div>
              <strong>Foundation first</strong>
              <p>Real Devnet state will drive balances and transactions. Synthetic test assets will be clearly labeled; live/reference market data stays separate.</p>
            </div>
            <div className="rpc-pill">{rpcStatus === 'online' ? 'RPC ONLINE' : rpcStatus === 'offline' ? 'RPC OFFLINE' : 'CHECKING RPC'}</div>
          </div>

          {active === 'Overview' && (
            <div className="grid">
              <div className="hero-card">
                <div>
                  <div className="eyebrow">PORTFOLIO STATE</div>
                  <div className="hero-number">$0.00</div>
                  <p>No holdings yet. Connect a Devnet wallet to start the real on-chain flow.</p>
                </div>
                <button className="primary-button" onClick={connectWallet} disabled={connecting}>{wallet ? 'Wallet connected' : 'Connect wallet'}</button>
              </div>

              <div className="metrics">
                <div className="metric"><span>Wallet SOL</span><strong>{wallet ? wallet.sol.toFixed(4) : '—'}</strong><small>Devnet balance</small></div>
                <div className="metric"><span>Holdings</span><strong>0</strong><small>Derived from token accounts</small></div>
                <div className="metric"><span>Active rules</span><strong>0</strong><small>Portfolio configuration</small></div>
                <div className="metric"><span>Network</span><strong>Devnet</strong><small>Confirmed RPC state</small></div>
              </div>

              <div className="panel split">
                <div>
                  <div className="eyebrow">SOURCE OF TRUTH</div>
                  <h2>On-chain first</h2>
                  <p>Wallet and token-account state will be authoritative. UI caches are never allowed to invent ownership.</p>
                </div>
                <div className="flow">
                  <span>Wallet</span><b>→</b><span>Token accounts</span><b>→</b><span>Portfolio</span><b>→</b><span>Rules</span><b>→</b><span>Transaction</span>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head"><div><div className="eyebrow">NEXT BUILD</div><h2>Real transaction path</h2></div></div>
                <ol className="steps">
                  <li><span>01</span><div><strong>Connect wallet</strong><small>Read the actual Devnet public key and SOL balance.</small></div></li>
                  <li><span>02</span><div><strong>Read synthetic token accounts</strong><small>Discover real Demo-USDC and Demo-stock balances.</small></div></li>
                  <li><span>03</span><div><strong>Build quote</strong><small>Reference market data + exact token quantity.</small></div></li>
                  <li><span>04</span><div><strong>Sign & confirm</strong><small>Submit a real Solana transaction and verify final state.</small></div></li>
                </ol>
              </div>
            </div>
          )}

          {active !== 'Overview' && (
            <div className="panel empty-panel">
              <div className="eyebrow">SCAFFOLD</div>
              <h2>{active} module</h2>
              <p>The navigation is intentionally wired before the feature layer. This module will consume the same real on-chain state and adapter interfaces instead of keeping a second fake data model.</p>
            </div>
          )}
        </section>

        {wallet && (
          <a className="wallet-state" href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noreferrer">
            <span className="status-dot online" />
            {wallet.address.slice(0, 6)}…{wallet.address.slice(-6)} · {wallet.sol.toFixed(4)} SOL · Open Devnet Explorer ↗
          </a>
        )}
      </main>
    </div>
  );
}

export default App;

export function safePublicKey(value: string): PublicKey | null {
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

export function transactionExplorer(signature: string): string {
  return explorerTxUrl(signature);
}
