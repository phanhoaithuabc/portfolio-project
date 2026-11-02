import { useDeferredValue, useEffect, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Code2,
  Github,
  Linkedin,
  LockKeyhole,
  Mail,
  MapPin,
  Search,
  Server,
  Terminal,
  X,
} from "lucide-react";
import { analyticsOptedOut, api, type PublicPortfolio } from "../lib/api";
function ContactForm({ locale }: { locale: "en" | "vi" }) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    setError("");
    setStatus("");
    try {
      await api.contact({
        name: String(values.get("name") ?? ""),
        email: String(values.get("email") ?? ""),
        subject: String(values.get("subject") ?? ""),
        message: String(values.get("message") ?? ""),
        website: String(values.get("website") ?? ""),
      });
      void api.track({
        page: "/",
        event: "contact",
        referrerHost: (() => {
          try {
            return document.referrer
              ? new URL(document.referrer).hostname.toLowerCase()
              : "";
          } catch {
            return "";
          }
        })(),
      });
      form.reset();
      setStatus(locale === "vi" ? "Đã gửi lời nhắn." : "Message sent.");
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : locale === "vi"
            ? "Không thể gửi lời nhắn. Vui lòng thử lại."
            : "Unable to send your message. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="contact-form" onSubmit={submit}>
      <label>
        {locale === "vi" ? "Tên" : "Name"}
        <input name="name" autoComplete="name" required maxLength={100} />
      </label>
      <label>
        {locale === "vi" ? "Email" : "Email"}
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </label>
      <label>
        {locale === "vi" ? "Chủ đề (không bắt buộc)" : "Subject (optional)"}
        <input name="subject" maxLength={160} />
      </label>
      <label>
        {locale === "vi" ? "Lời nhắn" : "Message"}
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={4}
        />
      </label>
      <label className="contact-honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <button className="button primary" disabled={pending}>
        {pending
          ? locale === "vi"
            ? "Đang gửi..."
            : "Sending..."
          : locale === "vi"
            ? "Gửi lời nhắn"
            : "Send message"}
        <ArrowUpRight size={17} />
      </button>
      {status && (
        <span className="contact-form-status" role="status">
          {status}
        </span>
      )}
      {error && (
        <span className="contact-form-error" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}

export function PublicSite() {
  const [data, setData] = useState<PublicPortfolio | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query.toLowerCase().trim());
  const [category, setCategory] = useState("all");
  const [locale, setLocale] = useState<"en" | "vi">(() =>
    new URLSearchParams(window.location.search).get("lang") === "vi"
      ? "vi"
      : "en",
  );
  const [year] = useState(() => new Date().getFullYear());
  const [analyticsDisabled, setAnalyticsDisabled] = useState(analyticsOptedOut);
  useEffect(() => {
    let active = true;
    api
      .portfolio(locale)
      .then((content) => {
        if (active) {
          setData(content);
          document.title =
            content.profile.seoTitle ||
            `${content.profile.name} | ${locale === "vi" ? "Hồ sơ kỹ thuật" : "Engineering Portfolio"}`;
          document.documentElement.lang = locale;
          const description = document.querySelector<HTMLMetaElement>(
            'meta[name="description"]',
          );
          if (description && content.profile.seoDescription)
            description.content = content.profile.seoDescription;
          const route = window.location.pathname;
          const page =
            route === "/"
              ? "/"
              : /^\/(?:projects|pages)\/[a-z0-9-]+$/.test(route)
                ? route
                : "/";
          let referrerHost = "";
          try {
            if (document.referrer)
              referrerHost = new URL(document.referrer).hostname.toLowerCase();
          } catch {
            referrerHost = "";
          }
          void api.track({ page, event: "view", referrerHost });
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, locale]);
  const loadingCopy =
    locale === "vi"
      ? {
          offline: "Tạm thời không khả dụng.",
          offlineText: "Không thể tải portfolio.",
          retry: "Thử lại",
          loading: "Đang chuẩn bị...",
        }
      : {
          offline: "Temporarily offline.",
          offlineText: "The portfolio couldn't be loaded.",
          retry: "Try again",
          loading: "Getting things ready...",
        };
  if (!data)
    return (
      <div className="page-loading">
        {error ? (
          <>
            <Server size={30} />
            <h1>{loadingCopy.offline}</h1>
            <p>{loadingCopy.offlineText}</p>
            <button
              className="button primary"
              onClick={() => {
                setError(false);
                setAttempt((value) => value + 1);
              }}
            >
              {loadingCopy.retry} <ArrowRight size={17} />
            </button>
          </>
        ) : (
          <>
            <span className="loading-mark" />
            <span>{loadingCopy.loading}</span>
          </>
        )}
      </div>
    );
  const { profile, projects, pages, projectLayout } = data;
  const copy =
    locale === "vi"
      ? {
          work: "Dự án",
          about: "Giới thiệu",
          contact: "Liên hệ",
          explore: "Khám phá dự án",
          aboutLink: "Đôi nét về tôi",
          selectedWork: "01 / DỰ ÁN TIÊU BIỂU",
          projects: "DỰ ÁN",
          workHeading: "Từ ý tưởng đến hệ thống thực tế",
          workIntro: "Một vài sản phẩm tôi đã xây dựng và câu chuyện phía sau.",
          search: "Tìm dự án",
          allWork: "Tất cả dự án",
          featured: "DỰ ÁN NỔI BẬT",
          readCase: "Đọc câu chuyện",
          visit: "Xem dự án",
          builtWith: "CÔNG NGHỆ",
          noMatches: "Không tìm thấy dự án phù hợp.",
          newWork: "Một điều mới đang được thực hiện.",
          clear: "Xóa tìm kiếm",
          aboutHeading: "Tò mò trong từng chi tiết.",
          aboutHeading2: "Chỉn chu khi triển khai.",
          toolbox: "CÔNG CỤ CỦA TÔI",
          resume: "Hồ sơ năng lực",
          connect: "03 / KẾT NỐI",
          studio: "Studio",
          retry: "Thử lại",
          offline: "Tạm thời không khả dụng.",
          offlineText: "Không thể tải portfolio.",
          loading: "Đang chuẩn bị...",
          language: "Ngôn ngữ",
          analyticsOn: "Privacy analytics: on",
          analyticsOff: "Privacy analytics: off",
        }
      : {
          work: "Work",
          about: "About",
          contact: "Contact",
          explore: "Explore my work",
          aboutLink: "A little about me",
          selectedWork: "01 / SELECTED WORK",
          projects: "PROJECTS",
          workHeading: "From idea to running system",
          workIntro: "A few things I've built, and the thinking behind them.",
          search: "Find a project",
          allWork: "All work",
          featured: "FEATURED PROJECT",
          readCase: "Read case study",
          visit: "Visit project",
          builtWith: "BUILT WITH",
          noMatches: "No matching projects.",
          newWork: "Something new is taking shape.",
          clear: "Clear search",
          aboutHeading: "Curiosity in the details.",
          aboutHeading2: "Care in the delivery.",
          toolbox: "MY TOOLBOX",
          resume: "Resume",
          connect: "03 / LET'S CONNECT",
          studio: "Studio",
          retry: "Try again",
          offline: "Temporarily offline.",
          offlineText: "The portfolio couldn't be loaded.",
          loading: "Getting things ready...",
          language: "Language",
          analyticsOn: "Privacy analytics: on",
          analyticsOff: "Privacy analytics: off",
        };
  const categories = [
    { value: "all", label: copy.allWork },
    ...[...new Set(projects.map((project) => project.category))].map(
      (value) => ({
        value,
        label: value,
      }),
    ),
  ];
  const visible = projects.filter(
    (project) =>
      (category === "all" || project.category === category) &&
      (!search ||
        `${project.title} ${project.summary} ${project.tags.join(" ")}`
          .toLowerCase()
          .includes(search)),
  );
  const name = profile.name.split(" ").at(-1)?.toLowerCase() ?? "portfolio";
  function changeLocale(next: "en" | "vi") {
    setLocale(next);
    setCategory("all");
    const url = new URL(window.location.href);
    if (next === "en") url.searchParams.delete("lang");
    else url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  }
  return (
    <>
      <a className="skip-link" href="#work">
        Skip to projects
      </a>
      <header className="public-header">
        <div className="container nav-row">
          <a href="#" className="wordmark" aria-label={`${profile.name} home`}>
            <Terminal size={22} strokeWidth={2} />
            <span>
              {name}
              <span className="accent">.</span>
            </span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#work">{copy.work}</a>
            <a href="#about">{copy.about}</a>
            {pages.map((page) => (
              <a
                href={`/pages/${encodeURIComponent(page.slug)}?lang=${locale}`}
                key={page.id}
              >
                {page.navLabel}
              </a>
            ))}
            <a href="#contact">
              {copy.contact} <ArrowUpRight size={14} />
            </a>
          </nav>
          <div
            className="locale-switch"
            role="group"
            aria-label={copy.language}
          >
            <button
              type="button"
              aria-pressed={locale === "en"}
              onClick={() => changeLocale("en")}
            >
              EN
            </button>
            <button
              type="button"
              aria-pressed={locale === "vi"}
              onClick={() => changeLocale("vi")}
            >
              VI
            </button>
          </div>
        </div>
      </header>
      <main>
        <section className="portfolio-hero" aria-labelledby="intro-heading">
          {profile.heroImage && (
            <img
              className="hero-photo"
              src={profile.heroImage}
              alt={profile.heroImageAlt || ""}
              fetchPriority="high"
            />
          )}
          <div className="hero-shade" />
          <div className="container hero-inner">
            <div className="hero-eyebrow">
              <span className="signal" /> {profile.role}
            </div>
            <h1 id="intro-heading">
              {profile.name}
              <span className="accent">.</span>
            </h1>
            <h2>{profile.headline}</h2>
            <p>{profile.intro}</p>
            <div className="hero-actions">
              <a className="button primary" href="#work">
                {copy.explore} <ArrowDown size={17} />
              </a>
              <a className="hero-about-link" href="#about">
                {copy.aboutLink} <ArrowUpRight size={17} />
              </a>
            </div>
            <div className="hero-bottom">
              <span>
                <Code2 size={15} /> CODE. CLOUD. CONTINUOUSLY CURIOUS.
              </span>
              <span>PERSONAL PORTFOLIO / {year}</span>
            </div>
          </div>
          <div className="hero-side-label">
            APPLICATIONS / INFRASTRUCTURE / DELIVERY
          </div>
        </section>
        <section className="work-section container" id="work">
          <div className="section-topline">
            <span className="section-index">{copy.selectedWork}</span>
            <span className="section-count">
              {String(projects.length).padStart(2, "0")} {copy.projects}
            </span>
          </div>
          <div className="work-heading">
            <div>
              <h2>
                {copy.workHeading}
                <span className="accent">.</span>
              </h2>
              <p>{copy.workIntro}</p>
            </div>
            <label className="project-search">
              <Search size={17} />
              <input
                aria-label={copy.search}
                placeholder={copy.search}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  title="Clear search"
                  aria-label="Clear project search"
                  onClick={() => setQuery("")}
                >
                  <X size={14} />
                </button>
              )}
            </label>
          </div>
          {categories.length > 2 && (
            <div
              className="category-tabs"
              role="group"
              aria-label="Project category"
            >
              {categories.map((item) => (
                <button
                  key={item.value}
                  className={category === item.value ? "active" : ""}
                  onClick={() => setCategory(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <div
            className={`project-gallery ${projectLayout === "grid" ? "project-gallery-grid" : ""}`}
          >
            {visible.map((project, index) => (
              <article
                key={project.id}
                className={`portfolio-project ${project.featured ? "featured" : ""}`}
              >
                <a
                  className="project-cover"
                  href={`/projects/${encodeURIComponent(project.slug)}?lang=${locale}`}
                  aria-label={`${copy.readCase}: ${project.title}`}
                >
                  {project.coverImage ? (
                    <img
                      src={project.coverImage}
                      alt={
                        project.coverImageAlt ||
                        `${project.title} website preview`
                      }
                      loading="lazy"
                    />
                  ) : (
                    <div className="cover-placeholder">
                      <Code2 size={48} />
                      <span>{project.title}</span>
                    </div>
                  )}
                  <span className="cover-label">
                    {project.featured ? copy.featured : project.category}
                  </span>
                  <span className="cover-arrow">
                    <ArrowUpRight size={25} />
                  </span>
                </a>
                <div className="project-description">
                  <div>
                    <div className="project-meta">
                      <span>
                        {String(index + 1).padStart(2, "0")} /{" "}
                        {project.category}
                      </span>
                      <span>{project.year}</span>
                    </div>
                    <a
                      className="project-name"
                      href={`/projects/${encodeURIComponent(project.slug)}?lang=${locale}`}
                    >
                      {project.title} <ArrowUpRight size={26} />
                    </a>
                    <p>{project.summary}</p>
                    <div className="project-links">
                      <a
                        href={`/projects/${encodeURIComponent(project.slug)}?lang=${locale}`}
                      >
                        {copy.readCase} <ArrowRight size={15} />
                      </a>
                      {project.liveUrl && (
                        <a
                          href={project.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() =>
                            void api.track({
                              page: `/projects/${project.slug}`,
                              event: "outbound",
                              referrerHost: "",
                            })
                          }
                        >
                          {copy.visit} <ArrowUpRight size={15} />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="project-tech">
                    <span className="small-label">{copy.builtWith}</span>
                    <div className="technology-list">
                      {project.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!visible.length && (
            <div className="empty-projects">
              <Search size={29} />
              <h3>{projects.length ? copy.noMatches : copy.newWork}</h3>
              {query && (
                <button className="text-button" onClick={() => setQuery("")}>
                  {copy.clear} <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
        </section>
        <section className="about-band" id="about">
          <div className="container about-layout">
            <div className="about-title">
              <span className="section-index">
                {locale === "vi"
                  ? "02 / ĐÔI NÉT VỀ TÔI"
                  : "02 / A LITTLE ABOUT ME"}
              </span>
              <h2>
                {copy.aboutHeading}
                <br />
                {copy.aboutHeading2}
                <span className="accent">.</span>
              </h2>
              <div className="about-signature">
                <span className="signature-icon">
                  <Code2 size={26} />
                </span>
                <span>
                  <strong>{profile.name}</strong>
                  <small>{profile.role}</small>
                </span>
              </div>
              {profile.location && (
                <span className="location">
                  <MapPin size={14} />
                  {profile.location}
                </span>
              )}
            </div>
            <div className="about-content">
              {profile.about.split(/\n\n+/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              <div className="toolbox">
                <span className="small-label">{copy.toolbox}</span>
                <div className="skill-list">
                  {profile.skills.map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
              </div>
              {profile.resumeUrl && (
                <a
                  className="text-button"
                  href={profile.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {copy.resume} <ArrowUpRight size={17} />
                </a>
              )}
            </div>
          </div>
        </section>
        <section className="contact-band" id="contact">
          <div className="container contact-layout">
            <div>
              <span className="section-index">{copy.connect}</span>
              <h2>
                {profile.contactHeading}
                {!/[.!?]$/.test(profile.contactHeading) && (
                  <span className="accent">.</span>
                )}
              </h2>
              <p>{profile.contactText}</p>
            </div>
            <div className="contact-actions">
              <ContactForm locale={locale} />
              {profile.email ? (
                <a href={`mailto:${profile.email}`} className="contact-email">
                  <Mail size={16} /> {profile.email}
                </a>
              ) : (
                <a href="#" className="button contact-top">
                  {locale === "vi" ? "Lên đầu trang" : "Back to top"}{" "}
                  <ArrowUp size={17} />
                </a>
              )}
              <div className="social-links">
                {profile.githubUrl && (
                  <a
                    href={profile.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="GitHub"
                    aria-label="GitHub"
                    onClick={() =>
                      void api.track({
                        page: "/",
                        event: "outbound",
                        referrerHost: "",
                      })
                    }
                  >
                    <Github size={20} />
                  </a>
                )}
                {profile.linkedinUrl && (
                  <a
                    href={profile.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="LinkedIn"
                    aria-label="LinkedIn"
                    onClick={() =>
                      void api.track({
                        page: "/",
                        event: "outbound",
                        referrerHost: "",
                      })
                    }
                  >
                    <Linkedin size={20} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <div className="container footer-row">
          <a className="wordmark" href="#">
            <Terminal size={19} />
            <span>
              {name}
              <span className="accent">.</span>
            </span>
          </a>
          <span>
            © {year} {profile.name}
          </span>
          <a href="/admin" className="studio-link">
            <LockKeyhole size={13} /> {copy.studio} <ArrowUpRight size={13} />
          </a>
          <button
            className="analytics-consent-toggle"
            aria-pressed={!analyticsDisabled}
            onClick={() => {
              const nextDisabled = !analyticsDisabled;
              try {
                localStorage.setItem(
                  "portfolio.analytics-opt-out",
                  String(nextDisabled),
                );
              } catch {}
              setAnalyticsDisabled(nextDisabled);
            }}
          >
            {analyticsDisabled ? copy.analyticsOff : copy.analyticsOn}
          </button>
        </div>
      </footer>
    </>
  );
}
