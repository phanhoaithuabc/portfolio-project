import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import session from "express-session";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import multer from "multer";
import { mkdir, readFile } from "node:fs/promises";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  portfolioContactSchema,
  portfolioContactStatusSchema,
  portfolioContentSchema,
  type PortfolioContent,
} from "@portfolio/contracts";
import type { PortfolioRepository } from "./content.ts";
import {
  getPortfolioLocale,
  localizeProfile,
  localizePage,
  localizeProject,
} from "./localization.ts";
import {
  renderProjectPasswordDocument,
  renderPortfolioPageDocument,
  renderProjectDocument,
} from "./project-page.ts";
import {
  FilePortfolioMediaStore,
  MAX_PORTFOLIO_IMAGE_BYTES,
  type PortfolioMediaStore,
} from "./media.ts";
import {
  instrument,
  logger,
} from "../../../packages/observability/src/http.ts";
declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
    csrf?: string;
    role?: "owner" | "editor";
  }
}
export interface PortfolioOptions {
  origin: string;
  sessionSecret: string;
  sessionStore: session.Store;
  secureCookies: boolean;
  username: string;
  passwordHash?: string;
  editorUsername?: string;
  editorPasswordHash?: string;
  trustProxy?: number;
  uploadDirectory?: string;
  mediaStore?: PortfolioMediaStore;
}
function editorCanSave(current: PortfolioContent, next: PortfolioContent) {
  if (JSON.stringify(current.profile) !== JSON.stringify(next.profile))
    return false;
  if (
    JSON.stringify(current.pages ?? []) !== JSON.stringify(next.pages ?? []) ||
    (current.projectLayout ?? "editorial") !==
      (next.projectLayout ?? "editorial")
  )
    return false;
  const nextProjects = new Map(
    next.projects.map((project) => [project.id, project]),
  );
  const currentProjects = new Map(
    current.projects.map((project) => [project.id, project]),
  );
  for (const project of current.projects.filter((item) => item.published)) {
    const updated = nextProjects.get(project.id);
    if (!updated || JSON.stringify(updated) !== JSON.stringify(project))
      return false;
  }
  for (const project of next.projects) {
    const before = currentProjects.get(project.id);
    if (
      (project.published && !before?.published) ||
      (before &&
        (project.featured !== before.featured ||
          project.sortOrder !== before.sortOrder ||
          (project.visibility ?? "public") !== (before.visibility ?? "public")))
    )
      return false;
  }
  return true;
}
export function createPortfolioApp(
  repository: PortfolioRepository,
  options: PortfolioOptions,
) {
  function requireOwner(
    request: express.Request,
    response: express.Response,
    next: express.NextFunction,
  ) {
    if (request.session.role !== "owner")
      return response.status(403).json({ message: "Owner access required." });
    next();
  }
  if (options.sessionSecret.length < 32)
    throw new Error(
      "Portfolio session secret must have at least 32 characters",
    );
  const origin = new URL(options.origin).origin;
  const uploadDirectory =
    options.uploadDirectory ??
    process.env.PORTFOLIO_UPLOAD_DIR ??
    "data/uploads";
  const mediaStore =
    options.mediaStore ?? new FilePortfolioMediaStore(uploadDirectory);
  const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PORTFOLIO_IMAGE_BYTES, files: 1 },
  });
  const adminFeatureRoutes = express.Router();
  const app = express();
  app.disable("x-powered-by");
  if (options.trustProxy) app.set("trust proxy", options.trustProxy);
  if (!options.mediaStore)
    void mkdir(uploadDirectory, { recursive: true, mode: 0o750 });
  app.use(helmet({ contentSecurityPolicy: false }));
  instrument(app, "portfolio-api");
  app.get("/media/:filename", async (request, response, next) => {
    try {
      const media = await mediaStore.read(String(request.params.filename));
      if (!media) return response.sendStatus(404);
      response
        .set("X-Content-Type-Options", "nosniff")
        .set("Cache-Control", "public,max-age=31536000,immutable")
        .type(media.type)
        .send(media.data);
    } catch (error) {
      next(error);
    }
  });
  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.get("/ready", async (_request, response) => {
    try {
      await repository.ready();
      response.json({ status: "ready" });
    } catch {
      response.sendStatus(503);
    }
  });
  app.get("/api/portfolio", async (request, response) => {
    try {
      const content = await repository.read();
      const locale = getPortfolioLocale(request.query.lang);
      response.set("Cache-Control", "public, max-age=30").json({
        profile: localizeProfile(content.profile, locale),
        projects: content.projects
          .filter(
            (project) =>
              project.published &&
              (project.visibility ?? "public") === "public",
          )
          .sort((first, second) => first.sortOrder - second.sortOrder)
          .map((project) => localizeProject(project, locale)),
        pages: (content.pages ?? [])
          .filter((page) => page.published)
          .sort((first, second) => first.sortOrder - second.sortOrder)
          .map((page) => localizePage(page, locale)),
        projectLayout: content.projectLayout ?? "editorial",
      });
    } catch {
      response
        .status(503)
        .json({ message: "The portfolio is temporarily unavailable." });
    }
  });
  app.post(
    "/api/analytics",
    rateLimit({
      windowMs: 60_000,
      limit: 90,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
    express.json({ limit: "2kb" }),
    async (request, response) => {
      const hostPattern =
        /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
      const input = z
        .object({
          page: z
            .string()
            .regex(/^\/(?:|projects\/[a-z0-9-]{1,80}|pages\/[a-z0-9-]{1,80})$/),
          event: z.enum(["view", "outbound", "contact"]),
          referrerHost: z
            .string()
            .max(253)
            .refine((value) => value === "" || hostPattern.test(value))
            .default(""),
        })
        .safeParse(request.body);
      if (!input.success)
        return response
          .status(400)
          .json({ message: "Invalid analytics event." });
      try {
        await repository.recordAnalytics(input.data);
        response.sendStatus(204);
      } catch (error) {
        logger.error({ error: String(error) }, "portfolio_analytics_failed");
        response.sendStatus(503);
      }
    },
  );
  adminFeatureRoutes.get(
    "/analytics",
    requireOwner,
    async (_request, response) => {
      try {
        response.json(await repository.listAnalytics());
      } catch (error) {
        logger.error(
          { error: String(error) },
          "portfolio_analytics_read_failed",
        );
        response.status(503).json({ message: "Unable to load analytics." });
      }
    },
  );
  adminFeatureRoutes.get(
    "/projects/:id/password",
    requireOwner,
    async (request, response) => {
      response.json({
        configured: Boolean(
          await repository.projectPasswordHash(String(request.params.id)),
        ),
      });
    },
  );
  adminFeatureRoutes.put(
    "/projects/:id/password",
    requireOwner,
    express.json({ limit: "2kb" }),
    async (request, response) => {
      const input = z
        .object({ password: z.string().min(12).max(128) })
        .safeParse(request.body);
      if (!input.success)
        return response.status(400).json({
          message: "Use a project password between 12 and 128 characters.",
        });
      const content = await repository.read();
      if (!content.projects.some((project) => project.id === request.params.id))
        return response.sendStatus(404);
      await repository.setProjectPassword(
        String(request.params.id),
        await bcrypt.hash(input.data.password, 12),
      );
      response.sendStatus(204);
    },
  );
  adminFeatureRoutes.delete(
    "/projects/:id/password",
    requireOwner,
    async (request, response) => {
      const content = await repository.read();
      if (!content.projects.some((project) => project.id === request.params.id))
        return response.sendStatus(404);
      await repository.setProjectPassword(String(request.params.id), null);
      response.sendStatus(204);
    },
  );
  app.get("/sitemap.xml", async (_request, response) => {
    try {
      const content = await repository.read();
      const urls = content.projects
        .filter(
          (project) =>
            project.published && (project.visibility ?? "public") === "public",
        )
        .map(
          (project) =>
            `<url><loc>${origin}/projects/${encodeURIComponent(project.slug)}</loc></url>`,
        )
        .join("");
      const pageUrls = (content.pages ?? [])
        .filter((page) => page.published)
        .map(
          (page) =>
            `<url><loc>${origin}/pages/${encodeURIComponent(page.slug)}</loc></url>`,
        )
        .join("");
      response
        .type("application/xml")
        .set("Cache-Control", "public, max-age=300")
        .send(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url>${urls}${pageUrls}</urlset>`,
        );
    } catch (error) {
      logger.error({ error: String(error) }, "portfolio_sitemap_failed");
      response
        .status(503)
        .type("text")
        .send("Sitemap temporarily unavailable.");
    }
  });
  app.post(
    "/api/contact",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 5,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { message: "Too many messages. Please try again later." },
    }),
    express.json({ limit: "8kb" }),
    async (request, response) => {
      const body = request.body as Record<string, unknown>;
      if (typeof body.website === "string" && body.website.trim())
        return response.status(202).json({ submitted: true });
      const contact = portfolioContactSchema.safeParse(body);
      if (!contact.success)
        return response.status(400).json({
          message: contact.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .slice(0, 4)
            .join("; "),
        });
      try {
        await repository.createContact(contact.data);
        response.status(201).json({ submitted: true });
      } catch (error) {
        logger.error({ error: String(error) }, "portfolio_contact_failed");
        response.status(503).json({ message: "Unable to save your message." });
      }
    },
  );
  app.get("/pages/:slug", async (request, response) => {
    try {
      const content = await repository.read();
      const page = (content.pages ?? []).find(
        (item) => item.slug === request.params.slug && item.published,
      );
      if (!page) return response.sendStatus(404);
      const locale = getPortfolioLocale(request.query.lang);
      const template = await readFile(
        new URL("./project-page.html", import.meta.url),
        "utf8",
      );
      response
        .type("html")
        .set("Cache-Control", "public, max-age=60")
        .send(
          renderPortfolioPageDocument(
            template,
            localizeProfile(content.profile, locale),
            localizePage(page, locale),
            origin,
            locale,
          ),
        );
    } catch (error) {
      logger.error({ error: String(error) }, "portfolio_page_failed");
      response.status(503).send("Portfolio temporarily unavailable.");
    }
  });
  app.get("/projects/:slug", async (request, response) => {
    try {
      const content = await repository.read();
      const project = content.projects.find(
        (item) => item.slug === request.params.slug && item.published,
      );
      if (!project) return response.sendStatus(404);
      const locale = getPortfolioLocale(request.query.lang);
      if ((project.visibility ?? "public") === "password") {
        const passwordHash = await repository.projectPasswordHash(project.id);
        const token = (request.get("Cookie") ?? "")
          .split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith("portfolio.project."))
          ?.split("=")
          .slice(1)
          .join("=");
        const parts = token?.split(".");
        const expires = Number(parts?.[0]);
        const payload = `${project.slug}.${expires}.${passwordHash ?? "missing"}`;
        const expected = createHmac("sha256", options.sessionSecret)
          .update(payload)
          .digest("hex");
        const received = Buffer.from(parts?.[1] ?? "");
        const expectedBytes = Buffer.from(expected);
        const valid =
          Boolean(passwordHash) &&
          Number.isSafeInteger(expires) &&
          expires > Date.now() &&
          received.length === expectedBytes.length &&
          timingSafeEqual(received, expectedBytes);
        if (!valid) {
          const template = await readFile(
            new URL("./project-page.html", import.meta.url),
            "utf8",
          );
          return response
            .status(401)
            .type("html")
            .set("Cache-Control", "no-store")
            .send(renderProjectPasswordDocument(template, project, locale));
        }
      }
      const template = await readFile(
        new URL("./project-page.html", import.meta.url),
        "utf8",
      );
      response
        .type("html")
        .set(
          "Cache-Control",
          (project.visibility ?? "public") === "public"
            ? "public, max-age=60"
            : "no-store",
        )
        .send(
          renderProjectDocument(
            template,
            localizeProfile(content.profile, locale),
            localizeProject(project, locale),
            origin,
            locale,
          ),
        );
    } catch (error) {
      logger.error({ error: String(error) }, "portfolio_project_page_failed");
      response.status(503).send("Portfolio temporarily unavailable.");
    }
  });
  app.post(
    "/projects/:slug/access",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 8,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
    express.urlencoded({ extended: false, limit: "2kb" }),
    async (request, response) => {
      try {
        const content = await repository.read();
        const project = content.projects.find(
          (item) =>
            item.slug === request.params.slug &&
            item.published &&
            item.visibility === "password",
        );
        if (!project) return response.sendStatus(404);
        const password =
          typeof request.body?.password === "string"
            ? request.body.password
            : "";
        const hash = await repository.projectPasswordHash(project.id);
        if (
          !hash ||
          Buffer.byteLength(password) > 128 ||
          !(await bcrypt.compare(password, hash))
        ) {
          const locale = getPortfolioLocale(request.query.lang);
          const template = await readFile(
            new URL("./project-page.html", import.meta.url),
            "utf8",
          );
          return response
            .status(401)
            .type("html")
            .set("Cache-Control", "no-store")
            .send(renderProjectPasswordDocument(template, project, locale));
        }
        const expires = Date.now() + 8 * 60 * 60 * 1000;
        const payload = `${project.slug}.${expires}.${hash}`;
        const signature = createHmac("sha256", options.sessionSecret)
          .update(payload)
          .digest("hex");
        const cookie = `portfolio.project.${project.slug}=${expires}.${signature}; HttpOnly; SameSite=Lax; Path=/projects/${encodeURIComponent(project.slug)}; Max-Age=28800${options.secureCookies ? "; Secure" : ""}`;
        response
          .set("Set-Cookie", cookie)
          .redirect(
            303,
            `/projects/${encodeURIComponent(project.slug)}?lang=${getPortfolioLocale(request.query.lang)}`,
          );
      } catch (error) {
        logger.error(
          { error: String(error) },
          "portfolio_private_project_access_failed",
        );
        response.status(503).send("Portfolio temporarily unavailable.");
      }
    },
  );
  adminFeatureRoutes.get(
    "/analytics",
    requireOwner,
    async (_request, response) => {
      try {
        response.json(await repository.listAnalytics());
      } catch (error) {
        logger.error(
          { error: String(error) },
          "portfolio_analytics_read_failed",
        );
        response.status(503).json({ message: "Unable to load analytics." });
      }
    },
  );
  adminFeatureRoutes.get(
    "/projects/:id/password",
    requireOwner,
    async (request, response) => {
      if (!z.uuid().safeParse(request.params.id).success)
        return response.sendStatus(404);
      response.json({
        configured: Boolean(
          await repository.projectPasswordHash(String(request.params.id)),
        ),
      });
    },
  );
  adminFeatureRoutes.put(
    "/projects/:id/password",
    requireOwner,
    express.json({ limit: "2kb" }),
    async (request, response) => {
      if (!z.uuid().safeParse(request.params.id).success)
        return response.sendStatus(404);
      const input = z
        .object({ password: z.string().min(12).max(128) })
        .safeParse(request.body);
      if (!input.success)
        return response.status(400).json({
          message: "Use a project password between 12 and 128 characters.",
        });
      await repository.setProjectPassword(
        String(request.params.id),
        await bcrypt.hash(input.data.password, 12),
      );
      response.sendStatus(204);
    },
  );
  adminFeatureRoutes.delete(
    "/projects/:id/password",
    requireOwner,
    async (request, response) => {
      if (!z.uuid().safeParse(request.params.id).success)
        return response.sendStatus(404);
      await repository.setProjectPassword(String(request.params.id), null);
      response.sendStatus(204);
    },
  );
  adminFeatureRoutes.get(
    "/history",
    requireOwner,
    async (_request, response) => {
      try {
        response.json(await repository.listVersions());
      } catch (error) {
        logger.error({ error: String(error) }, "portfolio_history_failed");
        response
          .status(503)
          .json({ message: "Unable to load version history." });
      }
    },
  );
  adminFeatureRoutes.get("/preview/:slug", async (request, response) => {
    try {
      const content = await repository.read();
      const project = content.projects.find(
        (item) => item.slug === request.params.slug,
      );
      if (!project) return response.sendStatus(404);
      const locale = getPortfolioLocale(request.query.lang);
      const template = await readFile(
        new URL("./project-page.html", import.meta.url),
        "utf8",
      );
      response
        .type("html")
        .set("Cache-Control", "no-store")
        .send(
          renderProjectDocument(
            template,
            localizeProfile(content.profile, locale),
            localizeProject(project, locale),
            origin,
            locale,
          ),
        );
    } catch (error) {
      logger.error({ error: String(error) }, "portfolio_preview_failed");
      response.status(503).send("Preview temporarily unavailable.");
    }
  });
  adminFeatureRoutes.get("/preview-page/:slug", async (request, response) => {
    try {
      const content = await repository.read();
      const page = (content.pages ?? []).find(
        (item) => item.slug === request.params.slug,
      );
      if (!page) return response.sendStatus(404);
      const locale = getPortfolioLocale(request.query.lang);
      const template = await readFile(
        new URL("./project-page.html", import.meta.url),
        "utf8",
      );
      response
        .type("html")
        .set("Cache-Control", "no-store")
        .send(
          renderPortfolioPageDocument(
            template,
            localizeProfile(content.profile, locale),
            localizePage(page, locale),
            origin,
            locale,
          ),
        );
    } catch (error) {
      logger.error({ error: String(error) }, "portfolio_preview_page_failed");
      response.status(503).send("Preview temporarily unavailable.");
    }
  });
  adminFeatureRoutes.post(
    "/restore",
    requireOwner,
    express.json({ limit: "4kb" }),
    async (request, response) => {
      const input = z
        .object({
          targetRevision: z.number().int().nonnegative(),
          expectedRevision: z.number().int().nonnegative(),
        })
        .safeParse(request.body);
      if (!input.success)
        return response
          .status(400)
          .json({ message: "Invalid restore request." });
      const restored = await repository.restoreVersion(
        input.data.targetRevision,
        input.data.expectedRevision,
      );
      if (!restored)
        return response.status(409).json({
          message:
            "Content changed or that version is unavailable. Reload history.",
        });
      response.json(restored);
    },
  );
  adminFeatureRoutes.get(
    "/export",
    requireOwner,
    async (_request, response) => {
      try {
        response
          .type("application/json")
          .attachment("portfolio-content.json")
          .send(JSON.stringify(await repository.read(), null, 2));
      } catch (error) {
        logger.error({ error: String(error) }, "portfolio_export_failed");
        response
          .status(503)
          .json({ message: "Unable to export portfolio content." });
      }
    },
  );
  adminFeatureRoutes.post(
    "/import",
    requireOwner,
    express.json({ limit: "512kb" }),
    async (request, response) => {
      const imported = portfolioContentSchema.safeParse(request.body);
      if (!imported.success)
        return response.status(400).json({
          message: imported.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .slice(0, 5)
            .join("; "),
        });
      const current = await repository.read();
      const saved = await repository.save({
        ...imported.data,
        revision: current.revision,
      });
      if (!saved)
        return response.status(409).json({
          message: "Content changed during import. Reload and retry.",
        });
      response.json(saved);
    },
  );
  adminFeatureRoutes.get(
    "/contact-messages",
    requireOwner,
    async (_request, response) => {
      try {
        response.json(await repository.listContacts(100));
      } catch (error) {
        logger.error({ error: String(error) }, "portfolio_inbox_failed");
        response.status(503).json({ message: "Unable to load the inbox." });
      }
    },
  );
  adminFeatureRoutes.patch(
    "/contact-messages/:id",
    requireOwner,
    express.json({ limit: "2kb" }),
    async (request, response) => {
      const input = z
        .object({ status: portfolioContactStatusSchema })
        .safeParse(request.body);
      if (!input.success)
        return response
          .status(400)
          .json({ message: "Invalid message status." });
      const message = await repository.updateContactStatus(
        String(request.params.id),
        input.data.status,
      );
      if (!message) return response.sendStatus(404);
      response.json(message);
    },
  );
  adminFeatureRoutes.get("/media", async (_request, response) => {
    try {
      response.json(await mediaStore.list());
    } catch (error) {
      logger.error({ error: String(error) }, "portfolio_media_list_failed");
      response.status(503).json({ message: "Unable to load media." });
    }
  });
  adminFeatureRoutes.post(
    "/media",
    imageUpload.single("image"),
    async (request, response) => {
      if (!request.file)
        return response
          .status(400)
          .json({ message: "Choose an image to upload." });
      try {
        response.status(201).json(await mediaStore.save(request.file.buffer));
      } catch (error) {
        response.status(400).json({
          message: error instanceof Error ? error.message : "Invalid image.",
        });
      }
    },
  );
  adminFeatureRoutes.delete(
    "/media/:id",
    requireOwner,
    async (request, response) => {
      const content = await repository.read();
      const file = (await mediaStore.list()).find(
        (item) => item.id === request.params.id,
      );
      if (!file) return response.sendStatus(404);
      const url = file.url;
      const used =
        content.profile.heroImage === url ||
        content.profile.ogImage === url ||
        content.projects.some(
          (project) => project.coverImage === url || project.ogImage === url,
        );
      if (used)
        return response.status(409).json({
          message: "This image is in use. Replace it before deleting.",
        });
      if (!(await mediaStore.remove(String(request.params.id))))
        return response.sendStatus(404);
      response.sendStatus(204);
    },
  );
  app.use(
    "/api/admin",
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { message: "Too many requests. Please try again shortly." },
    }),
    session({
      name: "portfolio.sid",
      secret: options.sessionSecret,
      store: options.sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: options.secureCookies,
        sameSite: "strict",
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );
  app.use("/api/admin", (_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/admin/session", (request, response) => {
    request.session.csrf ??= randomBytes(32).toString("hex");
    response.json({
      authenticated: Boolean(request.session.authenticated),
      role:
        request.session.role ??
        (request.session.authenticated ? "owner" : null),
      csrf: request.session.csrf,
      configured: Boolean(options.passwordHash || options.editorPasswordHash),
    });
  });
  app.use("/api/admin", (request, response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
    const received = Buffer.from(request.get("X-CSRF-Token") ?? "");
    const expected = Buffer.from(request.session.csrf ?? "");
    if (
      request.get("Origin") !== origin ||
      !expected.length ||
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      return response.status(403).json({
        message: "Security check failed. Refresh the page and try again.",
      });
    next();
  });
  app.post(
    "/api/admin/login",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 5,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: {
        message: "Too many sign-in attempts. Try again in 15 minutes.",
      },
    }),
    express.json({ limit: "4kb" }),
    async (request, response) => {
      if (!options.passwordHash && !options.editorPasswordHash)
        return response
          .status(503)
          .json({ message: "Admin credentials have not been configured." });
      const credentials = z
        .object({
          username: z.string().min(1).max(100),
          password: z.string().min(1).max(72),
        })
        .safeParse(request.body);
      if (
        !credentials.success ||
        Buffer.byteLength(credentials.data.password) > 72
      )
        return response.status(400).json({ message: "Invalid login details." });
      const users = [
        {
          username: options.username,
          passwordHash: options.passwordHash,
          role: "owner" as const,
        },
        {
          username: options.editorUsername,
          passwordHash: options.editorPasswordHash,
          role: "editor" as const,
        },
      ];
      const user = users.find(
        (candidate) =>
          candidate.username === credentials.data.username &&
          candidate.passwordHash,
      );
      const matched = user?.passwordHash
        ? await bcrypt.compare(credentials.data.password, user.passwordHash)
        : false;
      if (!matched || !user)
        return response
          .status(401)
          .json({ message: "Username or password is incorrect." });
      request.session.regenerate((error) => {
        if (error)
          return response
            .status(503)
            .json({ message: "Unable to create a session." });
        request.session.authenticated = true;
        request.session.role = user.role;
        request.session.csrf = randomBytes(32).toString("hex");
        request.session.save((saveError) =>
          saveError
            ? response
                .status(503)
                .json({ message: "Unable to save the session." })
            : response.json({
                authenticated: true,
                role: user.role,
                csrf: request.session.csrf,
              }),
        );
      });
    },
  );
  app.use("/api/admin", (request, response, next) => {
    if (!request.session.authenticated)
      return response.status(401).json({ message: "Please sign in." });
    request.session.role ??= "owner";
    next();
  });
  app.use("/api/admin", adminFeatureRoutes);
  app.post("/api/admin/logout", (request, response) => {
    request.session.destroy((error) => {
      if (error)
        return response.status(503).json({ message: "Unable to sign out." });
      response
        .clearCookie("portfolio.sid", {
          httpOnly: true,
          sameSite: "strict",
          secure: options.secureCookies,
        })
        .json({ authenticated: false });
    });
  });
  app.get("/api/admin/content", async (_request, response) => {
    try {
      response.json(await repository.read());
    } catch {
      response.status(503).json({ message: "Unable to load content." });
    }
  });
  app.put(
    "/api/admin/content",
    express.json({ limit: "256kb" }),
    async (request, response) => {
      const content = portfolioContentSchema.safeParse(request.body);
      if (!content.success)
        return response.status(400).json({
          message: content.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .slice(0, 5)
            .join("; "),
        });
      try {
        const previousContent = await repository.read();
        if (request.session.role === "editor") {
          if (!editorCanSave(previousContent, content.data))
            return response.status(403).json({
              message:
                "Editors may edit draft projects only; profile changes and publishing require the owner.",
            });
        }
        for (const project of content.data.projects.filter(
          (item) => item.visibility === "password",
        )) {
          if (!(await repository.projectPasswordHash(project.id)))
            return response.status(400).json({
              message: `Set a password for "${project.title}" before saving its private visibility.`,
            });
        }
        const saved = await repository.save(content.data);
        if (!saved)
          return response.status(409).json({
            message:
              "Content was changed in another session. Reload before saving.",
          });
        response.json(saved);
      } catch (error) {
        logger.error({ error: String(error) }, "portfolio_save_failed");
        response.status(503).json({ message: "Unable to save your changes." });
      }
    },
  );
  app.use((_request, response) =>
    response.status(404).json({ message: "Endpoint not found." }),
  );
  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      const status =
        error && typeof error === "object" && "status" in error
          ? error.status
          : 500;
      if (status === 400 || status === 413)
        return response.status(status).json({
          message:
            status === 413 ? "Content is too large." : "Invalid request body.",
        });
      logger.error(
        { errorType: error instanceof Error ? error.name : "Error" },
        "portfolio_request_failed",
      );
      response.status(503).json({
        message: "The request could not be completed. Try again shortly.",
      });
    },
  );
  return app;
}
