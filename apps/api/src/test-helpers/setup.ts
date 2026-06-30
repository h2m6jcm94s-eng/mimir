import { initializeLibSqlSchema } from '../services/state/libsql-schema';

export default async function setup(): Promise<void> {
  if (process.env.RUN_DB_TESTS) {
    await initializeLibSqlSchema();
  }
}
