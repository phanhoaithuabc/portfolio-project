import { z } from "zod";
const link = z
  .string()
  .max(2000)
  .refine(
    (value) =>
      value === "" ||
      (value.startsWith("/") &&
        !value.startsWith("//") &&
        !value.includes("\\") &&
        !/[\u0000-\u001f]/.test(value)) ||
      (() => {
        try {
          return new URL(value).protocol === "https:";
        } catch {
          return false;
        }
      })(),
    "Use an HTTPS URL or a local /path",
  );
export const portfolioProfileTranslationSchema = z
  .object({
    role: z.string().trim().min(2).max(100).optional(),
    headline: z.string().trim().min(2).max(160).optional(),
    intro: z.string().trim().min(10).max(500).optional(),
    about: z.string().trim().min(10).max(3000).optional(),
    contactHeading: z.string().trim().min(2).max(140).optional(),
    contactText: z.string().trim().min(2).max(500).optional(),
    skills: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  })
  .partial();
export const portfolioMediaItemSchema = z.object({
  id: z.uuid(),
  url: link,
  alt: z.string().trim().max(300).default(""),
  caption: z.string().trim().max(500).default(""),
});
export const portfolioMetricSchema = z.object({
  id: z.uuid(),
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(80),
});
export const portfolioBlockSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(["text", "image", "gallery", "video", "metrics"]),
    heading: z.string().trim().max(180).default(""),
    body: z.string().trim().max(6000).default(""),
    image: link.optional(),
    imageAlt: z.string().trim().max(300).default(""),
    caption: z.string().trim().max(500).default(""),
    images: z.array(portfolioMediaItemSchema).max(20).optional(),
    videoUrl: link.optional(),
    metrics: z.array(portfolioMetricSchema).max(8).optional(),
  })
  .superRefine((block, context) => {
    if (block.type === "text" && !block.body.trim())
      context.addIssue({
        code: "custom",
        path: ["body"],
        message: "Text blocks need content.",
      });
    if (block.type === "image" && !block.image)
      context.addIssue({
        code: "custom",
        path: ["image"],
        message: "Choose an image.",
      });
    if (block.type === "gallery" && !block.images?.length)
      context.addIssue({
        code: "custom",
        path: ["images"],
        message: "Add at least one gallery image.",
      });
    if (block.type === "video" && !block.videoUrl)
      context.addIssue({
        code: "custom",
        path: ["videoUrl"],
        message: "Add a video URL.",
      });
    if (block.type === "metrics" && !block.metrics?.length)
      context.addIssue({
        code: "custom",
        path: ["metrics"],
        message: "Add at least one metric.",
      });
  });
export const portfolioBlockTranslationSchema = z.object({
  id: z.uuid(),
  heading: z.string().trim().max(180).optional(),
  body: z.string().trim().max(6000).optional(),
  imageAlt: z.string().trim().max(300).optional(),
  caption: z.string().trim().max(500).optional(),
  images: z.array(portfolioMediaItemSchema).max(20).optional(),
  metrics: z.array(portfolioMetricSchema).max(8).optional(),
});
export const portfolioProjectTranslationSchema = z
  .object({
    title: z.string().trim().min(2).max(100).optional(),
    category: z.string().trim().min(2).max(60).optional(),
    summary: z.string().trim().min(10).max(400).optional(),
    description: z.string().trim().min(10).max(6000).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    sections: z.array(portfolioBlockTranslationSchema).max(40).optional(),
  })
  .partial();
export const portfolioPageTranslationSchema = z
  .object({
    title: z.string().trim().min(2).max(100).optional(),
    navLabel: z.string().trim().min(1).max(50).optional(),
    summary: z.string().trim().max(400).optional(),
    sections: z.array(portfolioBlockTranslationSchema).max(40).optional(),
  })
  .partial();
