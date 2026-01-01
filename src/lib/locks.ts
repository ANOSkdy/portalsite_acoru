import { getSqlClient } from "./db";

const CRON_LOCK_KEY = 9_991_337;

export async function acquireCronLock() {
  const sql = getSqlClient();
  const rows = await sql<{ locked: boolean }>`select pg_try_advisory_lock(${CRON_LOCK_KEY}) as locked`;
  return Boolean(rows[0]?.locked);
}

export async function releaseCronLock() {
  const sql = getSqlClient();
  await sql`select pg_advisory_unlock(${CRON_LOCK_KEY})`;
}
