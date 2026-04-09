import { Pool, PoolClient } from "pg";
import crypto from "crypto";
import { createClient, RedisClientType } from "redis";
import { CONTEXT_ENGINE_PATH, getBootstrapAdminConfig } from "@/lib/config";
import type { ContextUsagePoint, UserStatus } from "@/lib/types";

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "",
  database: process.env.POSTGRES_DB || "postgres",
});

export default pool;

let redisClient: RedisClientType | null = null;
let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;

async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    const host = process.env.REDIS_HOST || "localhost";
    const port = process.env.REDIS_PORT || "6379";
    redisClient = createClient({ url: `redis://${host}:${port}` });
    redisClient.on("error", (error) => console.error("Redis error:", error));
    await redisClient.connect();
  }

  return redisClient;
}

async function deleteApiKeyCache(keyId: string | null | undefined) {
  if (!keyId) return;

  try {
    const redis = await getRedisClient();
    await redis.del(`apikey:${keyId}`);
  } catch (error) {
    console.error("Failed to delete API key cache:", error);
  }
}

async function deleteUserApiKeyCache(userId: string, client?: PoolClient) {
  const dbClient = client || (await pool.connect());

  try {
    const result = await dbClient.query<{ id: string }>(
      `SELECT id FROM api_keys WHERE user_id = $1`,
      [userId]
    );
    await deleteApiKeyCache(result.rows[0]?.id);
  } finally {
    if (!client) {
      dbClient.release();
    }
  }
}

function generateApiKey(): { id: string; apiKey: string } {
  const apiKey = `ace_${crypto.randomBytes(20).toString("hex")}`;
  const id = crypto.createHash("md5").update(apiKey).digest("hex");
  return { id, apiKey };
}

export function getIdFromKey(apiKey: string): string {
  return crypto.createHash("md5").update(apiKey).digest("hex");
}

export function maskApiKey(apiKey: string | null | undefined): string | null {
  if (!apiKey) return null;
  if (apiKey.length < 12) return "ace_************************";
  const prefix = apiKey.slice(0, 8);
  return `${prefix}${"*".repeat(apiKey.length - 8)}`;
}

export interface ManagedUserRow {
  id: string;
  name: string;
  note: string | null;
  status: UserStatus;
  email: string | null;
  image: string | null;
  username: string | null;
  trustLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  api_key: string;
  created_at: Date;
  updated_at: Date;
}

export interface ManagedUserListRow extends ManagedUserRow {
  maskedApiKey: string | null;
  hasApiKey: boolean;
  apiKeyCreatedAt: Date | null;
  apiKeyUpdatedAt: Date | null;
  contextEngineCount: number;
}

function mapManagedUser(row: Record<string, unknown>): ManagedUserRow {
  return {
    id: String(row.id),
    name: String(row.name || row.id),
    note: (row.note as string | null) ?? null,
    status: ((row.status as UserStatus | null) || "active") as UserStatus,
    email: (row.email as string | null) ?? null,
    image: (row.image as string | null) ?? null,
    username: (row.username as string | null) ?? null,
    trustLevel: Number(row.trustLevel ?? row.trustlevel ?? 0),
    createdAt: new Date(String(row.createdAt)),
    updatedAt: new Date(String(row.updatedAt)),
  };
}

