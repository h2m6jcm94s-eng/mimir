type Labels = Record<string, string | number>;

interface CounterEntry {
  value: number;
  labels: Labels;
}

class Counter {
  private entries = new Map<string, CounterEntry>();

  constructor(
    private readonly name: string,
    private readonly help: string
  ) {}

  inc(labels: Labels = {}, value = 1): void {
    const key = this.key(labels);
    const existing = this.entries.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.entries.set(key, { value, labels });
    }
  }

  exposition(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const { value, labels } of this.entries.values()) {
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${String(v).replace(/\\"/g, '\\"')}"`)
        .join(',');
      lines.push(labelStr ? `${this.name}{${labelStr}} ${value}` : `${this.name} ${value}`);
    }
    return lines.join('\n');
  }

  private key(labels: Labels): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }
}

class MetricsRegistry {
  private counters = new Map<string, Counter>();

  counter(name: string, help: string): Counter {
    const existing = this.counters.get(name);
    if (existing) return existing;
    const counter = new Counter(name, help);
    this.counters.set(name, counter);
    return counter;
  }

  exposition(): string {
    return Array.from(this.counters.values())
      .map((c) => c.exposition())
      .join('\n\n');
  }
}

export const metrics = new MetricsRegistry();

export const httpRequestsCounter = metrics.counter(
  'mimir_api_http_requests_total',
  'Total HTTP requests'
);
export const jobsCreatedCounter = metrics.counter('mimir_jobs_created_total', 'Total jobs created');
export const jobsStatusChangedCounter = metrics.counter(
  'mimir_jobs_status_changed_total',
  'Total job status changes'
);
export const connectorActionsCounter = metrics.counter(
  'mimir_connector_actions_total',
  'Total connector actions executed'
);
export const notificationsDeliveredCounter = metrics.counter(
  'mimir_notifications_delivered_total',
  'Total notification delivery attempts'
);
