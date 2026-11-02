import type {
  PortfolioBlock,
  PortfolioPage,
  PortfolioProfile,
  PortfolioProject,
} from "@portfolio/contracts";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function absoluteUrl(value: string | undefined, origin: string) {
  if (!value) return "";
  try {
    return new URL(value, origin).href;
  } catch {
    return "";
  }
}

function replaceMeta(
  html: string,
  attribute: "name" | "property",
  key: string,
  content: string,
) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta\\s+${attribute}=["']${escapedKey}["']\\s+content=["'][^"']*["']\\s*\\/?\\s*>`,
    "i",
  );
  const tag = `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(content)}" />`;
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace("</head>", `  ${tag}\n  </head>`);
}

function replaceCanonical(html: string, href: string) {
  const tag = `<link rel="canonical" href="${escapeHtml(href)}" />`;
  const pattern =
    /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?\s*>/i;
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace("</head>", `  ${tag}\n  </head>`);
}

function renderVideo(url: string, title: string) {
  try {
    const parsed = new URL(url);
    let embed = "";
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
        parsed.hostname,
      )
    ) {
      const id = parsed.searchParams.get("v");
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id))
        embed = `https://www.youtube-nocookie.com/embed/${id}`;
    } else if (
      parsed.hostname === "youtu.be" &&
      /^[a-zA-Z0-9_-]{11}$/.test(parsed.pathname.slice(1))
    ) {
      embed = `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`;
    } else if (["vimeo.com", "www.vimeo.com"].includes(parsed.hostname)) {
      const id = parsed.pathname.split("/").filter(Boolean).at(-1);
      if (id && /^\d+$/.test(id))
        embed = `https://player.vimeo.com/video/${id}`;
    }
    return embed
      ? `<div class="case-video"><iframe src="${embed}" title="${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer" allow="fullscreen; picture-in-picture" allowfullscreen></iframe></div>`
      : `<a class="case-video-link" href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(title)}</a>`;
  } catch {
    return "";
  }
}

function renderBlocks(
  blocks: PortfolioBlock[],
  fallback: string,
  origin: string,
) {
  if (!blocks.length)
    return fallback
      .split(/\n\n+/)
      .map(
        (paragraph) =>
          `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
      )
      .join("\n");
  return blocks
    .map((block) => {
      const heading = block.heading
        ? `<h2>${escapeHtml(block.heading)}</h2>`
        : "";
      if (block.type === "text")
        return `<section class="case-section case-text">${heading}<p>${escapeHtml(block.body).replace(/\n/g, "<br />")}</p></section>`;
      if (block.type === "image") {
        const url = absoluteUrl(block.image, origin);
        return `<figure class="case-section case-image">${heading}<img src="${escapeHtml(url)}" alt="${escapeHtml(block.imageAlt)}" loading="lazy" />${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}</figure>`;
      }
      if (block.type === "gallery")
        return `<section class="case-section case-gallery">${heading}<div>${(block.images ?? []).map((image) => `<figure><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" loading="lazy" />${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ""}</figure>`).join("")}</div></section>`;
      if (block.type === "video")
        return `<section class="case-section case-video-section">${heading}${renderVideo(block.videoUrl ?? "", block.caption || block.heading || "Project video")}${block.caption ? `<p>${escapeHtml(block.caption)}</p>` : ""}</section>`;
      return `<section class="case-section case-metrics">${heading}<div>${(block.metrics ?? []).map((metric) => `<article><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(metric.label)}</span></article>`).join("")}</div></section>`;
    })
    .join("\n");
}

function renderPageShell(
  template: string,
  profile: PortfolioProfile,
  title: string,
  summary: string,
  slug: string,
  sections: PortfolioBlock[],
  origin: string,
  locale: "en" | "vi",
  image?: string,
) {
  const canonical = new URL(`/pages/${slug}`, origin).href;
  let html = template.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`,
  );
  html = replaceMeta(html, "name", "description", summary);
  html = replaceMeta(html, "property", "og:type", "article");
  html = replaceMeta(html, "property", "og:title", title);
  html = replaceMeta(html, "property", "og:description", summary);
  html = replaceMeta(html, "property", "og:url", canonical);
  if (image)
    html = replaceMeta(
      html,
      "property",
      "og:image",
      absoluteUrl(image, origin),
    );
  html = replaceCanonical(html, canonical);
  html = html.replace('<html lang="en">', `<html lang="${locale}">`);
  html = html.replace(
    '<main id="project-content"></main>',
    `<header><a class="wordmark" href="/">${escapeHtml(profile.name)}</a><nav><a href="/?lang=en">EN</a><a href="/?lang=vi">VI</a><a href="/#work">${locale === "vi" ? "Tất cả dự án" : "All projects"}</a></nav></header><main><a class="back" href="/#work">← ${locale === "vi" ? "Trang chủ" : "Home"}</a><h1>${escapeHtml(title)}</h1>${summary ? `<p class="summary">${escapeHtml(summary)}</p>` : ""}<article class="case-content">${renderBlocks(sections, "", origin)}</article></main><footer>© ${new Date().getFullYear()} ${escapeHtml(profile.name)}</footer>`,
  );
  return html;
}

