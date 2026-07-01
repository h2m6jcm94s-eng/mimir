import { randomUUID } from 'node:crypto';
import { createSocket } from 'node:dgram';

export interface MeshBeacon {
  nodeId: string;
  name: string;
  kind: 'brain' | 'desktop' | 'cloud' | 'phone';
  port: number;
  version: string;
}

export interface DiscoveryOptions {
  port?: number;
  beaconIntervalMs?: number;
  nodeId: string;
  name: string;
  kind: MeshBeacon['kind'];
  meshServerPort: number;
  version?: string;
}

export class MeshDiscovery {
  private socket = createSocket('udp4');
  private interval: ReturnType<typeof setInterval> | undefined;
  private neighbors = new Map<string, MeshBeacon & { lastSeenAt: number; address: string }>();
  private options: DiscoveryOptions;

  constructor(options: DiscoveryOptions) {
    this.options = {
      port: 5353,
      beaconIntervalMs: 5000,
      version: '1',
      ...options,
    };
  }

  async start(): Promise<void> {
    const port = this.options.port ?? 5353;
    await new Promise<void>((resolve, reject) => {
      this.socket.bind(port, () => {
        this.socket.setBroadcast(true);
        resolve();
      });
      this.socket.once('error', reject);
    });

    this.socket.on('message', (msg, rinfo) => {
      try {
        const beacon = JSON.parse(msg.toString()) as MeshBeacon;
        if (beacon.nodeId === this.options.nodeId) return;
        this.neighbors.set(beacon.nodeId, {
          ...beacon,
          lastSeenAt: Date.now(),
          address: rinfo.address,
        });
      } catch {
        // Ignore malformed beacons.
      }
    });

    this.interval = setInterval(() => {
      this.broadcast();
      this.expireOldNeighbors();
    }, this.options.beaconIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.interval) clearInterval(this.interval);
    return new Promise((resolve) => this.socket.close(() => resolve()));
  }

  getNeighbors(): Array<MeshBeacon & { lastSeenAt: number; address: string }> {
    return Array.from(this.neighbors.values());
  }

  private broadcast(): void {
    const beacon: MeshBeacon = {
      nodeId: this.options.nodeId,
      name: this.options.name,
      kind: this.options.kind,
      port: this.options.meshServerPort,
      version: this.options.version ?? '1',
    };
    const message = Buffer.from(JSON.stringify(beacon));
    this.socket.send(message, 0, message.length, this.options.port, '255.255.255.255', (err) => {
      if (err) {
        // Best-effort broadcast; do not crash.
        console.error('Mesh discovery broadcast failed:', err);
      }
    });
  }

  private expireOldNeighbors(): void {
    const cutoff = Date.now() - (this.options.beaconIntervalMs ?? 5000) * 3;
    for (const [id, neighbor] of this.neighbors) {
      if (neighbor.lastSeenAt < cutoff) {
        this.neighbors.delete(id);
      }
    }
  }
}

export function generateMeshNodeId(): string {
  return randomUUID();
}
