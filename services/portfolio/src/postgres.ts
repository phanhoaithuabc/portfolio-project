import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import type {
  PortfolioContact,
  PortfolioContactRecord,
  PortfolioContactStatus,
  PortfolioContent,
  PortfolioVersion,
} from "@portfolio/contracts";
import type {
  PortfolioAnalyticsInput,
  PortfolioAnalyticsRow,
  PortfolioRepository,
} from "./content.ts";
import { assertPortfolioDatabaseHost } from "./database-config.ts";
export function portfolioPool() {
  if (!process.env.PORTFOLIO_DATABASE_URL)
    throw new Error(
      "PORTFOLIO_DATABASE_URL is required; use a separate portfolio database/role",
    );
  assertPortfolioDatabaseHost(
    process.env.PORTFOLIO_DATABASE_URL,
    process.env.PORTFOLIO_EXPECTED_DATABASE_HOST,
  );
  return new Pool({
    connectionString: process.env.PORTFOLIO_DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
}
export class PostgresPortfolio implements PortfolioRepository {
  constructor(private readonly pool: Pool) {}
  async ready() {
    await this.pool.query(
      "SELECT revision FROM portfolio_content WHERE id = 1",
    );
  }
  async read(): Promise<PortfolioContent> {
    const result = await this.pool.query(
      "SELECT payload, revision FROM portfolio_content WHERE id = 1",
    );
    if (!result.rows[0])
      throw new Error("Portfolio is not initialized; run its migration");
    return { ...result.rows[0].payload, revision: result.rows[0].revision };
  }
  async save(content: PortfolioContent): Promise<PortfolioContent | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query(
        "SELECT payload, revision FROM portfolio_content WHERE id = 1 FOR UPDATE",
      );
      if (!current.rows[0] || current.rows[0].revision !== content.revision) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query(
        "INSERT INTO portfolio_content_versions (revision, payload) VALUES ($1, $2) ON CONFLICT (revision) DO NOTHING",
        [current.rows[0].revision, current.rows[0].payload],
      );
      const result = await client.query(
        "UPDATE portfolio_content SET payload = $1, revision = revision + 1, updated_at = now() WHERE id = 1 RETURNING payload, revision",
        [content],
      );
      await client.query("COMMIT");
      return result.rows[0]
        ? { ...result.rows[0].payload, revision: result.rows[0].revision }
        : null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async listVersions(): Promise<PortfolioVersion[]> {
    const result = await this.pool.query(
      "SELECT revision, created_at FROM portfolio_content_versions ORDER BY revision DESC LIMIT 50",
    );
    return result.rows.map((row) => ({
      revision: row.revision,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }
  async restoreVersion(
    targetRevision: number,
    expectedRevision: number,
  ): Promise<PortfolioContent | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query(
        "SELECT payload, revision FROM portfolio_content WHERE id = 1 FOR UPDATE",
      );
      if (!current.rows[0] || current.rows[0].revision !== expectedRevision) {
        await client.query("ROLLBACK");
        return null;
      }
      const target = await client.query(
        "SELECT payload FROM portfolio_content_versions WHERE revision = $1",
        [targetRevision],
      );
      if (!target.rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query(
        "INSERT INTO portfolio_content_versions (revision, payload) VALUES ($1, $2) ON CONFLICT (revision) DO NOTHING",
        [current.rows[0].revision, current.rows[0].payload],
      );
      const result = await client.query(
        "UPDATE portfolio_content SET payload = $1, revision = revision + 1, updated_at = now() WHERE id = 1 RETURNING payload, revision",
        [target.rows[0].payload],
      );
      await client.query("COMMIT");
      return result.rows[0]
        ? { ...result.rows[0].payload, revision: result.rows[0].revision }
        : null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async createContact(
    contact: PortfolioContact,
  ): Promise<PortfolioContactRecord> {
    const result = await this.pool.query(
      "INSERT INTO portfolio_contact_messages (id, name, email, subject, message) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, subject, message, status, created_at",
      [
        randomUUID(),
        contact.name,
        contact.email,
        contact.subject ?? "",
        contact.message,
      ],
    );
    return this.mapContact(result.rows[0]);
  }
  async listContacts(limit: number): Promise<PortfolioContactRecord[]> {
    const result = await this.pool.query(
      "SELECT id, name, email, subject, message, status, created_at FROM portfolio_contact_messages ORDER BY created_at DESC LIMIT $1",
      [limit],
    );
    return result.rows.map((row) => this.mapContact(row));
  }
  async updateContactStatus(
    id: string,
    status: PortfolioContactStatus,
  ): Promise<PortfolioContactRecord | null> {
    const result = await this.pool.query(
      "UPDATE portfolio_contact_messages SET status = $2 WHERE id = $1 RETURNING id, name, email, subject, message, status, created_at",
      [id, status],
    );
    return result.rows[0] ? this.mapContact(result.rows[0]) : null;
  }
  async setProjectPassword(projectId: string, passwordHash: string | null) {
    if (passwordHash)
      await this.pool.query(
        "INSERT INTO portfolio_project_passwords(project_id,password_hash) VALUES($1,$2) ON CONFLICT(project_id) DO UPDATE SET password_hash=$2,updated_at=now()",
        [projectId, passwordHash],
      );
    else
      await this.pool.query(
        "DELETE FROM portfolio_project_passwords WHERE project_id=$1",
        [projectId],
      );
  }
  async projectPasswordHash(projectId: string) {
    const result = await this.pool.query(
      "SELECT password_hash FROM portfolio_project_passwords WHERE project_id=$1",
      [projectId],
    );
    return result.rows[0]?.password_hash as string | undefined;
  }
  async recordAnalytics(input: PortfolioAnalyticsInput) {
    await this.pool.query(
      "DELETE FROM portfolio_analytics_daily WHERE day < current_date - interval '400 days'",
    );
    await this.pool.query(
      "INSERT INTO portfolio_analytics_daily(day,page_key,event_type,referrer_host,count) VALUES(current_date,$1,$2,$3,1) ON CONFLICT(day,page_key,event_type,referrer_host) DO UPDATE SET count=portfolio_analytics_daily.count+1",
      [input.page, input.event, input.referrerHost],
    );
  }
  async listAnalytics(): Promise<PortfolioAnalyticsRow[]> {
    const result = await this.pool.query(
      "SELECT day::text,page_key AS page,event_type AS event,referrer_host AS \"referrerHost\",count FROM portfolio_analytics_daily WHERE day >= current_date - interval '400 days' ORDER BY day DESC,count DESC LIMIT 2000",
    );
    return result.rows;
  }
  private mapContact(row: Record<string, unknown>): PortfolioContactRecord {
    return {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      subject: String(row.subject),
      message: String(row.message),
      status: row.status as PortfolioContactStatus,
      createdAt: new Date(row.created_at as string | Date).toISOString(),
    };
  }
}