function renderBody(
  profile: PortfolioProfile,
  project: PortfolioProject,
  origin: string,
  locale: "en" | "vi",
) {
  const content = renderBlocks(
    project.sections ?? [],
    project.description,
    origin,
  );
  const tags = project.tags
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("\n");
  const image = absoluteUrl(project.coverImage, origin);
  const copy =
    locale === "vi"
      ? { allProjects: "Tất cả dự án", visit: "Xem dự án", source: "Mã nguồn" }
      : {
          allProjects: "All projects",
          visit: "Visit project",
          source: "Source code",
        };
  const liveLink = project.liveUrl
    ? `<a class="button primary" href="${escapeHtml(project.liveUrl)}" rel="noopener noreferrer">${copy.visit}</a>`
    : "";
  const repositoryLink = project.repositoryUrl
    ? `<a class="button secondary" href="${escapeHtml(project.repositoryUrl)}" rel="noopener noreferrer">${copy.source}</a>`
    : "";
  return `<header><a class="wordmark" href="/">${escapeHtml(profile.name)}</a><nav><a href="/?lang=en">EN</a><a href="/projects/${encodeURIComponent(project.slug)}?lang=vi">VI</a><a href="/#work">${copy.allProjects}</a></nav></header><main><a class="back" href="/#work">← ${copy.allProjects}</a>${image ? `<img class="cover" src="${escapeHtml(image)}" alt="${escapeHtml(project.coverImageAlt || project.title)}" />` : ""}<p class="eyebrow">${escapeHtml(project.category)} · ${escapeHtml(project.year)}</p><h1>${escapeHtml(project.title)}</h1><p class="summary">${escapeHtml(project.summary)}</p><div class="tags">${tags}</div><article class="case-content">${content}</article><div class="actions">${liveLink}${repositoryLink}</div></main><footer>© ${new Date().getFullYear()} ${escapeHtml(profile.name)}</footer>`;
}

export function renderProjectDocument(
  template: string,
  profile: PortfolioProfile,
  project: PortfolioProject,
  origin: string,
  locale: "en" | "vi" = "en",
) {
  const title = project.seoTitle || `${project.title} | ${profile.name}`;
  const description = project.seoDescription || project.summary;
  const canonical = new URL(`/projects/${project.slug}`, origin).href;
  const image = absoluteUrl(
    project.ogImage ||
      project.coverImage ||
      profile.ogImage ||
      profile.heroImage,
    origin,
  );
  let html = template.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`,
  );
  html = replaceMeta(html, "name", "description", description);
  html = replaceMeta(html, "property", "og:type", "article");
  html = replaceMeta(html, "property", "og:title", title);
  html = replaceMeta(html, "property", "og:description", description);
  html = replaceMeta(html, "property", "og:url", canonical);
  if ((project.visibility ?? "public") !== "public")
    html = replaceMeta(html, "name", "robots", "noindex,nofollow,noarchive");
  html = replaceCanonical(html, canonical);
  if (image) html = replaceMeta(html, "property", "og:image", image);
  html = replaceMeta(html, "name", "twitter:card", "summary_large_image");
  html = replaceMeta(html, "name", "twitter:title", title);
  html = replaceMeta(html, "name", "twitter:description", description);
  if (image) html = replaceMeta(html, "name", "twitter:image", image);
  html = html.replace('<html lang="en">', `<html lang="${locale}">`);
  html = html.replace(
    '<main id="project-content"></main>',
    renderBody(profile, project, origin, locale),
  );
  return html;
}

export function renderPortfolioPageDocument(
  template: string,
  profile: PortfolioProfile,
  page: PortfolioPage,
  origin: string,
  locale: "en" | "vi" = "en",
) {
  const title = page.seoTitle || `${page.title} | ${profile.name}`;
  return renderPageShell(
    template,
    profile,
    title,
    page.seoDescription || page.summary,
    page.slug,
    page.sections,
    origin,
    locale,
    page.ogImage,
  );
}

export function renderProjectPasswordDocument(
  template: string,
  project: PortfolioProject,
  locale: "en" | "vi" = "en",
) {
  const title = locale === "vi" ? "Dự án riêng tư" : "Private project";
  const prompt =
    locale === "vi"
      ? "Nhập mật khẩu để xem dự án."
      : "Enter the project password to continue.";
  const button = locale === "vi" ? "Mở dự án" : "Unlock project";
  let html = template.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${title}</title>`,
  );
  html = replaceMeta(html, "name", "robots", "noindex,nofollow,noarchive");
  return html.replace(
    '<main id="project-content"></main>',
    `<header><a class="wordmark" href="/">${escapeHtml(project.title)}</a></header><main class="password-page"><h1>${title}</h1><p>${prompt}</p><form method="post" action="/projects/${encodeURIComponent(project.slug)}/access?lang=${locale}"><label>${locale === "vi" ? "Mật khẩu" : "Password"}<input type="password" name="password" autocomplete="current-password" required maxlength="128" /></label><button class="button primary">${button}</button></form></main>`,
  );
}