function fillDailySeries(startAt: Date, endAt: Date, rows: Array<{ date: string; count: string | number }>): ContextUsagePoint[] {
  const counts = new Map(rows.map((row) => [row.date, Number(row.count)]));
  const series: ContextUsagePoint[] = [];
  const cursor = new Date(startAt.getTime());

  while (cursor < endAt) {
    const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(cursor);
    series.push({
      date,
      count: counts.get(date) || 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return series;
}

async function ensureBootstrapAdmin(client: PoolClient) {
  const bootstrap = getBootstrapAdminConfig();
  if (!bootstrap.apiKey) return;

  await client.query(
    `INSERT INTO "user" (id, name, note, status, email, image, username, "trustLevel", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'active', NULL, NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       note = EXCLUDED.note,
       status = 'active',
       "updatedAt" = CURRENT_TIMESTAMP`,
    [bootstrap.userId, bootstrap.name, bootstrap.note]
  );

  const oldKeyResult = await client.query<{ id: string }>(
    `SELECT id FROM api_keys WHERE user_id = $1`,
    [bootstrap.userId]
  );
  const oldKeyId = oldKeyResult.rows[0]?.id;

  const newKeyId = getIdFromKey(bootstrap.apiKey);
  await client.query(
    `INSERT INTO api_keys (id, user_id, api_key, created_at, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       id = EXCLUDED.id,
       api_key = EXCLUDED.api_key,
       updated_at = CURRENT_TIMESTAMP`,
    [newKeyId, bootstrap.userId, bootstrap.apiKey]
  );

  if (oldKeyId && oldKeyId !== newKeyId) {
    await deleteApiKeyCache(oldKeyId);
  }
}

export async function initDB() {
  if (dbInitialized) return;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    const client = await pool.connect();

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "user" (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          image TEXT,
          username VARCHAR(255),
          "trustLevel" INTEGER NOT NULL DEFAULT 0,
          note TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS note TEXT`);
      await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'`);
      await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS username VARCHAR(255)`);
      await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS image TEXT`);
      await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS email VARCHAR(255)`);
      await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "trustLevel" INTEGER NOT NULL DEFAULT 0`);
      await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      await client.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_user_status ON "user"(status)`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id VARCHAR(32) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          api_key VARCHAR(64) UNIQUE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id)
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS request_logs (
          id UUID PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          status_code INTEGER,
          request_path VARCHAR(512) NOT NULL,
          request_method VARCHAR(10) NOT NULL,
          request_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          response_duration_ms BIGINT,
          client_ip VARCHAR(45) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_request_logs_user_id_timestamp ON request_logs(user_id, request_timestamp DESC)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(request_timestamp)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_request_logs_status ON request_logs(status)`);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_request_logs_codebase_retrieval
          ON request_logs(user_id, request_timestamp)
          WHERE request_path = '${CONTEXT_ENGINE_PATH}'
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS error_details (
          id SERIAL PRIMARY KEY,
          request_id UUID NOT NULL,
          source VARCHAR(20) NOT NULL DEFAULT 'proxy',
          error TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_error_details_request_id ON error_details(request_id)`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS leaderboard (
          id VARCHAR(32) PRIMARY KEY,
          date_str VARCHAR(10) NOT NULL,
          rank INTEGER NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          request_count BIGINT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_leaderboard_date ON leaderboard(date_str)`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS health_checks (
          id SERIAL PRIMARY KEY,
          status VARCHAR(20) NOT NULL,
          tcp_ping_ms INTEGER,
          codebase_retrieval_ms INTEGER,
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          next_check_at TIMESTAMP WITH TIME ZONE
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_health_checks_created_at ON health_checks(created_at)`);

      await ensureBootstrapAdmin(client);
      dbInitialized = true;
    } finally {
      client.release();
      dbInitPromise = null;
    }
  })();

  return dbInitPromise;
}

export async function getManagedUserById(userId: string): Promise<ManagedUserRow | null> {
  await initDB();

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         id,
         COALESCE(name, id) AS name,
         note,
         COALESCE(status, 'active') AS status,
         email,
         image,
         username,
         COALESCE("trustLevel", 0) AS "trustLevel",
         COALESCE("createdAt", CURRENT_TIMESTAMP) AS "createdAt",
         COALESCE("updatedAt", CURRENT_TIMESTAMP) AS "updatedAt"
       FROM "user"
       WHERE id = $1`,
      [userId]
    );

    return result.rows[0] ? mapManagedUser(result.rows[0]) : null;
  } finally {
    client.release();
  }
}