export const portfolioPageSchema = z.object({
  id: z.uuid(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  title: z.string().trim().min(2).max(100),
  navLabel: z.string().trim().min(1).max(50),
  summary: z.string().trim().max(400),
  sections: z.array(portfolioBlockSchema).max(40),
  published: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
  seoTitle: z.string().trim().max(120).optional(),
  seoDescription: z.string().trim().max(320).optional(),
  ogImage: link.optional(),
  translations: z.object({ vi: portfolioPageTranslationSchema }).optional(),
});
export const portfolioProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  role: z.string().trim().min(2).max(100),
  headline: z.string().trim().min(2).max(160),
  intro: z.string().trim().min(10).max(500),
  about: z.string().trim().min(10).max(3000),
  location: z.string().trim().max(100),
  email: z.union([z.literal(""), z.email()]),
  githubUrl: link,
  linkedinUrl: link,
  resumeUrl: link,
  heroImage: link,
  skills: z.array(z.string().trim().min(1).max(40)).max(30),
  contactHeading: z.string().trim().min(2).max(140),
  contactText: z.string().trim().min(2).max(500),
  seoTitle: z.string().trim().max(120).optional(),
  seoDescription: z.string().trim().max(320).optional(),
  ogImage: link.optional(),
  heroImageAlt: z.string().trim().max(300).optional(),
  translations: z.object({ vi: portfolioProfileTranslationSchema }).optional(),
});
export const portfolioProjectSchema = z.object({
  id: z.uuid(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  title: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(60),
  summary: z.string().trim().min(10).max(400),
  description: z.string().trim().min(10).max(6000),
  coverImage: link,
  liveUrl: link,
  repositoryUrl: link,
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  year: z.string().regex(/^20\d{2}$/),
  published: z.boolean(),
  featured: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
  seoTitle: z.string().trim().max(120).optional(),
  seoDescription: z.string().trim().max(320).optional(),
  ogImage: link.optional(),
  coverImageAlt: z.string().trim().max(300).optional(),
  sections: z.array(portfolioBlockSchema).max(40).optional(),
  visibility: z.enum(["public", "unlisted", "password"]).optional(),
  translations: z.object({ vi: portfolioProjectTranslationSchema }).optional(),
});
export const portfolioContentSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    profile: portfolioProfileSchema,
    projects: z.array(portfolioProjectSchema).max(100),
    pages: z.array(portfolioPageSchema).max(30).optional(),
    projectLayout: z.enum(["editorial", "grid"]).optional(),
  })
  .refine(
    (content) =>
      new Set(content.projects.map((project) => project.id)).size ===
        content.projects.length &&
      new Set(content.projects.map((project) => project.slug)).size ===
        content.projects.length &&
      new Set((content.pages ?? []).map((page) => page.id)).size ===
        (content.pages ?? []).length &&
      new Set((content.pages ?? []).map((page) => page.slug)).size ===
        (content.pages ?? []).length &&
      !(content.pages ?? []).some((page) =>
        content.projects.some((project) => project.slug === page.slug),
      ),
    "Project/page IDs and slugs must be unique",
  );
export type PortfolioProfile = z.infer<typeof portfolioProfileSchema>;
export type PortfolioProject = z.infer<typeof portfolioProjectSchema>;
export type PortfolioBlock = z.infer<typeof portfolioBlockSchema>;
export type PortfolioBlockTranslation = z.infer<
  typeof portfolioBlockTranslationSchema
>;
export type PortfolioMediaItem = z.infer<typeof portfolioMediaItemSchema>;
export type PortfolioMetric = z.infer<typeof portfolioMetricSchema>;
export type PortfolioPage = z.infer<typeof portfolioPageSchema>;
export type PortfolioContent = z.infer<typeof portfolioContentSchema>;
export type PortfolioContact = z.infer<typeof portfolioContactSchema>;
export const portfolioContactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  subject: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().min(10).max(5000),
});
export const portfolioContactStatusSchema = z.enum(["new", "read", "archived"]);
export type PortfolioContactStatus = z.infer<
  typeof portfolioContactStatusSchema
>;
export type PortfolioContactRecord = PortfolioContact & {
  id: string;
  status: PortfolioContactStatus;
  createdAt: string;
};
export type PortfolioVersion = {
  revision: number;
  createdAt: string;
};
