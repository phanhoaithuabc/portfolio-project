import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import session from "express-session";
import { createPortfolioApp } from "../services/portfolio/src/app.ts";
import { MemoryPortfolio } from "./portfolio-memory.ts";
test("portfolio admin authentication, CSRF, draft filtering and revision conflicts", async () => {
  const repository = new MemoryPortfolio();
  const privateProjectId = randomUUID();
  const unlistedProjectId = randomUUID();
  repository.content.pages = [
    {
      id: randomUUID(),
      slug: "about-the-work",
      title: "About the work",
      navLabel: "Approach",
      summary: "How the work gets done.",
      published: true,
      sortOrder: 0,
      sections: [
        {
          id: randomUUID(),
          type: "text",
          heading: "The approach",
          body: "A thoughtful engineering process.",
          imageAlt: "",
          caption: "",
        },
        {
          id: randomUUID(),
          type: "metrics",
          heading: "The result",
          body: "",
          imageAlt: "",
          caption: "",
          metrics: [{ id: randomUUID(), label: "Deployments", value: "4x" }],
        },
      ],
    },
  ];
  repository.content.projects.push(
    {
      ...structuredClone(repository.content.projects[0]),
      id: privateProjectId,
      slug: "private-case-study",
      title: "Private case study",
      visibility: "password",
    },
    {
      ...structuredClone(repository.content.projects[0]),
      id: unlistedProjectId,
      slug: "unlisted-case-study",
      title: "Unlisted case study",
      visibility: "unlisted",
    },
  );
  const uploadDirectory = await mkdtemp(join(tmpdir(), "portfolio-api-media-"));
  const origin = "http://localhost:5174";
  const server = createPortfolioApp(repository, {
    origin,
    sessionSecret: "unit-test-only-session-secret-at-least-32-characters",
    sessionStore: new session.MemoryStore(),
    secureCookies: false,
    username: "admin",
    passwordHash: await bcrypt.hash("unit-test-only-password", 10),
    uploadDirectory,
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  let cookie = "";
  let csrf = "";
  const call = async (
    path: string,
    method = "GET",
    body?: unknown,
    extra: Record<string, string> = {},
  ) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        origin,
        "X-CSRF-Token": csrf,
        ...extra,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return response;
  };
  try {
    const projectPage = await (
      await call("/projects/personal-portfolio")
    ).text();
    assert.match(
      projectPage,
      /<title>Personal Portfolio \| DevOps &amp; Cloud Engineering<\/title>/,
    );
    assert.match(
      projectPage,
      /property="og:url" content="http:\/\/localhost:5174\/projects\/personal-portfolio"/,
    );
    const customPage = await (await call("/pages/about-the-work")).text();
    assert.match(customPage, /<h2>The approach<\/h2>/);
    assert.match(customPage, /<strong>4x<\/strong>/);
    assert.equal((await call("/pages/not-published")).status, 404);
    const localized = await (await call("/api/portfolio?lang=vi")).json();
    assert.equal(localized.profile.role, "Kỹ sư DevOps & Cloud");
    assert.equal(localized.projects[0].title, "Personal Portfolio");
    assert.equal(localized.pages[0].title, "About the work");
    assert.deepEqual(localized.projectLayout, "editorial");
    assert.equal(
      localized.projects.some(
        (item: { id: string }) =>
          item.id === privateProjectId || item.id === unlistedProjectId,
      ),
      false,
    );
    const sitemap = await (await call("/sitemap.xml")).text();
    assert.match(sitemap, /\/projects\/personal-portfolio/);
    assert.match(sitemap, /\/pages\/about-the-work/);
    assert.doesNotMatch(sitemap, /private-case-study|unlisted-case-study/);
    const privateGate = await call("/projects/private-case-study");
    assert.equal(privateGate.status, 401);
    assert.match(
      await privateGate.text(),
      /name="robots" content="noindex,nofollow,noarchive"/,
    );
    const unlistedPage = await call("/projects/unlisted-case-study");
    assert.match(unlistedPage.headers.get("cache-control") ?? "", /no-store/);
    assert.match(
      await unlistedPage.text(),
      /name="robots" content="noindex,nofollow,noarchive"/,
    );
    assert.equal((await call("/api/admin/analytics")).status, 401);
    assert.equal((await call("/api/admin/content")).status, 401);
    const anonymous = await (await call("/api/admin/session")).json();
    csrf = anonymous.csrf;
    assert.equal(
      (
        await call("/api/admin/login", "POST", {
          username: "admin",
          password: "wrong",
        })
      ).status,
      401,
    );
    const signedIn = await call("/api/admin/login", "POST", {
      username: "admin",
      password: "unit-test-only-password",
    });
    assert.equal(signedIn.status, 200);
    csrf = (await signedIn.json()).csrf;
    assert.equal(
      (await call("/api/admin/preview-page/about-the-work")).status,
      200,
    );
    assert.equal(
      (await call(`/api/admin/projects/${privateProjectId}/password`)).status,
      200,
    );
    assert.equal(
      (
        await call(`/api/admin/projects/${privateProjectId}/password`, "PUT", {
          password: "short",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call(`/api/admin/projects/${privateProjectId}/password`, "PUT", {
          password: "portfolio-private-2026",
        })
      ).status,
      204,
    );
    const expired = Date.now() - 1000;
    const passwordHash = await repository.projectPasswordHash(privateProjectId);
    const expiredSignature = createHmac(
      "sha256",
      "unit-test-only-session-secret-at-least-32-characters",
    )
      .update(`private-case-study.${expired}.${passwordHash}`)
      .digest("hex");
    assert.equal(
      (
        await fetch(`${base}/projects/private-case-study`, {
          headers: {
            cookie: `portfolio.project.private-case-study=${expired}.${expiredSignature}`,
          },
        })
      ).status,
      401,
    );
    const wrongAccess = await fetch(
      `${base}/projects/private-case-study/access?lang=en`,
      {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ password: "incorrect-password" }),
      },
    );
    assert.equal(wrongAccess.status, 401);
    const validAccess = await fetch(
      `${base}/projects/private-case-study/access?lang=en`,
      {
        method: "POST",
        redirect: "manual",
        headers: {
          origin,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ password: "portfolio-private-2026" }),
      },
    );
    assert.equal(validAccess.status, 303);
    const projectCookie = validAccess.headers.get("set-cookie")!.split(";")[0];
    assert.equal(
      (
        await fetch(`${base}/projects/private-case-study`, {
          headers: { cookie: `${cookie}; ${projectCookie}` },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call(`/api/admin/projects/${privateProjectId}/password`, "PUT", {
          password: "portfolio-private-rotated-2026",
        })
      ).status,
      204,
    );
    assert.equal(
      (
        await fetch(`${base}/projects/private-case-study`, {
          headers: { cookie: projectCookie },
        })
      ).status,
      401,
    );
    assert.equal((await call(`/api/admin/export`)).status, 200);
    assert.doesNotMatch(
      await (await call(`/api/admin/export`)).text(),
      /portfolio-private-2026/,
    );
    const noCookieAnalytics = await fetch(`${base}/api/analytics`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        page: "/",
        event: "view",
        referrerHost: "search.example",
      }),
    });
    assert.equal(noCookieAnalytics.status, 204);
    const directAnalytics = await fetch(`${base}/api/analytics`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ page: "/", event: "view", referrerHost: "" }),
    });
    assert.equal(directAnalytics.status, 204);
    const secondAnalytics = await fetch(`${base}/api/analytics`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        page: "/",
        event: "view",
        referrerHost: "search.example",
      }),
    });
    assert.equal(secondAnalytics.status, 204);
    const aggregates = await (await call("/api/admin/analytics")).json();
    assert.equal(
      aggregates.find(
        (item: { page: string; event: string; referrerHost: string }) =>
          item.page === "/" &&
          item.event === "view" &&
          item.referrerHost === "search.example",
      ).count,
      2,
    );
    assert.equal(
      (await call(`/api/admin/projects/${privateProjectId}/password`)).status,
      200,
    );
    const form = new FormData();
    form.set(
      "image",
      new Blob([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])], {
        type: "image/png",
      }),
      "hero.png",
    );
    const uploaded = await fetch(`${base}/api/admin/media`, {
      method: "POST",
      headers: { cookie, origin, "X-CSRF-Token": csrf },
      body: form,
    });
    assert.equal(uploaded.status, 201);
    const mediaFile = await uploaded.json();
    assert.equal((await call(mediaFile.url)).status, 200);
    const mediaLibrary = await (await call("/api/admin/media")).json();
    assert.equal(mediaLibrary[0].id, mediaFile.id);
    repository.content.profile.heroImage = mediaFile.url;
    assert.equal(
      (await call(`/api/admin/media/${mediaFile.id}`, "DELETE")).status,
      409,
    );
    const submitted = await call("/api/contact", "POST", {
      name: "Portfolio Visitor",
      email: "visitor@example.com",
      subject: "Hello",
      message: "I would like to discuss this project.",
      website: "",
    });
    assert.equal(submitted.status, 201);
    const inbox = await (await call("/api/admin/contact-messages")).json();
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].status, "new");
    assert.equal(
      (
        await call("/api/admin/contact-messages", "GET", undefined, {
          cookie: "",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await call(`/api/admin/contact-messages/${inbox[0].id}`, "PATCH", {
          status: "read",
        })
      ).status,
      200,
    );
    const content = await (await call("/api/admin/content")).json();
    content.profile.headline = "Updated profile";
    content.projects[0].published = false;
    assert.equal(
      (
        await call("/api/admin/content", "PUT", content, {
          origin: "https://attacker.example",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/api/admin/content", "PUT", content, {
          "X-CSRF-Token": "invalid",
        })
      ).status,
      403,
    );
    assert.equal(
      (await call("/api/admin/content", "PUT", content)).status,
      200,
    );
    const visible = await (await call("/api/portfolio")).json();
    assert.equal(visible.profile.headline, "Updated profile");
    assert.equal(visible.projects.length, 0);
    const history = await (await call("/api/admin/history")).json();
    assert.equal(history[0].revision, 0);
    const restored = await call("/api/admin/restore", "POST", {
      targetRevision: 0,
      expectedRevision: 1,
    });
    assert.equal(restored.status, 200);
    const restoredContent = await restored.json();
    assert.equal(restoredContent.revision, 2);
    assert.equal(restoredContent.projects[0].published, true);
    assert.equal(
      (await call("/api/admin/content", "PUT", content)).status,
      409,
    );
    assert.equal((await call("/api/admin/logout", "POST")).status, 200);
    assert.equal((await call("/api/admin/content")).status, 401);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(uploadDirectory, { recursive: true, force: true });
  }
});

