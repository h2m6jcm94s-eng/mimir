export interface AppConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  temporalHost: string;
  clerkSecretKey?: string;
  logLevel: string;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT) || 3001,
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mimir',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    temporalHost: process.env.TEMPORAL_HOST || 'localhost:7233',
    clerkSecretKey: process.env.CLERK_SECRET_KEY,
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}
