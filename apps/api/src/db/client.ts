import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const queryClient = postgres(
  process.env.DATABASE_URL || 'postgresql://mimir_app:mimir_app@localhost:5432/mimir'
);

export const db = drizzle(queryClient, { schema, logger: process.env.NODE_ENV === 'development' });

export type Db = typeof db;