test("portfolio editors may edit and preview drafts but cannot publish or use owner tools", async () => {
  const repository = new MemoryPortfolio();
  const origin = "http://localhost:5174";
  const server = createPortfolioApp(repository, {
    origin,
    sessionSecret: "unit-test-only-session-secret-at-least-32-characters",
    sessionStore: new session.MemoryStore(),
    secureCookies: false,
    username: "admin",
    passwordHash: await bcrypt.hash("unit-test-owner-password", 10),
    editorUsername: "editor",
    editorPasswordHash: await bcrypt.hash("unit-test-editor-password", 10),
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  let cookie = "";
  let csrf = "";
  const call = async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        origin,
        "X-CSRF-Token": csrf,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return response;
  };
  try {
    const anonymous = await (await call("/api/admin/session")).json();
    csrf = anonymous.csrf;
    const signedIn = await call("/api/admin/login", "POST", {
      username: "editor",
      password: "unit-test-editor-password",
    });
    assert.equal(signedIn.status, 200);
    const sessionInfo = await signedIn.json();
    assert.equal(sessionInfo.role, "editor");
    csrf = sessionInfo.csrf;
    const content = await (await call("/api/admin/content")).json();
    const published = content.projects[0];
    content.profile.headline = "Editor cannot change profile";
    assert.equal(
      (await call("/api/admin/content", "PUT", content)).status,
      403,
    );
    content.profile.headline = repository.content.profile.headline;
    content.pages.push({
      id: randomUUID(),
      slug: "editor-owned-page",
      title: "Page",
      navLabel: "Page",
      summary: "",
      sections: [],
      published: false,
      sortOrder: 0,
    });
    assert.equal(
      (await call("/api/admin/content", "PUT", content)).status,
      403,
    );
    content.pages = [];
    content.projects[0].visibility = "unlisted";
    assert.equal(
      (await call("/api/admin/content", "PUT", content)).status,
      403,
    );
    delete content.projects[0].visibility;
    content.projects.push({
      ...published,
      id: "9ac8ef8f-9f06-4dcf-90ce-23df44ae47fa",
      slug: "editor-draft",
      title: "Editor draft",
      published: false,
      featured: false,
      sortOrder: 1,
    });
    assert.equal(
      (await call("/api/admin/content", "PUT", content)).status,
      200,
    );
    assert.equal((await call("/api/admin/preview/editor-draft")).status, 200);
    const updated = await (await call("/api/admin/content")).json();
    updated.projects.find(
      (project: { slug: string }) => project.slug === "editor-draft",
    ).published = true;
    assert.equal(
      (await call("/api/admin/content", "PUT", updated)).status,
      403,
    );
    assert.equal((await call("/api/admin/history")).status, 403);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
