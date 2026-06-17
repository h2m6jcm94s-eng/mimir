import { SupertokensInit } from '@/components/supertokens/SupertokensInit';
import './globals.css';

export const metadata = {
  title: 'Mimir',
  description: 'Consult the well.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupertokensInit>
      <html lang="en">
        <body>{children}</body>
      </html>
    </SupertokensInit>
  );
}
