import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { portfolioContentSchema } from "@portfolio/contracts";

const timestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid timestamp");
const snapshotSchema = z.object({
  content: z.object({
    payload: portfolioContentSchema,
    revision: z.number().int().nonnegative(),
  }),
  versions: z.array(
    z.object({
      revision: z.number().int().nonnegative(),
      payload: portfolioContentSchema,
      created_at: timestamp,
    }),
  ),
  contacts: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string(),
      subject: z.string(),
      message: z.string(),
      status: z.enum(["new", "read", "archived"]),
      created_at: timestamp,
    }),
  ),
  passwords: z.array(
    z.object({
      project_id: z.string().uuid(),
      password_hash: z.string().min(1),
      updated_at: timestamp,
    }),
  ),
  analytics: z.array(
    z.object({
      day: z.iso.date(),
      page_key: z.string(),
      event_type: z.enum(["view", "outbound", "contact"]),
      referrer_host: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
});

export function importSnapshot(database: DatabaseSync, input: unknown) {
  const snapshot = snapshotSchema.parse(input);
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const table of [
      "portfolio_content",
      "portfolio_content_versions",
      "portfolio_contact_messages",
      "portfolio_project_passwords",
      "portfolio_analytics_daily",
      "portfolio_sessions",
    ]) {
      if (database.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get())
        throw new Error(
          "Import requires an empty target; existing data will not be overwritten",
        );
    }
    database
      .prepare(
        "INSERT INTO portfolio_content(id,payload,revision) VALUES(1,?,?)",
      )
      .run(
        JSON.stringify({
          ...snapshot.content.payload,
          revision: snapshot.content.revision,
        }),
        snapshot.content.revision,
      );
    for (const row of snapshot.versions)
      database
        .prepare(
          "INSERT INTO portfolio_content_versions(revision,payload,created_at) VALUES(?,?,?)",
        )
        .run(
          row.revision,
          JSON.stringify({ ...row.payload, revision: row.revision }),
          new Date(row.created_at).toISOString(),
        );
    for (const row of snapshot.contacts)
      database
        .prepare(
          "INSERT INTO portfolio_contact_messages(id,name,email,subject,message,status,created_at) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          row.id,
          row.name,
          row.email,
          row.subject,
          row.message,
          row.status,
          new Date(row.created_at).toISOString(),
        );
    for (const row of snapshot.passwords)
      database
        .prepare(
          "INSERT INTO portfolio_project_passwords(project_id,password_hash,updated_at) VALUES(?,?,?)",
        )
        .run(
          row.project_id,
          row.password_hash,
          new Date(row.updated_at).toISOString(),
        );
    for (const row of snapshot.analytics)
      database
        .prepare(
          "INSERT INTO portfolio_analytics_daily(day,page_key,event_type,referrer_host,count) VALUES(?,?,?,?,?)",
        )
        .run(
          row.day,
          row.page_key,
          row.event_type,
          row.referrer_host,
          row.count,
        );
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return {
    revision: snapshot.content.revision,
    versions: snapshot.versions.length,
    contacts: snapshot.contacts.length,
    passwords: snapshot.passwords.length,
    analytics: snapshot.analytics.length,
  };
}
