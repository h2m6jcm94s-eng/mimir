'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CheckCircle2, Mail, MessageCircle, ShieldAlert } from 'lucide-react';

interface Connector {
  name: string;
  status: 'connected' | 'error' | 'disconnected';
  icon: typeof Mail;
}

const connectors: Connector[] = [
  { name: 'GitHub', status: 'connected', icon: CheckCircle2 },
  { name: 'Gmail', status: 'connected', icon: Mail },
  { name: 'Slack', status: 'connected', icon: MessageCircle },
  { name: 'Telegram', status: 'error', icon: MessageCircle },
];

function statusClasses(status: Connector['status']) {
  return status === 'connected'
    ? 'bg-emerald-100 text-emerald-700'
    : status === 'error'
      ? 'bg-red-100 text-red-700'
      : 'bg-[var(--bg-surface-raised)] text-[var(--text-muted)]';
}

export function ConnectorStrip() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--bg-surface)] p-3 shadow-card"
    >
      <span className="mr-1 text-xs font-medium text-[var(--text-muted)]">Connectors</span>
      {connectors.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.name}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              statusClasses(c.status)
            )}
          >
            {c.status === 'error' ? (
              <ShieldAlert className="h-3 w-3" />
            ) : (
              <Icon className="h-3 w-3" />
            )}
            {c.name}
          </div>
        );
      })}
    </motion.div>
  );
}
