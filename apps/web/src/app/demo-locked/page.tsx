import { Lock } from 'lucide-react';

export default function DemoLockedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-base)] p-6 text-center">
      <div className="rounded-full bg-[var(--text-danger)]/10 p-4">
        <Lock className="h-8 w-8 text-[var(--text-danger)]" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold text-[var(--text-primary)]">
        Demo workspace locked
      </h1>
      <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
        Your demo period has ended. If you want to keep using Mimir, reach out to the team to
        upgrade or extend your access.
      </p>
      <a
        href="mailto:hello@mimir.local"
        className="mt-6 inline-flex items-center rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-primary)]/90"
      >
        Request access
      </a>
    </div>
  );
}