export async function authenticateApiKey(apiKey: string): Promise<{ user: ManagedUserRow; key: ApiKeyRow } | null> {
  await initDB();

  const keyId = getIdFromKey(apiKey);
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT
         u.id AS id,
         ak.user_id,
         ak.api_key,
         ak.id AS api_key_id,
         ak.created_at AS api_key_created_at,
         ak.updated_at AS api_key_updated_at,
         COALESCE(u.name, ak.user_id) AS name,
         u.note,
         COALESCE(u.status, 'active') AS status,
         u.email,
         u.image,
         u.username,
         COALESCE(u."trustLevel", 0) AS "trustLevel",
         COALESCE(u."createdAt", CURRENT_TIMESTAMP) AS "createdAt",
         COALESCE(u."updatedAt", CURRENT_TIMESTAMP) AS "updatedAt"
       FROM api_keys ak
       JOIN "user" u ON u.id = ak.user_id
       WHERE ak.id = $1`,
      [keyId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const user = mapManagedUser(row);
    if (user.status !== "active") {
      return null;
    }

    return {
      user,
      key: {
        id: String(row.api_key_id),
        user_id: String(row.user_id),
        api_key: String(row.api_key),
        created_at: new Date(String(row.api_key_created_at)),
        updated_at: new Date(String(row.api_key_updated_at)),
      },
    };
  } finally {
    client.release();
  }
}

export async function getApiKey(userId: string): Promise<ApiKeyRow | null> {
  await initDB();

  const client = await pool.connect();
  try {
    const result = await client.query<ApiKeyRow>(
      `SELECT id, user_id, api_key, created_at, updated_at
       FROM api_keys
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function createApiKey(userId: string): Promise<ApiKeyRow> {
  await initDB();

  const client = await pool.connect();
  try {
    const { id, apiKey } = generateApiKey();
    const result = await client.query<ApiKeyRow>(
      `INSERT INTO api_keys (id, user_id, api_key, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, user_id, api_key, created_at, updated_at`,
      [id, userId, apiKey]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function resetApiKey(userId: string): Promise<ApiKeyRow | null> {
  await initDB();

  const client = await pool.connect();
  try {
    const oldResult = await client.query<{ id: string }>(
      `SELECT id FROM api_keys WHERE user_id = $1`,
      [userId]
    );
    const oldKeyId = oldResult.rows[0]?.id;

    const { id, apiKey } = generateApiKey();
    const result = await client.query<ApiKeyRow>(
      `UPDATE api_keys
       SET id = $2, api_key = $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING id, user_id, api_key, created_at, updated_at`,
      [userId, id, apiKey]
    );

    await deleteApiKeyCache(oldKeyId);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function listManagedUsersWithContextStats(startAt?: Date, endAt?: Date): Promise<ManagedUserListRow[]> {
  await initDB();

  const client = await pool.connect();
  try {
    const params: Array<Date | string> = [CONTEXT_ENGINE_PATH];
    let statsJoin = `
      LEFT JOIN (
        SELECT user_id, COUNT(*)::BIGINT AS context_count
        FROM request_logs
        WHERE request_path = $1
        GROUP BY user_id
      ) stats ON stats.user_id = u.id
    `;

    if (startAt && endAt) {
      params.push(startAt, endAt);
      statsJoin = `
        LEFT JOIN (
          SELECT user_id, COUNT(*)::BIGINT AS context_count
          FROM request_logs
          WHERE request_path = $1
            AND request_timestamp >= $2
            AND request_timestamp < $3
          GROUP BY user_id
        ) stats ON stats.user_id = u.id
      `;
    }

    const result = await client.query(
      `SELECT
         u.id,
         COALESCE(u.name, u.id) AS name,
         u.note,
         COALESCE(u.status, 'active') AS status,
         u.email,
         u.image,
         u.username,
         COALESCE(u."trustLevel", 0) AS "trustLevel",
         COALESCE(u."createdAt", CURRENT_TIMESTAMP) AS "createdAt",
         COALESCE(u."updatedAt", CURRENT_TIMESTAMP) AS "updatedAt",
         ak.api_key,
         ak.created_at AS api_key_created_at,
         ak.updated_at AS api_key_updated_at,
         COALESCE(stats.context_count, 0) AS context_count
       FROM "user" u
       LEFT JOIN api_keys ak ON ak.user_id = u.id
       ${statsJoin}
       ORDER BY COALESCE(u."createdAt", CURRENT_TIMESTAMP) DESC, u.id ASC`,
      params
    );

    return result.rows.map((row) => {
      const user = mapManagedUser(row);
      return {
        ...user,
        maskedApiKey: maskApiKey((row.api_key as string | null) ?? null),
        hasApiKey: Boolean(row.api_key),
        apiKeyCreatedAt: row.api_key_created_at ? new Date(String(row.api_key_created_at)) : null,
        apiKeyUpdatedAt: row.api_key_updated_at ? new Date(String(row.api_key_updated_at)) : null,
        contextEngineCount: Number(row.context_count || 0),
      };
    });
  } finally {
    client.release();
  }
}

export async function createManagedUser(input: {
  name: string;
  note?: string | null;
  status?: UserStatus;
}): Promise<{ user: ManagedUserRow; key: ApiKeyRow }> {
  await initDB();

  const client = await pool.connect();
  const userId = `usr_${crypto.randomUUID().replace(/-/g, "")}`;
  const status = input.status || "active";

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO "user" (id, name, note, status, email, image, username, "trustLevel", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NULL, NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING
         id,
         COALESCE(name, id) AS name,
         note,
         COALESCE(status, 'active') AS status,
         email,
         image,
         username,
         COALESCE("trustLevel", 0) AS "trustLevel",
         COALESCE("createdAt", CURRENT_TIMESTAMP) AS "createdAt",
         COALESCE("updatedAt", CURRENT_TIMESTAMP) AS "updatedAt"`,
      [userId, input.name.trim(), input.note?.trim() || null, status]
    );

    const { id, apiKey } = generateApiKey();
    const keyResult = await client.query<ApiKeyRow>(
      `INSERT INTO api_keys (id, user_id, api_key, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, user_id, api_key, created_at, updated_at`,
      [id, userId, apiKey]
    );

    await client.query("COMMIT");

    return {
      user: mapManagedUser(userResult.rows[0]),
      key: keyResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateManagedUser(
  userId: string,
  input: { name?: string; note?: string | null; status?: UserStatus }
): Promise<ManagedUserRow | null> {
  await initDB();

  const client = await pool.connect();
  try {
    const current = await getManagedUserById(userId);
    if (!current) {
      return null;
    }

    const nextName = input.name?.trim() || current.name;
    const nextNote = input.note !== undefined ? input.note?.trim() || null : current.note;
    const nextStatus = input.status || current.status;

    const result = await client.query(
      `UPDATE "user"
       SET name = $2,
           note = $3,
           status = $4,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING
         id,
         COALESCE(name, id) AS name,
         note,
         COALESCE(status, 'active') AS status,
         email,
         image,
         username,
         COALESCE("trustLevel", 0) AS "trustLevel",
         COALESCE("createdAt", CURRENT_TIMESTAMP) AS "createdAt",
         COALESCE("updatedAt", CURRENT_TIMESTAMP) AS "updatedAt"`,
      [userId, nextName, nextNote, nextStatus]
    );

    if (current.status !== nextStatus) {
      await deleteUserApiKeyCache(userId, client);
    }

    return result.rows[0] ? mapManagedUser(result.rows[0]) : null;
  } finally {
    client.release();
  }
}

export async function resetManagedUserApiKey(userId: string): Promise<ApiKeyRow | null> {
  return resetApiKey(userId);
}

export async function getManagedUserContextStats(
  userId: string,
  startAt: Date,
  endAt: Date
): Promise<{ totalCount: number; series: ContextUsagePoint[] }> {
  await initDB();

  const client = await pool.connect();
  try {
    const [countResult, seriesResult] = await Promise.all([
      client.query<{ total_count: string }>(
        `SELECT COUNT(*)::BIGINT AS total_count
         FROM request_logs
         WHERE user_id = $1
           AND request_path = $2
           AND request_timestamp >= $3
           AND request_timestamp < $4`,
        [userId, CONTEXT_ENGINE_PATH, startAt, endAt]
      ),
      client.query<{ date: string; count: string }>(
        `SELECT
           TO_CHAR((request_timestamp AT TIME ZONE 'Asia/Shanghai')::date, 'YYYY-MM-DD') AS date,
           COUNT(*)::BIGINT AS count
         FROM request_logs
         WHERE user_id = $1
           AND request_path = $2
           AND request_timestamp >= $3
           AND request_timestamp < $4
         GROUP BY 1
         ORDER BY 1 ASC`,
        [userId, CONTEXT_ENGINE_PATH, startAt, endAt]
      ),
    ]);

    return {
      totalCount: Number(countResult.rows[0]?.total_count || 0),
      series: fillDailySeries(startAt, endAt, seriesResult.rows),
    };
  } finally {
    client.release();
  }
}

export interface RequestLogRow {
  id: string;
  user_id: string;
  status: string;
  status_code: number | null;
  request_path: string;
  request_method: string;
  request_timestamp: Date;
  response_duration_ms: number | null;
  client_ip: string;
}

export async function getRequestLogs(
  userId: string,
  limit = 20,
  offset = 0
): Promise<RequestLogRow[]> {
  await initDB();

  const client = await pool.connect();
  try {
    const result = await client.query<RequestLogRow>(
      `SELECT id, user_id, status, status_code, request_path, request_method,
              request_timestamp, response_duration_ms, client_ip
       FROM request_logs
       WHERE user_id = $1
       ORDER BY request_timestamp DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getRequestLogStats(userId: string): Promise<{
  successCount: number;
  failedCount: number;
  totalCount: number;
}> {
  await initDB();

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 400) AS success_count,
         COUNT(*) FILTER (WHERE status_code >= 400 OR status = 'error') AS failed_count,
         COUNT(*) AS total_count
       FROM request_logs
       WHERE user_id = $1`,
      [userId]
    );

    return {
      successCount: Number(result.rows[0]?.success_count || 0),
      failedCount: Number(result.rows[0]?.failed_count || 0),
      totalCount: Number(result.rows[0]?.total_count || 0),
    };
  } finally {
    client.release();
  }
}

export async function getContextEngineCount(userId: string): Promise<number> {
  await initDB();

  const client = await pool.connect();
  try {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*)::BIGINT AS count
       FROM request_logs
       WHERE user_id = $1
         AND request_path = $2`,
      [userId, CONTEXT_ENGINE_PATH]
    );
    return Number(result.rows[0]?.count || 0);
  } finally {
    client.release();
  }
}

export interface ErrorDetailRow {
  id: number;
  request_id: string;
  source: string;
  error: string;
  created_at: Date;
}

export async function getRequestLogById(
  userId: string,
  logId: string
): Promise<RequestLogRow | null> {
  await initDB();

  const client = await pool.connect();
  try {
    const result = await client.query<RequestLogRow>(
      `SELECT id, user_id, status, status_code, request_path, request_method,
              request_timestamp, response_duration_ms, client_ip
       FROM request_logs
       WHERE id = $1 AND user_id = $2`,
      [logId, userId]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getErrorDetailsByRequestId(requestId: string): Promise<ErrorDetailRow[]> {
  await initDB();

  const client = await pool.connect();
  try {
    const result = await client.query<ErrorDetailRow>(
      `SELECT id, request_id, source, error, created_at
       FROM error_details
       WHERE request_id = $1
       ORDER BY created_at ASC`,
      [requestId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export interface HealthCheckRow {
  id: number;
  status: string;
  tcp_ping_ms: number | null;
  codebase_retrieval_ms: number | null;
  error_message: string | null;
  created_at: Date;
  next_check_at: Date | null;
}

export async function getHealthCheckHistory(limit = 60): Promise<HealthCheckRow[]> {
  await initDB();

  const client = await pool.connect();
  try {
    const result = await client.query<HealthCheckRow>(
      `SELECT id, status, tcp_ping_ms, codebase_retrieval_ms, error_message, created_at, next_check_at
       FROM health_checks
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getHealthCheckStats(days = 7): Promise<{
  successCount: number;
  totalCount: number;
}> {
  await initDB();

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'success') AS success_count,
         COUNT(*) AS total_count
       FROM health_checks
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
      [days]
    );

    return {
      successCount: Number(result.rows[0]?.success_count || 0),
      totalCount: Number(result.rows[0]?.total_count || 0),
    };
  } finally {
    client.release();
  }
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  user_name: string;
  request_count: number;
}

export async function getLeaderboard(dateStr?: string): Promise<LeaderboardEntry[]> {
  await initDB();

  const client = await pool.connect();
  try {
    const targetDate =
      dateStr ||
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Shanghai",
      }).format(new Date());

    const result = await client.query<LeaderboardEntry>(
      `SELECT l.rank, l.user_id, COALESCE(u.name, l.user_id) AS user_name, l.request_count
       FROM leaderboard l
       LEFT JOIN "user" u ON l.user_id = u.id
       WHERE l.date_str = $1
       ORDER BY l.rank ASC
       LIMIT 10`,
      [targetDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}
