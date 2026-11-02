import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Activity,
  Check,
  Code2,
  Download,
  Eye,
  FolderKanban,
  History,
  Image,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import type {
  PortfolioContactRecord,
  PortfolioContent,
  PortfolioProfile,
  PortfolioPage,
  PortfolioProject,
  PortfolioVersion,
} from "@portfolio/contracts";
import { portfolioProjectSchema } from "@portfolio/contracts";
import {
  api,
  ApiError,
  type AdminSession,
  type PortfolioMediaFile,
  type PortfolioAnalyticsRow,
} from "../lib/api";
import { Field } from "./Fields";
import { SectionEditor } from "./SectionEditor";
import { Modal } from "../components/Modal";
import "./admin.css";
function TagField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [value, setValue] = useState(values.join(", "));
  return (
    <div className="editor-field field-wide">
      <label>
        {label}
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() =>
            onChange([
              ...new Set(
                value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              ),
            ])
          }
          rows={2}
        />
      </label>
    </div>
  );
}
function Login({
  session,
  onLogin,
}: {
  session: AdminSession;
  onLogin: (session: AdminSession) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await onLogin(
        await api.login(
          String(form.get("username")),
          String(form.get("password")),
          session.csrf,
        ),
      );
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Unable to sign in.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="login-page">
      <a className="login-back" href="/">
        <ArrowLeft size={16} /> Back to portfolio
      </a>
      <div className="login-box">
        <span className="login-icon">
          <LockKeyhole size={24} />
        </span>
        <span className="section-index">PORTFOLIO STUDIO</span>
        <h1>
          A little space
          <br />
          for your next big thing<span className="accent">.</span>
        </h1>
        <p>Welcome back.</p>
        <form onSubmit={submit}>
          <label>
            Username
            <input
              name="username"
              autoComplete="username"
              required
              disabled={pending}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={72}
              disabled={pending}
            />
          </label>
          {session.configured === false && (
            <div className="admin-error">Admin sign-in is not configured.</div>
          )}
          {error && (
            <div className="admin-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="button primary"
            disabled={pending || session.configured === false}
          >
            {pending ? <LoaderCircle size={17} className="spin" /> : null}
            {pending ? "Signing in..." : "Sign in"}
            <ArrowRight size={17} />
          </button>
        </form>
        <span className="login-security">
          <LockKeyhole size={12} /> Private workspace
        </span>
      </div>
    </main>
  );
}
export default function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [draft, setDraft] = useState<PortfolioContent | null>(null);
  const [baseline, setBaseline] = useState<PortfolioContent | null>(null);
  const [tab, setTab] = useState<
    | "profile"
    | "projects"
    | "pages"
    | "media"
    | "history"
    | "inbox"
    | "analytics"
  >("profile");
  const [selectedId, setSelectedId] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [projectPassword, setProjectPassword] = useState("");
  const [projectPasswordExists, setProjectPasswordExists] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [versions, setVersions] = useState<PortfolioVersion[]>([]);
  const [contacts, setContacts] = useState<PortfolioContactRecord[]>([]);
  const [media, setMedia] = useState<PortfolioMediaFile[]>([]);
  const [analytics, setAnalytics] = useState<PortfolioAnalyticsRow[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const dirty = Boolean(
    draft && baseline && JSON.stringify(draft) !== JSON.stringify(baseline),
  );
  const isOwner = session?.role === "owner";
  const selectedProjectVisibility = draft?.projects.find(
    (item) => item.id === selectedId,
  )?.visibility;
  useEffect(() => {
    let active = true;
    setProjectPassword("");
    if (!session?.authenticated || selectedProjectVisibility !== "password") {
      setProjectPasswordExists(false);
      return () => {
        active = false;
      };
    }
    void api
      .projectPasswordStatus(selectedId)
      .then((result) => {
        if (active) setProjectPasswordExists(result.configured);
      })
      .catch(() => {
        if (active) setProjectPasswordExists(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, selectedProjectVisibility, session?.authenticated]);
  async function loadOwnerTools() {
    const [nextVersions, nextContacts, nextMedia, nextAnalytics] =
      await Promise.all([
        api.history(),
        api.contacts(),
        api.media(),
        api.analytics(),
      ]);
    setVersions(nextVersions);
    setContacts(nextContacts);
    setMedia(nextMedia);
    setAnalytics(nextAnalytics);
  }
  useEffect(() => {
    document.title = "Portfolio Studio | Phan Hoai Thu";
    let active = true;
    api
      .session()
      .then(async (current) => {
        if (!active) return;
        setSession(current);
        if (current.authenticated) {
          setTab(current.role === "owner" ? "profile" : "projects");
          const content = await api.content();
          if (active) {
            setDraft(content);
            setBaseline(content);
            setSelectedId(
              content.projects.find(
                (project) => current.role === "owner" || !project.published,
              )?.id ?? "",
            );
            if (current.role === "owner") await loadOwnerTools();
          }
        }
      })
      .catch((problem) => {
        if (active)
          setError(
            problem instanceof Error ? problem.message : "Studio unavailable.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  async function loggedIn(current: AdminSession) {
    const content = await api.content();
    setSession(current);
    setTab(current.role === "owner" ? "profile" : "projects");
    setDraft(content);
    setBaseline(content);
    setSelectedId(
      content.projects.find(
        (project) => current.role === "owner" || !project.published,
      )?.id ?? "",
    );
    setError("");
    if (current.role === "owner") await loadOwnerTools();
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !session || pending) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const saved = await api.save(draft, session.csrf);
      setDraft(saved);
      setBaseline(saved);
      if (session.role === "owner") await loadOwnerTools();
      setNotice("Changes saved");
    } catch (problem) {
      if (problem instanceof ApiError && problem.status === 401)
        setSession({ ...session, authenticated: false });
      setError(problem instanceof Error ? problem.message : "Unable to save.");
    } finally {
      setPending(false);
    }
  }
  async function logout() {
    if (
      !session ||
      (dirty && !window.confirm("Discard unsaved changes and sign out?"))
    )
      return;
    try {
      await api.logout(session.csrf);
      setDraft(null);
      setBaseline(null);
      setSession(await api.session());
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Unable to sign out.",
      );
    }
  }
  function updateProfile<Key extends keyof PortfolioProfile>(
    key: Key,
    value: PortfolioProfile[Key],
  ) {
    setNotice("");
    setDraft((current) =>
      current
        ? { ...current, profile: { ...current.profile, [key]: value } }
        : current,
    );
  }
  function updateProfileTranslation(
    key: keyof NonNullable<PortfolioProfile["translations"]>["vi"],
    value: string,
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            profile: {
              ...current.profile,
              translations: {
                ...current.profile.translations,
                vi: { ...current.profile.translations?.vi, [key]: value },
              },
            },
          }
        : current,
    );
  }
  function updateProject<Key extends keyof PortfolioProject>(
    key: Key,
    value: PortfolioProject[Key],
  ) {
    setNotice("");
    setDraft((current) =>
      current
        ? {
            ...current,
            projects: current.projects.map((project) =>
              project.id === selectedId
                ? { ...project, [key]: value }
                : project,
            ),
          }
        : current,
    );
  }
  function updateProjectTranslation<
    Key extends keyof NonNullable<PortfolioProject["translations"]>["vi"],
  >(key: Key, value: NonNullable<PortfolioProject["translations"]>["vi"][Key]) {
    setDraft((current) =>
      current
        ? {
            ...current,
            projects: current.projects.map((item) =>
              item.id === selectedId
                ? {
                    ...item,
                    translations: {
                      ...item.translations,
                      vi: { ...item.translations?.vi, [key]: value },
                    },
                  }
                : item,
            ),
          }
        : current,
    );
  }
  function addProject() {
    const id = crypto.randomUUID();
    const project: PortfolioProject = {
      id,
      slug: `new-project-${id.slice(0, 8)}`,
      title: "Untitled project",
      category: "Engineering",
      summary: "A short summary of this project.",
      description: "The project story, architecture, and decisions behind it.",
      coverImage: "",
      liveUrl: "",
      repositoryUrl: "",
      tags: [],
      year: String(new Date().getFullYear()),
      published: false,
      featured: false,
      sortOrder: draft?.projects.length ?? 0,
    };
    setDraft((current) =>
      current
        ? { ...current, projects: [...current.projects, project] }
        : current,
    );
    setSelectedId(id);
    setTab("projects");
    setNotice("");
  }
  async function importProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !draft) return;
    try {
      const parsed = portfolioProjectSchema.parse(
        JSON.parse(await file.text()),
      );
      const base = parsed.slug.replace(/-import(?:-\d+)?$/g, "");
      let slug = `${base}-import`;
      let suffix = 2;
      while (draft.projects.some((item) => item.slug === slug))
        slug = `${base}-import-${suffix++}`;
      const project = {
        ...parsed,
        id: crypto.randomUUID(),
        slug,
        published: false,
        visibility: "public" as const,
        featured: false,
        sortOrder: draft.projects.length,
      };
      setDraft((current) =>
        current
          ? { ...current, projects: [...current.projects, project] }
          : current,
      );
      setSelectedId(project.id);
      setTab("projects");
      setNotice("Project imported as a draft. Review and save to keep it.");
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to import this project JSON.",
      );
    }
  }
  function exportProject() {
    if (!project) return;
    const exported = { ...project, visibility: "public" };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(exported, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.slug}.portfolio-project.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function updateProjectSections(sections: PortfolioProject["sections"]) {
    updateProject("sections", sections);
  }
  function updateProjectBlockTranslation(
    sections: NonNullable<PortfolioProject["translations"]>["vi"]["sections"],
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            projects: current.projects.map((item) =>
              item.id === selectedId
                ? {
                    ...item,
                    translations: {
                      ...item.translations,
                      vi: { ...item.translations?.vi, sections },
                    },
                  }
                : item,
            ),
          }
        : current,
    );
  }
  function addPage() {
    if (!isOwner) return;
    const id = crypto.randomUUID();
    const page: PortfolioPage = {
      id,
      slug: `new-page-${id.slice(0, 8)}`,
      title: "Untitled page",
      navLabel: "New page",
      summary: "",
      sections: [],
      published: false,
      sortOrder: draft?.pages?.length ?? 0,
    };
    setDraft((current) =>
      current
        ? { ...current, pages: [...(current.pages ?? []), page] }
        : current,
    );
    setSelectedPageId(id);
    setTab("pages");
    setNotice("");
  }
  function updatePage<Key extends keyof PortfolioPage>(
    key: Key,
    value: PortfolioPage[Key],
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            pages: (current.pages ?? []).map((page) =>
              page.id === selectedPageId ? { ...page, [key]: value } : page,
            ),
          }
        : current,
    );
    setNotice("");
  }
  function updatePageTranslation<
    Key extends keyof NonNullable<PortfolioPage["translations"]>["vi"],
  >(key: Key, value: NonNullable<PortfolioPage["translations"]>["vi"][Key]) {
    setDraft((current) =>
      current
        ? {
            ...current,
            pages: (current.pages ?? []).map((page) =>
              page.id === selectedPageId
                ? {
                    ...page,
                    translations: {
                      ...page.translations,
                      vi: { ...page.translations?.vi, [key]: value },
                    },
                  }
                : page,
            ),
          }
        : current,
    );
  }
  function updatePageBlockTranslation(
    sections: NonNullable<PortfolioPage["translations"]>["vi"]["sections"],
  ) {
    updatePage("translations", {
      ...page?.translations,
      vi: { ...page?.translations?.vi, sections },
    });
  }
  function deletePage() {
    if (!page || !window.confirm(`Delete ${page.title}?`)) return;
    setDraft((current) =>
      current
        ? {
            ...current,
            pages: (current.pages ?? []).filter((item) => item.id !== page.id),
          }
        : current,
    );
    setSelectedPageId("");
    setNotice("");
  }
  async function saveProjectPassword() {
    if (!session || !project || !projectPassword.trim()) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await api.setProjectPassword(project.id, projectPassword, session.csrf);
      setProjectPassword("");
      setProjectPasswordExists(true);
      setNotice("Project password updated");
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to update project password.",
      );
    } finally {
      setPending(false);
    }
  }
  async function removeProjectPassword() {
    if (
      !session ||
      !project ||
      !window.confirm("Remove password protection from this project?")
    )
      return;
    setPending(true);
    setError("");
    try {
      await api.deleteProjectPassword(project.id, session.csrf);
      setProjectPasswordExists(false);
      updateProject("visibility", "public");
      setNotice("Project password removed");
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to remove project password.",
      );
    } finally {
      setPending(false);
    }
  }
  async function restoreVersion(revision: number) {
    if (!session || !baseline) return;
    if (
      !window.confirm(
        `Restore revision ${revision}? Current content is kept in history.`,
      )
    )
      return;
    setPending(true);
    setError("");
    try {
      const restored = await api.restore(
        revision,
        baseline.revision,
        session.csrf,
      );
      setDraft(restored);
      setBaseline(restored);
      await loadOwnerTools();
      setNotice(`Restored revision ${revision}`);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to restore version.",
      );
    } finally {
      setPending(false);
    }
  }
  async function importContent(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !session) return;
    setPending(true);
    setError("");
    try {
      const parsed = JSON.parse(await file.text()) as PortfolioContent;
      const imported = await api.importContent(parsed, session.csrf);
      setDraft(imported);
      setBaseline(imported);
      setSelectedId(imported.projects[0]?.id ?? "");
      await loadOwnerTools();
      setNotice("Content imported");
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to import content.",
      );
    } finally {
      setPending(false);
    }
  }
  async function uploadMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setMediaBusy(true);
    setError("");
    try {
      const uploaded = await api.uploadMedia(file);
      setMedia((current) => [uploaded, ...current]);
      setNotice("Image uploaded");
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Unable to upload image.",
      );
    } finally {
      setMediaBusy(false);
    }
  }
  function useMedia(
    url: string,
    field: "heroImage" | "ogImage" | "coverImage",
  ) {
    if (
      media.some((item) => item.url === url) &&
      draft &&
      ((field === "heroImage" && draft.profile.heroImage === url) ||
        (field === "ogImage" && draft.profile.ogImage === url) ||
        (field === "coverImage" &&
          draft.projects.some(
            (item) => item.id === selectedId && item.coverImage === url,
          )))
    ) {
      setTab(field === "coverImage" ? "projects" : "profile");
      return;
    }
    if (field === "coverImage") updateProject("coverImage", url);
    else updateProfile(field, url);
    setTab(field === "coverImage" ? "projects" : "profile");
    setNotice("Image selected; save changes to publish it");
  }
  async function deleteMedia(file: PortfolioMediaFile) {
    if (!session || !window.confirm(`Delete ${file.id}?`)) return;
    const referenced =
      draft?.profile.heroImage === file.url ||
      draft?.profile.ogImage === file.url ||
      draft?.projects.some(
        (item) => item.coverImage === file.url || item.ogImage === file.url,
      );
    if (referenced) {
      setError(
        "This image is used by the current draft. Replace it before deleting.",
      );
      return;
    }
    try {
      await api.deleteMedia(file.id, session.csrf);
      setMedia((current) => current.filter((item) => item.id !== file.id));
      setNotice("Image deleted");
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Unable to delete image.",
      );
    }
  }
  async function updateContact(record: PortfolioContactRecord) {
    if (!session) return;
    const status = record.status === "new" ? "read" : "archived";
    try {
      const updated = await api.updateContact(record.id, status, session.csrf);
      setContacts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Unable to update message.",
      );
    }
  }
  if (loading)
    return (
      <div className="page-loading">
        <span className="loading-mark" />
        <span>Opening studio...</span>
      </div>
    );
  if (!session)
    return (
      <div className="page-loading">
        <h1>Studio unavailable.</h1>
        <p>{error}</p>
        <button
          className="button primary"
          onClick={() => {
            setLoading(true);
            setError("");
            setAttempt((value) => value + 1);
          }}
        >
          Try again <ArrowRight size={17} />
        </button>
        <a href="/">Back to portfolio</a>
      </div>
    );
  if (!session.authenticated)
    return <Login session={session} onLogin={loggedIn} />;
  if (!draft) return <div className="page-loading">Loading content...</div>;
  const project = draft.projects.find((item) => item.id === selectedId);
  const page = (draft.pages ?? []).find((item) => item.id === selectedPageId);
  const profileFields: {
    key: Exclude<keyof PortfolioProfile, "skills" | "translations">;
    label: string;
    multiline?: boolean;
    type?: string;
    required?: boolean;
  }[] = [
    { key: "name", label: "Full name", required: true },
    { key: "role", label: "Role / focus", required: true },
    { key: "headline", label: "Headline", required: true },
    { key: "location", label: "Location" },
    { key: "intro", label: "Introduction", multiline: true, required: true },
    { key: "about", label: "About", multiline: true, required: true },
    { key: "heroImage", label: "Hero image URL" },
    { key: "email", label: "Contact email", type: "email" },
    { key: "githubUrl", label: "GitHub URL" },
    { key: "linkedinUrl", label: "LinkedIn URL" },
    { key: "resumeUrl", label: "Resume URL" },
    { key: "seoTitle", label: "Search title" },
    { key: "seoDescription", label: "Search description", multiline: true },
    { key: "ogImage", label: "Social preview image URL" },
    { key: "heroImageAlt", label: "Hero image alt text" },
    { key: "contactHeading", label: "Contact heading", required: true },
    {
      key: "contactText",
      label: "Contact text",
      multiline: true,
      required: true,
    },
  ];
  const projectFields: {
    key:
      | "title"
      | "slug"
      | "category"
      | "year"
      | "summary"
      | "description"
      | "coverImage"
      | "liveUrl"
      | "repositoryUrl"
      | "seoTitle"
      | "seoDescription"
      | "ogImage"
      | "coverImageAlt";
    label: string;
    multiline?: boolean;
    required?: boolean;
  }[] = [
    { key: "title", label: "Project name", required: true },
    { key: "slug", label: "Slug", required: true },
    { key: "category", label: "Category", required: true },
    { key: "year", label: "Year", required: true },
    { key: "summary", label: "Summary", multiline: true, required: true },
    {
      key: "description",
      label: "Case study",
      multiline: true,
      required: true,
    },
    { key: "coverImage", label: "Cover image URL" },
    { key: "coverImageAlt", label: "Cover image alt text" },
    { key: "liveUrl", label: "Live project URL" },
    { key: "repositoryUrl", label: "Repository URL" },
    { key: "seoTitle", label: "Search title" },
    { key: "seoDescription", label: "Search description", multiline: true },
    { key: "ogImage", label: "Social preview image URL" },
  ];
  return (
    <div className="studio">
      <header className="studio-header">
        <div className="studio-brand">
          <Code2 size={23} />
          <span>
            Portfolio <strong>studio</strong>
          </span>
        </div>
        <div>
          <a
            className="studio-view"
            href="/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Eye size={16} /> View site <ArrowUpRight size={14} />
          </a>
          {isOwner && (
            <div className="studio-transfer">
              <a className="text-button" href="/api/admin/export" download>
                <Download size={15} /> Export JSON
              </a>
              <label className="text-button import-content-button">
                <Upload size={15} /> Import JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => void importContent(event)}
                />
              </label>
            </div>
          )}
          <button
            className="icon-button"
            title="Sign out"
            aria-label="Sign out"
            onClick={() => void logout()}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <div className="studio-toolbar">
        <div className="studio-tabs">
          {isOwner && (
            <button
              className={tab === "profile" ? "active" : ""}
              onClick={() => setTab("profile")}
            >
              <UserRound size={17} /> Profile
            </button>
          )}
          {isOwner && (
            <button
              className={tab === "pages" ? "active" : ""}
              onClick={() => setTab("pages")}
            >
              <FolderKanban size={17} /> Pages
              <span>{draft.pages?.length ?? 0}</span>
            </button>
          )}
          <button
            className={tab === "projects" ? "active" : ""}
            onClick={() => setTab("projects")}
          >
            <FolderKanban size={17} /> Projects{" "}
            <span>{draft.projects.length}</span>
          </button>
          <button
            className={tab === "media" ? "active" : ""}
            onClick={() => setTab("media")}
          >
            <Image size={17} /> Media
          </button>
          {isOwner && (
            <>
              <button
                className={tab === "analytics" ? "active" : ""}
                onClick={() => setTab("analytics")}
              >
                <Activity size={17} /> Analytics
              </button>
              <button
                className={tab === "history" ? "active" : ""}
                onClick={() => setTab("history")}
              >
                <History size={17} /> History
              </button>
              <button
                className={tab === "inbox" ? "active" : ""}
                onClick={() => setTab("inbox")}
              >
                <Inbox size={17} /> Inbox
                <span>
                  {contacts.filter((item) => item.status === "new").length}
                </span>
              </button>
            </>
          )}
        </div>
        <div className="studio-save">
          <span
            className={`save-status ${dirty ? "unsaved" : ""}`}
            role="status"
          >
            {dirty ? (
              "Unsaved changes"
            ) : notice ? (
              <>
                <Check size={14} />
                {notice}
              </>
            ) : (
              `Revision ${draft.revision}`
            )}
          </span>
          <button
            className="icon-button"
            disabled={!dirty || pending}
            title="Discard changes"
            aria-label="Discard changes"
            onClick={() => {
              if (window.confirm("Discard unsaved changes?")) {
                setDraft(structuredClone(baseline));
                setNotice("");
              }
            }}
          >
            <RotateCcw size={17} />
          </button>
          <button
            className="button primary save-button"
            form="content-editor"
            type="submit"
            disabled={!dirty || pending}
          >
            {pending ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Save size={16} />
            )}
            {pending ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
      {error && (
        <div className="studio-message admin-error" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() => {
              if (
                !dirty ||
                window.confirm("Reload and discard unsaved changes?")
              ) {
                setLoading(true);
                setAttempt((value) => value + 1);
              }
            }}
          >
            Reload content <RotateCcw size={14} />
          </button>
        </div>
      )}
      {(tab === "profile" || tab === "projects") && (
        <main
          className={`studio-content ${tab === "projects" ? "project-editor-layout" : ""}`}
        >
          {tab === "projects" && (
            <aside className="project-sidebar">
              <div className="sidebar-heading">
                <span>YOUR PROJECTS</span>
                <button
                  className="icon-button"
                  title="New project"
                  aria-label="New project"
                  onClick={addProject}
                >
                  <Plus size={19} />
                </button>
              </div>
              <div className="admin-project-list">
                {draft.projects
                  .filter((item) => isOwner || !item.published)
                  .map((item) => (
                    <button
                      key={item.id}
                      className={selectedId === item.id ? "selected" : ""}
                      onClick={() => setSelectedId(item.id)}
                    >
                      {item.coverImage ? (
                        <img src={item.coverImage} alt="" />
                      ) : (
                        <span className="mini-cover">
                          <Image size={18} />
                        </span>
                      )}
                      <span>
                        <strong>{item.title}</strong>
                        <small>
                          <span
                            className={`status-dot ${item.published ? "published" : ""}`}
                          />
                          {item.published ? "Published" : "Draft"}
                        </small>
                      </span>
                      <ArrowRight size={15} />
                    </button>
                  ))}
              </div>
              <button
                className="button secondary add-project-button"
                onClick={addProject}
              >
                <Plus size={16} /> New project
              </button>
              <label className="text-button project-import-button">
                <Upload size={15} /> Import project JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => void importProject(event)}
                />
              </label>
              {project && (
                <button
                  type="button"
                  className="text-button project-export-button"
                  onClick={exportProject}
                >
                  <Download size={15} /> Export selected project
                </button>
              )}
            </aside>
          )}
          <form id="content-editor" className="content-editor" onSubmit={save}>
            <fieldset disabled={pending}>
              <div className="editor-section-heading">
                <div>
                  <span className="section-index">
                    {tab === "profile"
                      ? "THE PERSON BEHIND THE PROJECTS"
                      : "YOUR WORK, IN DETAIL"}
                  </span>
                  <h1>
                    {tab === "profile"
                      ? "Your profile"
                      : (project?.title ?? "Your next project")}
                  </h1>
                </div>
                {tab === "projects" && project && isOwner && (
                  <button
                    type="button"
                    className="icon-button delete-button"
                    title="Delete project"
                    aria-label="Delete project"
                    onClick={() => setDeleteId(project.id)}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              {tab === "profile" ? (
                <div className="editor-fields">
                  {profileFields.map((field) => (
                    <Field
                      key={field.key}
                      label={field.label}
                      value={draft.profile[field.key] ?? ""}
                      onChange={(value) => updateProfile(field.key, value)}
                      multiline={field.multiline}
                      type={field.type}
                      required={field.required}
                    />
                  ))}
                  <TagField
                    key={draft.profile.skills.join("|")}
                    label="Skills / technologies (comma separated)"
                    values={draft.profile.skills}
                    onChange={(value) => updateProfile("skills", value)}
                  />
                  {isOwner && (
                    <label className="editor-field field-wide">
                      Project presentation
                      <select
                        value={draft.projectLayout ?? "editorial"}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  projectLayout: event.target
                                    .value as PortfolioContent["projectLayout"],
                                }
                              : current,
                          )
                        }
                      >
                        <option value="editorial">
                          Editorial feature + two-column work
                        </option>
                        <option value="grid">Balanced project grid</option>
                      </select>
                    </label>
                  )}
                  <div className="editor-translation field-wide">
                    <span className="small-label">VIETNAMESE PROFILE</span>
                    <div className="editor-fields">
                      <Field
                        label="Role"
                        value={draft.profile.translations?.vi?.role ?? ""}
                        onChange={(value) =>
                          updateProfileTranslation("role", value)
                        }
                      />
                      <Field
                        label="Headline"
                        value={draft.profile.translations?.vi?.headline ?? ""}
                        onChange={(value) =>
                          updateProfileTranslation("headline", value)
                        }
                      />
                      <Field
                        label="Introduction"
                        value={draft.profile.translations?.vi?.intro ?? ""}
                        multiline
                        onChange={(value) =>
                          updateProfileTranslation("intro", value)
                        }
                      />
                      <Field
                        label="About"
                        value={draft.profile.translations?.vi?.about ?? ""}
                        multiline
                        onChange={(value) =>
                          updateProfileTranslation("about", value)
                        }
                      />
                      <Field
                        label="Contact heading"
                        value={
                          draft.profile.translations?.vi?.contactHeading ?? ""
                        }
                        onChange={(value) =>
                          updateProfileTranslation("contactHeading", value)
                        }
                      />
                      <Field
                        label="Contact text"
                        value={
                          draft.profile.translations?.vi?.contactText ?? ""
                        }
                        multiline
                        onChange={(value) =>
                          updateProfileTranslation("contactText", value)
                        }
                      />
                    </div>
                  </div>
                </div>
              ) : project ? (
                <>
                  <div className="project-publishing">
                    <label>
                      <input
                        type="checkbox"
                        checked={project.published}
                        disabled={!isOwner}
                        onChange={(event) =>
                          updateProject("published", event.target.checked)
                        }
                      />{" "}
                      Published
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={project.featured}
                        disabled={!isOwner}
                        onChange={(event) =>
                          updateProject("featured", event.target.checked)
                        }
                      />{" "}
                      Featured
                    </label>
                    <label className="order-input">
                      Order{" "}
                      <input
                        aria-label="Project sort order"
                        type="number"
                        min={0}
                        max={1000}
                        disabled={!isOwner}
                        value={project.sortOrder}
                        onChange={(event) =>
                          updateProject("sortOrder", Number(event.target.value))
                        }
                      />
                    </label>
                    <a
                      className="text-button preview-project"
                      href={`/api/admin/preview/${encodeURIComponent(project.slug)}?lang=en`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Eye size={15} /> Preview draft
                    </a>
                  </div>
                  <div className="editor-fields">
                    {projectFields.map((field) => (
                      <Field
                        key={`${project.id}:${field.key}`}
                        label={field.label}
                        value={project[field.key] ?? ""}
                        onChange={(value) => updateProject(field.key, value)}
                        multiline={field.multiline}
                        required={field.required}
                      />
                    ))}
                    <TagField
                      key={`${project.id}:${project.tags.join("|")}`}
                      label="Technologies (comma separated)"
                      values={project.tags}
                      onChange={(value) => updateProject("tags", value)}
                    />
                    <div className="editor-translation field-wide">
                      <span className="small-label">VIETNAMESE PROJECT</span>
                      <div className="editor-fields">
                        <Field
                          label="Title"
                          value={project.translations?.vi?.title ?? ""}
                          onChange={(value) =>
                            updateProjectTranslation("title", value)
                          }
                        />
                        <Field
                          label="Category"
                          value={project.translations?.vi?.category ?? ""}
                          onChange={(value) =>
                            updateProjectTranslation("category", value)
                          }
                        />
                        <Field
                          label="Summary"
                          value={project.translations?.vi?.summary ?? ""}
                          multiline
                          onChange={(value) =>
                            updateProjectTranslation("summary", value)
                          }
                        />
                        <Field
                          label="Case study"
                          value={project.translations?.vi?.description ?? ""}
                          multiline
                          onChange={(value) =>
                            updateProjectTranslation("description", value)
                          }
                        />
                        <Field
                          label="Technologies (comma separated)"
                          value={
                            project.translations?.vi?.tags?.join(", ") ?? ""
                          }
                          onChange={(value) =>
                            updateProjectTranslation(
                              "tags",
                              value
                                .split(",")
                                .map((tag) => tag.trim())
                                .filter(Boolean),
                            )
                          }
                        />
                      </div>
                    </div>
                    <label className="editor-field field-wide">
                      Project visibility
                      <select
                        disabled={!isOwner}
                        value={project.visibility ?? "public"}
                        onChange={(event) =>
                          updateProject(
                            "visibility",
                            event.target
                              .value as PortfolioProject["visibility"],
                          )
                        }
                      >
                        <option value="public">Public and listed</option>
                        <option value="unlisted">
                          Unlisted, direct link only
                        </option>
                        <option value="password">Password protected</option>
                      </select>
                    </label>
                    {project.visibility === "password" && (
                      <div className="private-project-controls field-wide">
                        <label>
                          New private-project password
                          <input
                            type="password"
                            autoComplete="new-password"
                            minLength={12}
                            maxLength={128}
                            value={projectPassword}
                            onChange={(event) =>
                              setProjectPassword(event.target.value)
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="button secondary"
                          disabled={!projectPassword.trim() || pending}
                          onClick={() => void saveProjectPassword()}
                        >
                          {projectPasswordExists
                            ? "Change password"
                            : "Set password"}
                        </button>
                        {projectPasswordExists && (
                          <button
                            type="button"
                            className="text-button danger"
                            disabled={pending}
                            onClick={() => void removeProjectPassword()}
                          >
                            Remove password
                          </button>
                        )}
                        <span className="field-help">
                          Passwords are stored as a hash, never in exported
                          portfolio content.
                        </span>
                      </div>
                    )}
                    <SectionEditor
                      sections={project.sections ?? []}
                      translations={project.translations?.vi?.sections ?? []}
                      media={media}
                      onChange={updateProjectSections}
                      onTranslationsChange={updateProjectBlockTranslation}
                    />
                  </div>
                  {project.coverImage && (
                    <div className="editor-cover-preview">
                      <span className="small-label">COVER PREVIEW</span>
                      <img
                        src={project.coverImage}
                        alt={`${project.title} cover preview`}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="editor-empty">
                  <FolderKanban size={38} />
                  <h2>Make room for the next one.</h2>
                  <button
                    type="button"
                    className="button primary"
                    onClick={addProject}
                  >
                    <Plus size={16} /> New project
                  </button>
                </div>
              )}
            </fieldset>
          </form>
        </main>
      )}
      {tab === "pages" && isOwner && (
        <main className="studio-content project-editor-layout">
          <aside className="project-sidebar">
            <div className="sidebar-heading">
              <span>YOUR PAGES</span>
              <button
                className="icon-button"
                title="New page"
                aria-label="New page"
                onClick={addPage}
              >
                <Plus size={19} />
              </button>
            </div>
            <div className="admin-project-list">
              {(draft.pages ?? []).map((item) => (
                <button
                  key={item.id}
                  className={selectedPageId === item.id ? "selected" : ""}
                  onClick={() => setSelectedPageId(item.id)}
                >
                  <span className="mini-cover">
                    <FolderKanban size={18} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      <span
                        className={`status-dot ${item.published ? "published" : ""}`}
                      />
                      {item.published ? "Published" : "Draft"}
                    </small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
            <button
              className="button secondary add-project-button"
              onClick={addPage}
            >
              <Plus size={16} /> New page
            </button>
          </aside>
          <form id="content-editor" className="content-editor" onSubmit={save}>
            <fieldset disabled={pending}>
              {page ? (
                <>
                  <div className="editor-section-heading">
                    <div>
                      <span className="section-index">CUSTOM PAGE</span>
                      <h1>{page.title}</h1>
                    </div>
                    <button
                      type="button"
                      className="icon-button delete-button"
                      title="Delete page"
                      aria-label="Delete page"
                      onClick={deletePage}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="project-publishing">
                    <label>
                      <input
                        type="checkbox"
                        checked={page.published}
                        onChange={(event) =>
                          updatePage("published", event.target.checked)
                        }
                      />{" "}
                      Published
                    </label>
                    <label className="order-input">
                      Order{" "}
                      <input
                        aria-label="Page sort order"
                        type="number"
                        min={0}
                        max={1000}
                        value={page.sortOrder}
                        onChange={(event) =>
                          updatePage("sortOrder", Number(event.target.value))
                        }
                      />
                    </label>
                    <a
                      className="text-button preview-project"
                      href={`/api/admin/preview-page/${encodeURIComponent(page.slug)}?lang=en`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Eye size={15} /> Preview page
                    </a>
                  </div>
                  <div className="editor-fields">
                    <Field
                      label="Page title"
                      value={page.title}
                      required
                      onChange={(value) => updatePage("title", value)}
                    />
                    <Field
                      label="Navigation label"
                      value={page.navLabel}
                      required
                      onChange={(value) => updatePage("navLabel", value)}
                    />
                    <Field
                      label="URL slug"
                      value={page.slug}
                      required
                      onChange={(value) => updatePage("slug", value)}
                    />
                    <Field
                      label="Short introduction"
                      value={page.summary}
                      multiline
                      onChange={(value) => updatePage("summary", value)}
                    />
                    <Field
                      label="Search title"
                      value={page.seoTitle ?? ""}
                      onChange={(value) => updatePage("seoTitle", value)}
                    />
                    <Field
                      label="Search description"
                      value={page.seoDescription ?? ""}
                      multiline
                      onChange={(value) => updatePage("seoDescription", value)}
                    />
                    <Field
                      label="Social preview image URL"
                      value={page.ogImage ?? ""}
                      onChange={(value) => updatePage("ogImage", value)}
                    />
                    <SectionEditor
                      sections={page.sections}
                      translations={page.translations?.vi?.sections ?? []}
                      media={media}
                      onChange={(sections) => updatePage("sections", sections)}
                      onTranslationsChange={updatePageBlockTranslation}
                    />
                    <div className="editor-translation field-wide">
                      <span className="small-label">VIETNAMESE PAGE</span>
                      <div className="editor-fields">
                        <Field
                          label="Title"
                          value={page.translations?.vi?.title ?? ""}
                          onChange={(value) =>
                            updatePageTranslation("title", value)
                          }
                        />
                        <Field
                          label="Navigation label"
                          value={page.translations?.vi?.navLabel ?? ""}
                          onChange={(value) =>
                            updatePageTranslation("navLabel", value)
                          }
                        />
                        <Field
                          label="Summary"
                          value={page.translations?.vi?.summary ?? ""}
                          multiline
                          onChange={(value) =>
                            updatePageTranslation("summary", value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="editor-empty">
                  <FolderKanban size={38} />
                  <h2>Create a page for your work.</h2>
                  <button
                    type="button"
                    className="button primary"
                    onClick={addPage}
                  >
                    <Plus size={16} /> New page
                  </button>
                </div>
              )}
            </fieldset>
          </form>
        </main>
      )}
      {tab === "media" && (
        <main className="studio-content studio-panel">
          <div className="editor-section-heading">
            <div>
              <span className="section-index">ASSET LIBRARY</span>
              <h1>Media</h1>
            </div>
            <label className="button primary media-upload">
              <Upload size={16} /> {mediaBusy ? "Uploading..." : "Upload image"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                disabled={mediaBusy}
                onChange={(event) => void uploadMedia(event)}
              />
            </label>
          </div>
          <p className="studio-help">
            PNG, JPEG, GIF, or WebP up to 8 MiB. Images are stored with random
            filenames and are not executable.
          </p>
          <div className="media-grid">
            {media.map((file) => (
              <article className="media-card" key={file.id}>
                <img src={file.url} alt="Uploaded portfolio asset" />
                <small>
                  {file.type} · {(file.size / 1024).toFixed(0)} KB
                </small>
                <code>{file.url}</code>
                <div className="media-actions">
                  <button
                    className="button secondary"
                    onClick={() => useMedia(file.url, "heroImage")}
                  >
                    Use for hero
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => useMedia(file.url, "ogImage")}
                  >
                    Use for sharing
                  </button>
                  {project && (
                    <button
                      className="button secondary"
                      onClick={() => useMedia(file.url, "coverImage")}
                    >
                      Use for project
                    </button>
                  )}
                  {isOwner && (
                    <button
                      className="icon-button"
                      title="Delete image"
                      aria-label="Delete image"
                      onClick={() => void deleteMedia(file)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!media.length && (
            <div className="editor-empty">
              <Image size={34} />
              <p>No uploaded images yet.</p>
            </div>
          )}
        </main>
      )}
      {tab === "analytics" && isOwner && (
        <main className="studio-content studio-panel analytics-panel">
          <div className="editor-section-heading">
            <div>
              <span className="section-index">AGGREGATE SITE ACTIVITY</span>
              <h1>Analytics</h1>
            </div>
            <button
              type="button"
              className="button secondary"
              onClick={() => void loadOwnerTools()}
            >
              <Activity size={15} /> Refresh
            </button>
          </div>
          <p className="analytics-privacy">
            Privacy-first totals only. No cookies, IP addresses, visitor IDs,
            user agents, or full referrer URLs are stored. Events are retained
            for 400 days.
          </p>
          <div className="analytics-summary">
            {(["view", "outbound", "contact"] as const).map((event) => (
              <article key={event}>
                <span>
                  {event === "view"
                    ? "Page views"
                    : event === "outbound"
                      ? "Outbound clicks"
                      : "Contact submissions"}
                </span>
                <strong>
                  {analytics
                    .filter((row) => row.event === event)
                    .reduce((sum, row) => sum + row.count, 0)
                    .toLocaleString()}
                </strong>
              </article>
            ))}
          </div>
          <div className="analytics-table-wrap">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Date (UTC)</th>
                  <th>Page</th>
                  <th>Event</th>
                  <th>Referrer host</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {analytics.map((row, index) => (
                  <tr
                    key={`${row.day}-${row.page}-${row.event}-${row.referrerHost}-${index}`}
                  >
                    <td>{row.day}</td>
                    <td>{row.page}</td>
                    <td>{row.event}</td>
                    <td>{row.referrerHost || "Direct / unknown"}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!analytics.length && <p>No activity recorded yet.</p>}
          </div>
        </main>
      )}
      {tab === "history" && isOwner && (
        <main className="studio-content studio-panel">
          <div className="editor-section-heading">
            <div>
              <span className="section-index">CONTENT SNAPSHOTS</span>
              <h1>Version history</h1>
            </div>
          </div>
          <p className="studio-help">
            Every successful save keeps a snapshot. Restoring creates a new
            revision and keeps the current content in history.
          </p>
          <div className="history-list">
            {versions.map((version) => (
              <article className="history-row" key={version.revision}>
                <div>
                  <strong>Revision {version.revision}</strong>
                  <small>{new Date(version.createdAt).toLocaleString()}</small>
                </div>
                <button
                  className="button secondary"
                  disabled={pending}
                  onClick={() => void restoreVersion(version.revision)}
                >
                  Restore
                </button>
              </article>
            ))}
          </div>
          {!versions.length && (
            <div className="editor-empty">
              <History size={34} />
              <p>No saved versions yet.</p>
            </div>
          )}
        </main>
      )}
      {tab === "inbox" && isOwner && (
        <main className="studio-content studio-panel">
          <div className="editor-section-heading">
            <div>
              <span className="section-index">CONTACT SUBMISSIONS</span>
              <h1>Inbox</h1>
            </div>
          </div>
          <div className="contact-inbox">
            {contacts.map((message) => (
              <article className="contact-message" key={message.id}>
                <div className="contact-message-header">
                  <div>
                    <strong>{message.name}</strong>
                    <a href={`mailto:${message.email}`}>{message.email}</a>
                  </div>
                  <span className={`contact-status ${message.status}`}>
                    {message.status}
                  </span>
                </div>
                <small>{new Date(message.createdAt).toLocaleString()}</small>
                {message.subject && <h2>{message.subject}</h2>}
                <p>{message.message}</p>
                {message.status !== "archived" && (
                  <button
                    className="button secondary"
                    onClick={() => void updateContact(message)}
                  >
                    {message.status === "new" ? "Mark read" : "Archive"}
                  </button>
                )}
              </article>
            ))}
          </div>
          {!contacts.length && (
            <div className="editor-empty">
              <Inbox size={34} />
              <p>No messages yet.</p>
            </div>
          )}
        </main>
      )}
      {deleteId && (
        <Modal title="Delete project?" onClose={() => setDeleteId(null)}>
          <div className="delete-confirm">
            <p>
              {draft.projects.find((item) => item.id === deleteId)?.title} will
              be removed when your changes are saved.
            </p>
            <div>
              <button
                className="button secondary"
                onClick={() => setDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="button danger"
                onClick={() => {
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          projects: current.projects.filter(
                            (item) => item.id !== deleteId,
                          ),
                        }
                      : current,
                  );
                  setSelectedId(
                    draft.projects.find((item) => item.id !== deleteId)?.id ??
                      "",
                  );
                  setDeleteId(null);
                }}
              >
                Delete project <Trash2 size={16} />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
