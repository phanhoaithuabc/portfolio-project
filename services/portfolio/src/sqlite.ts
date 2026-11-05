import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import session from "express-session";
import type {
  PortfolioContent,
  PortfolioContact,
  PortfolioContactRecord,
  PortfolioContactStatus,
  PortfolioVersion,
} from "@portfolio/contracts";
import type {
  PortfolioRepository,
  PortfolioAnalyticsInput,
  PortfolioAnalyticsRow,
} from "./content.ts";

export function openPortfolioDatabase(
  filename = process.env.PORTFOLIO_DATABASE_FILE ?? "data/portfolio.sqlite",
) {
  if (!filename.trim() || filename.includes("://"))
    throw new Error("PORTFOLIO_DATABASE_FILE must be a SQLite file path");
  if (filename !== ":memory:")
    mkdirSync(dirname(resolve(filename)), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec(
    "PRAGMA busy_timeout = 10000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;",
  );
  return database;
}

export class SqlitePortfolio implements PortfolioRepository {
  constructor(private readonly database: DatabaseSync) {}
  async ready() {
    if (
      !this.database
        .prepare("SELECT revision FROM portfolio_content WHERE id = 1")
        .get()
    )
      throw new Error("Portfolio is not initialized; run its migration");
  }
  async read(): Promise<PortfolioContent> {
    const row = this.database
      .prepare("SELECT payload, revision FROM portfolio_content WHERE id = 1")
      .get();
    if (!row)
      throw new Error("Portfolio is not initialized; run its migration");
    return {
      ...JSON.parse(String(row.payload)),
      revision: Number(row.revision),
    };
  }
  private update(
    expectedRevision: number,
    payload?: PortfolioContent,
    targetRevision?: number,
  ): PortfolioContent | null {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const current = this.database
        .prepare("SELECT payload, revision FROM portfolio_content WHERE id = 1")
        .get();
      const target =
        targetRevision === undefined
          ? undefined
          : this.database
              .prepare(
                "SELECT payload FROM portfolio_content_versions WHERE revision = ?",
              )
              .get(targetRevision);
      if (
        !current ||
        Number(current.revision) !== expectedRevision ||
        (targetRevision !== undefined && !target)
      ) {
        this.database.exec("ROLLBACK");
        return null;
      }
      this.database
        .prepare(
          "INSERT INTO portfolio_content_versions (revision, payload) VALUES (?, ?) ON CONFLICT DO NOTHING",
        )
        .run(expectedRevision, String(current.payload));
      const serialized = payload
        ? JSON.stringify(payload)
        : String(target!.payload);
      this.database
        .prepare(
          "UPDATE portfolio_content SET payload = ?, revision = revision + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 1",
        )
        .run(serialized);
      this.database.exec("COMMIT");
      return { ...JSON.parse(serialized), revision: expectedRevision + 1 };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
  async save(content: PortfolioContent) {
    return this.update(content.revision, content);
  }
  async restoreVersion(targetRevision: number, expectedRevision: number) {
    return this.update(expectedRevision, undefined, targetRevision);
  }
  async listVersions(): Promise<PortfolioVersion[]> {
    return this.database
      .prepare(
        "SELECT revision, created_at FROM portfolio_content_versions ORDER BY revision DESC LIMIT 50",
      )
      .all()
      .map((row) => ({
        revision: Number(row.revision),
        createdAt: String(row.created_at),
      }));
  }
  private mapContact(row: Record<string, unknown>): PortfolioContactRecord {
    return {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      subject: String(row.subject),
      message: String(row.message),
      status: row.status as PortfolioContactStatus,
      createdAt: String(row.created_at),
    };
  }
  async createContact(contact: PortfolioContact) {
    const row = this.database
      .prepare(
        "INSERT INTO portfolio_contact_messages (id, name, email, subject, message) VALUES (?, ?, ?, ?, ?) RETURNING *",
      )
      .get(
        randomUUID(),
        contact.name,
        contact.email,
        contact.subject ?? "",
        contact.message,
      )!;
    return this.mapContact(row);
  }
  async listContacts(limit: number) {
    return this.database
      .prepare(
        "SELECT * FROM portfolio_contact_messages ORDER BY created_at DESC LIMIT ?",
      )
      .all(limit)
      .map((row) => this.mapContact(row));
  }
  async updateContactStatus(id: string, status: PortfolioContactStatus) {
    const row = this.database
      .prepare(
        "UPDATE portfolio_contact_messages SET status = ? WHERE id = ? RETURNING *",
      )
      .get(status, id);
    return row ? this.mapContact(row) : null;
  }
  async setProjectPassword(projectId: string, passwordHash: string | null) {
    if (passwordHash)
      this.database
        .prepare(
          "INSERT INTO portfolio_project_passwords (project_id,password_hash) VALUES (?,?) ON CONFLICT(project_id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')",
        )
        .run(projectId, passwordHash);
    else
      this.database
        .prepare("DELETE FROM portfolio_project_passwords WHERE project_id=?")
        .run(projectId);
  }
  async projectPasswordHash(projectId: string) {
    return this.database
      .prepare(
        "SELECT password_hash FROM portfolio_project_passwords WHERE project_id=?",
      )
      .get(projectId)?.password_hash as string | undefined;
  }
  async recordAnalytics(input: PortfolioAnalyticsInput) {
    this.database
      .prepare(
        "DELETE FROM portfolio_analytics_daily WHERE day < date('now','-400 days')",
      )
      .run();
    this.database
      .prepare(
        "INSERT INTO portfolio_analytics_daily(day,page_key,event_type,referrer_host,count) VALUES(date('now'),?,?,?,1) ON CONFLICT(day,page_key,event_type,referrer_host) DO UPDATE SET count=count+1",
      )
      .run(input.page, input.event, input.referrerHost);
  }
  async listAnalytics(): Promise<PortfolioAnalyticsRow[]> {
    return this.database
      .prepare(
        "SELECT day,page_key AS page,event_type AS event,referrer_host AS referrerHost,count FROM portfolio_analytics_daily WHERE day >= date('now','-400 days') ORDER BY day DESC,count DESC LIMIT 2000",
      )
      .all() as PortfolioAnalyticsRow[];
  }
}

export class SqliteSessionStore extends session.Store {
  constructor(private readonly database: DatabaseSync) {
    super();
  }
  override get(
    sid: string,
    callback: (error: unknown, value?: session.SessionData | null) => void,
  ) {
    try {
      this.database
        .prepare("DELETE FROM portfolio_sessions WHERE expire <= ?")
        .run(Date.now());
      const row = this.database
        .prepare("SELECT sess FROM portfolio_sessions WHERE sid = ?")
        .get(sid);
      callback(null, row ? JSON.parse(String(row.sess)) : null);
    } catch (error) {
      callback(error);
    }
  }
  override set(
    sid: string,
    value: session.SessionData,
    callback?: (error?: unknown) => void,
  ) {
    try {
      const expire = value.cookie.expires
        ? new Date(value.cookie.expires).getTime()
        : Date.now() + (value.cookie.originalMaxAge ?? 86400000);
      this.database
        .prepare("DELETE FROM portfolio_sessions WHERE expire <= ?")
        .run(Date.now());
      this.database
        .prepare(
          "INSERT INTO portfolio_sessions (sid,sess,expire) VALUES (?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess,expire=excluded.expire",
        )
        .run(sid, JSON.stringify(value), expire);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }
  override destroy(sid: string, callback?: (error?: unknown) => void) {
    try {
      this.database
        .prepare("DELETE FROM portfolio_sessions WHERE sid=?")
        .run(sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }
  override touch(
    sid: string,
    value: session.SessionData,
    callback?: (error?: unknown) => void,
  ) {
    try {
      const expire = value.cookie.expires
        ? new Date(value.cookie.expires).getTime()
        : Date.now() + (value.cookie.originalMaxAge ?? 86400000);
      this.database
        .prepare("UPDATE portfolio_sessions SET expire=? WHERE sid=?")
        .run(expire, sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }
}
