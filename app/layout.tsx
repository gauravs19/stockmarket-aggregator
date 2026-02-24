import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import HeaderControls from './HeaderControls';
import TopNav from './TopNav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Market Signal | Finance Aggregator',
  description: 'Fast, minimal macro and micro factors driving the stock market.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="layout">
          <header className="header">
            <div className="header-content">
              <h1><span className="logo-accent">▲</span> Market Signal</h1>
              <Suspense fallback={<nav><span style={{ color: '#888', fontSize: '13px' }}>Loading...</span></nav>}>
                <TopNav />
              </Suspense>
              <Suspense fallback={<div style={{ marginLeft: 'auto', fontSize: '12px', color: '#888' }}>Loading controls...</div>}>
                <HeaderControls />
              </Suspense>
            </div>
          </header>
          <main className="main-content">
            {children}
          </main>
          <footer className="footer">
            <p>Data provided is for informational purposes only.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
