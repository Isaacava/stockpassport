import { useEffect, useRef, useState } from 'react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PublicKey } from '@solana/web3.js';
import { useAppKit, useAppKitAccount, useAppKitProvider, useDisconnect } from '@reown/appkit/react';
import type { Provider } from '@reown/appkit-adapter-solana/react';
import { REOWN_CONFIGURED } from './lib/appkit';
import { createReownWalletSigner, setConnectedWalletSigner, setWalletDisconnect } from './lib/wallet';
import './styles.css';
import './portfolio.css';
import PortfolioApp from './PortfolioApp';
import Landing from './Landing';

function Root() {
  const [entered, setEntered] = useState(false);
  const [signInPending, setSignInPending] = useState(false);
  const signingRef = useRef(false);
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount({ namespace: 'solana' });
  const { walletProvider } = useAppKitProvider<Provider>('solana');
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (address && walletProvider) {
      const signer = createReownWalletSigner(address, walletProvider);
      setConnectedWalletSigner(signer);
    } else {
      setConnectedWalletSigner(null);
    }
    setWalletDisconnect(async () => {
      await disconnect({ namespace: 'solana' });
    });
  }, [address, walletProvider, disconnect]);

  useEffect(() => {
    if (!signInPending || !isConnected || !address || !walletProvider || signingRef.current) return;
    signingRef.current = true;
    const signIn = async () => {
      try {
        const statement = [
          'StockPassport sign in',
          `Wallet: ${address}`,
          'Network: Solana Devnet or Testnet',
          'Purpose: Open my StockPassport portfolio',
        ].join('\n');
        await walletProvider.signMessage(new TextEncoder().encode(statement));
        sessionStorage.setItem('stockpassport.wallet', new PublicKey(address).toBase58());
        setEntered(true);
      } catch (cause) {
        window.alert(cause instanceof Error ? cause.message : 'Wallet sign-in was cancelled.');
      } finally {
        signingRef.current = false;
        setSignInPending(false);
      }
    };
    void signIn();
  }, [signInPending, isConnected, address, walletProvider]);

  const enterWithWallet = () => {
    if (!REOWN_CONFIGURED) {
      window.alert('StockPassport WalletConnect is not configured yet. Add VITE_REOWN_PROJECT_ID from your Reown project settings.');
      return;
    }
    setSignInPending(true);
    if (!isConnected) open({ view: 'Connect', namespace: 'solana' });
  };

  return entered ? <PortfolioApp /> : <Landing onEnter={enterWithWallet} />;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
