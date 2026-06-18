'use client';

import { useEffect } from 'react';

async function isDemoExpired(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/demo/status', {
      credentials: 'include',
      signal,
    });
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      return body?.error?.code === 'DEMO_EXPIRED';
    }
    return false;
  } catch {
    return false;
  }
}

export function DemoLockoutGuard() {
  useEffect(() => {
    const controller = new AbortController();

    isDemoExpired(controller.signal).then((expired) => {
      if (expired && !window.location.pathname.startsWith('/demo-locked')) {
        window.location.href = '/demo-locked';
      }
    });

    const interval = setInterval(() => {
      isDemoExpired(controller.signal).then((expired) => {
        if (expired && !window.location.pathname.startsWith('/demo-locked')) {
          window.location.href = '/demo-locked';
        }
      });
    }, 30_000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  return null;
}
