import { randomUUID } from "node:crypto";
import type {
  PortfolioContact,
  PortfolioContactRecord,
  PortfolioContactStatus,
  PortfolioContent,
  PortfolioVersion,
} from "@portfolio/contracts";
import {
  initialContent,
  type PortfolioAnalyticsInput,
  type PortfolioAnalyticsRow,
  type PortfolioRepository,
} from "../services/portfolio/src/content.ts";
export class MemoryPortfolio implements PortfolioRepository {
  content = structuredClone(initialContent);
  versions: Array<PortfolioVersion & { content: PortfolioContent }> = [];
  contacts: PortfolioContactRecord[] = [];
  projectPasswords = new Map<string, string>();
  analytics: PortfolioAnalyticsRow[] = [];
  async ready() {}
  async read() {
    return structuredClone(this.content);
  }
  async save(content: PortfolioContent) {
    if (content.revision !== this.content.revision) return null;
    this.versions.unshift({
      revision: this.content.revision,
      content: structuredClone(this.content),
      createdAt: new Date().toISOString(),
    });
    this.versions = this.versions.slice(0, 50);
    this.content = structuredClone({
      ...content,
      revision: content.revision + 1,
    });
    return this.read();
  }
  async listVersions(): Promise<PortfolioVersion[]> {
    return this.versions.map(({ revision, createdAt }) => ({
      revision,
      createdAt,
    }));
  }
  async restoreVersion(targetRevision: number, expectedRevision: number) {
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
    this.content = structuredClone({
      ...target.content,
      revision: this.content.revision + 1,
    });
    return this.read();
  }
  async createContact(contact: PortfolioContact) {
    const record: PortfolioContactRecord = {
      ...contact,
      subject: contact.subject ?? "",
      id: randomUUID(),
      status: "new",
      createdAt: new Date().toISOString(),
    };
    this.contacts.unshift(record);
    return structuredClone(record);
  }
  async listContacts(limit: number) {
    return structuredClone(this.contacts.slice(0, limit));
  }
  async updateContactStatus(id: string, status: PortfolioContactStatus) {
    const contact = this.contacts.find((item) => item.id === id);
    if (!contact) return null;
    contact.status = status;
    return structuredClone(contact);
  }
  async setProjectPassword(projectId: string, passwordHash: string | null) {
    if (passwordHash) this.projectPasswords.set(projectId, passwordHash);
    else this.projectPasswords.delete(projectId);
  }
  async projectPasswordHash(projectId: string) {
    return this.projectPasswords.get(projectId);
  }
  async recordAnalytics(input: PortfolioAnalyticsInput) {
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
  }
  async listAnalytics() {
    return structuredClone(this.analytics);
  }
}
