'use client';

import { AppShell } from '@/components/layout/AppShell';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { SessionAuth } from 'supertokens-auth-react/recipe/session';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionAuth requireAuth={true}>
        <AppShell>{children}</AppShell>
      </SessionAuth>
    </ThemeProvider>
  );
}
