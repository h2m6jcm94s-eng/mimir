'use client';

import { AppShell } from '@/components/layout/AppShell';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { SessionAuth } from 'supertokens-auth-react/recipe/session';

const isPlaywrightTest = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === 'true';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {isPlaywrightTest ? (
        <AppShell>{children}</AppShell>
      ) : (
        <SessionAuth requireAuth={true}>
          <AppShell>{children}</AppShell>
        </SessionAuth>
      )}
    </ThemeProvider>
  );
}
