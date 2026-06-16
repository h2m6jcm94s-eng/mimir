'use client';

import { useEffect, useState } from 'react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    setOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-white px-4 py-2 dark:bg-black">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Mimir</span>
          <CostChip amount={0.0} />
        </div>
        <div className="flex items-center gap-3">{!online && <OfflineBanner />}</div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}

function CostChip({ amount }: { amount: number }) {
  return (
    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
      ${amount.toFixed(2)} today
    </span>
  );
}

function OfflineBanner() {
  return (
    <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-100">
      Offline — local model active
    </span>
  );
}
