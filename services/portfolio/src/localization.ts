import type {
  PortfolioPage,
  PortfolioProfile,
  PortfolioProject,
} from "@portfolio/contracts";

export type PortfolioLocale = "en" | "vi";

export function getPortfolioLocale(value: unknown): PortfolioLocale {
  return value === "vi" ? "vi" : "en";
}

export function localizeProfile(
  profile: PortfolioProfile,
  locale: PortfolioLocale,
): PortfolioProfile {
  if (locale === "en") return profile;
  return { ...profile, ...(profile.translations?.vi ?? {}) };
}

export function localizeProject(
  project: PortfolioProject,
  locale: PortfolioLocale,
): PortfolioProject {
  if (locale === "en") return project;
  const translation = project.translations?.vi;
  if (!translation) return project;
  const translatedSections = new Map(
    (translation.sections ?? []).map((section) => [section.id, section]),
  );
  return {
    ...project,
    ...translation,
    sections: project.sections?.map((section) => ({
      ...section,
      ...translatedSections.get(section.id),
      type: section.type,
    })),
  };
}

export function localizePage(
  page: PortfolioPage,
  locale: PortfolioLocale,
): PortfolioPage {
  if (locale === "en") return page;
  const translation = page.translations?.vi;
  if (!translation) return page;
  const translatedSections = new Map(
    (translation.sections ?? []).map((section) => [section.id, section]),
  );
  return {
    ...page,
    ...translation,
    sections: page.sections.map((section) => ({
      ...section,
      ...translatedSections.get(section.id),
      type: section.type,
    })),
  };
}
