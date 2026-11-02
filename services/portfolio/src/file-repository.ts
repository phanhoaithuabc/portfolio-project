import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import {
  portfolioContentSchema,
  type PortfolioContact,
  type PortfolioContactRecord,
  type PortfolioContactStatus,
  type PortfolioContent,
  type PortfolioVersion,
} from "@portfolio/contracts";
import {
  initialContent,
  type PortfolioAnalyticsInput,
  type PortfolioAnalyticsRow,
  type PortfolioRepository,
} from "./content.ts";

type StoredVersion = PortfolioVersion & { content: PortfolioContent };

export class FilePortfolio implements PortfolioRepository {
  private content = structuredClone(initialContent);
  private versions: StoredVersion[] = [];
  private contacts: PortfolioContactRecord[] = [];
  private projectPasswords: Record<string, string> = {};
  private analytics: PortfolioAnalyticsRow[] = [];
  private readonly initialized: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {
    this.initialized = this.initialize();
  }

  private async initialize() {
    try {
      this.content = portfolioContentSchema.parse(
        JSON.parse(await readFile(this.file, "utf8")),
      );
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        throw error;
      await this.persist(this.content);
    }
    this.versions = await this.readSidecar<StoredVersion[]>("versions", []);
    this.contacts = await this.readSidecar<PortfolioContactRecord[]>(
      "messages",
      [],
    );
    this.projectPasswords = await this.readSidecar<Record<string, string>>(
      "project-passwords",
      {},
    );
    this.analytics = await this.readSidecar<PortfolioAnalyticsRow[]>(
      "analytics",
      [],
    );
  }

  private sidecar(name: string) {
    return `${this.file}.${name}.json`;
  }

  private async readSidecar<Value>(
    name: string,
    fallback: Value,
  ): Promise<Value> {
    try {
      return JSON.parse(await readFile(this.sidecar(name), "utf8")) as Value;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return fallback;
      throw error;
    }
  }

  private async persistJson(file: string, value: unknown) {
    await mkdir(dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
    await rename(temporary, file);
  }

  private async persist(content: PortfolioContent) {
    await this.persistJson(this.file, content);
  }

  private enqueue<Value>(operation: () => Promise<Value>): Promise<Value> {
    const task = this.queue.then(operation);
    this.queue = task.catch(() => {});
    return task;
  }

  async ready() {
    await this.initialized;
  }

  async read() {
    await this.initialized;
    await this.queue;
    return structuredClone(this.content);
  }

  async save(content: PortfolioContent) {
    return this.enqueue(async () => {
      await this.initialized;
      if (content.revision !== this.content.revision) return null;
      this.versions.unshift({
        revision: this.content.revision,
        content: structuredClone(this.content),
        createdAt: new Date().toISOString(),
      });
      this.versions = this.versions.slice(0, 50);
      await this.persistJson(this.sidecar("versions"), this.versions);
      const next = { ...content, revision: this.content.revision + 1 };
      await this.persist(next);
      this.content = structuredClone(next);
      return structuredClone(next);
    });
  }

  async listVersions(): Promise<PortfolioVersion[]> {
    await this.initialized;
    await this.queue;
    return this.versions.map(({ revision, createdAt }) => ({
      revision,
      createdAt,
    }));
  }

  async restoreVersion(targetRevision: number, expectedRevision: number) {
    return this.enqueue(async () => {
      await this.initialized;
      if (expectedRevision !== this.content.revision) return null;
      const target = this.versions.find(
        (version) => version.revision === targetRevision,
      );
      if (!target) return null;
      this.versions.unshift({
        revision: this.content.revision,
        content: structuredClone(this.content),
        createdAt: new Date().toISOString(),
      });
      this.versions = this.versions.slice(0, 50);
      const restored = {
        ...structuredClone(target.content),
        revision: this.content.revision + 1,
      };
      await this.persist(restored);
      await this.persistJson(this.sidecar("versions"), this.versions);
      this.content = structuredClone(restored);
      return structuredClone(restored);
    });
  }

  async createContact(
    contact: PortfolioContact,
  ): Promise<PortfolioContactRecord> {
    return this.enqueue(async () => {
      await this.initialized;
      const record: PortfolioContactRecord = {
        ...contact,
        subject: contact.subject ?? "",
        id: randomUUID(),
        status: "new",
        createdAt: new Date().toISOString(),
      };
      this.contacts.unshift(record);
      await this.persistJson(this.sidecar("messages"), this.contacts);
      return structuredClone(record);
    });
  }

  async listContacts(limit: number) {
    await this.initialized;
    await this.queue;
    return structuredClone(this.contacts.slice(0, limit));
  }

  async updateContactStatus(id: string, status: PortfolioContactStatus) {
    return this.enqueue(async () => {
      await this.initialized;
      const contact = this.contacts.find((item) => item.id === id);
      if (!contact) return null;
      contact.status = status;
      await this.persistJson(this.sidecar("messages"), this.contacts);
      return structuredClone(contact);
    });
  }
  async setProjectPassword(projectId: string, passwordHash: string | null) {
    await this.enqueue(async () => {
      await this.initialized;
      if (passwordHash) this.projectPasswords[projectId] = passwordHash;
      else delete this.projectPasswords[projectId];
      await this.persistJson(
        this.sidecar("project-passwords"),
        this.projectPasswords,
      );
    });
  }
  async projectPasswordHash(projectId: string) {
    await this.initialized;
    await this.queue;
    return this.projectPasswords[projectId];
  }
  async recordAnalytics(input: PortfolioAnalyticsInput) {
    await this.enqueue(async () => {
      await this.initialized;
      const day = new Date().toISOString().slice(0, 10);
      const row = this.analytics.find(
        (item) =>
          item.day === day &&
          item.page === input.page &&
          item.event === input.event &&
          item.referrerHost === input.referrerHost,
      );
      if (row) row.count++;
      else this.analytics.push({ ...input, day, count: 1 });
      const cutoff = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      this.analytics = this.analytics.filter((item) => item.day >= cutoff);
      await this.persistJson(this.sidecar("analytics"), this.analytics);
    });
  }
  async listAnalytics() {
    await this.initialized;
    await this.queue;
    return structuredClone(this.analytics).sort(
      (a, b) => b.day.localeCompare(a.day) || b.count - a.count,
    );
  }
}
