import type {
  PortfolioContact,
  PortfolioContactRecord,
  PortfolioContactStatus,
  PortfolioContent,
  PortfolioVersion,
} from "@portfolio/contracts";
export const initialContent: PortfolioContent = {
  revision: 0,
  projectLayout: "editorial",
  pages: [],
  profile: {
    name: "Phan Hoai Thu",
    role: "DevOps & Cloud Engineering",
    headline: "Thoughtful systems. Reliable by design.",
    intro:
      "I bring applications, infrastructure, and delivery together. Exploring better ways to build, ship, and run software, one project at a time.",
    about:
      "My work brings together application development, cloud infrastructure, and delivery automation. This space collects the projects I am building and the engineering decisions behind them.\n\nI care about clear architecture, repeatable delivery, and understanding what happens after software reaches production. From the first commit to the last dashboard, every part of the system matters.",
    location: "",
    email: "",
    githubUrl: "",
    linkedinUrl: "",
    resumeUrl: "",
    heroImage:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=2000&q=85",
    skills: [
      "TypeScript",
      "React",
      "Node.js",
      "Kubernetes",
      "Terraform",
      "Jenkins",
      "Argo CD",
      "SQLite",
      "Kafka",
      "Elasticsearch",
      "OpenTelemetry",
      "Grafana",
    ],
    contactHeading: "Have something in mind?",
    contactText:
      "A project, an interesting problem, or a conversation about building better systems. Let's connect.",
    seoTitle: "Phan Hoai Thu | DevOps & Cloud Engineering Portfolio",
    seoDescription:
      "Selected projects in cloud infrastructure, application delivery, and reliable systems engineering.",
    heroImageAlt: "Abstract server racks with illuminated network lights",
    translations: {
      vi: {
        role: "Kỹ sư DevOps & Cloud",
        headline: "Hệ thống chỉn chu. Vận hành tin cậy.",
        intro:
          "Tôi kết nối ứng dụng, hạ tầng và quy trình phát hành. Tôi luôn tìm cách tốt hơn để xây dựng, triển khai và vận hành phần mềm qua từng dự án.",
        about:
          "Công việc của tôi kết hợp phát triển ứng dụng, hạ tầng đám mây và tự động hóa triển khai. Đây là nơi tôi chia sẻ các dự án cùng những quyết định kỹ thuật phía sau.\n\nTôi quan tâm đến kiến trúc rõ ràng, quy trình có thể lặp lại và việc hiểu điều gì xảy ra sau khi phần mềm lên production. Từ commit đầu tiên đến dashboard cuối cùng, mọi phần đều quan trọng.",
        contactHeading: "Bạn đang có ý tưởng?",
        contactText:
          "Một dự án, một bài toán thú vị, hay cuộc trò chuyện về cách xây dựng hệ thống tốt hơn. Hãy kết nối nhé.",
      },
    },
  },
  projects: [
    {
      id: "82608e97-c5a3-4f9a-9b20-38926ce11a01",
      slug: "personal-portfolio",
      title: "Personal Portfolio",
      category: "Full-stack & Cloud Engineering",
      summary:
        "A bilingual portfolio and private content studio, with durable SQLite storage and a GitOps delivery workflow.",
      description:
        "This portfolio pairs a React frontend with an Express content API. SQLite stores published content, revision history, contact messages, aggregate analytics, and administrator sessions.\n\nThe private studio supports drafts, translations, custom pages, project access controls, and media uploads. Revision checks protect against conflicting edits.\n\nJenkins builds and validates the application, while Helm and Argo CD manage delivery. A single API instance uses persistent local storage; this is a single-host design, not a high-availability deployment.",
      coverImage:
        "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=85",
      liveUrl: "https://phanhoaithu.io.vn",
      repositoryUrl: "",
      tags: [
        "React",
        "TypeScript",
        "Kubernetes",
        "Terraform",
        "SQLite",
        "Express",
        "Argo CD",
        "OpenTelemetry",
      ],
      year: "2026",
      published: true,
      featured: true,
      sortOrder: 0,
      seoTitle: "Personal Portfolio | DevOps & Cloud Engineering",
      seoDescription:
        "A bilingual portfolio with a private content studio, SQLite persistence, and automated delivery.",
      ogImage:
        "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=85",
      coverImageAlt: "Server racks representing the portfolio infrastructure",
      translations: {
        vi: {
          category: "Full-stack & kỹ thuật Cloud",
          summary:
            "Portfolio song ngữ và trang quản trị nội dung riêng, sử dụng SQLite và quy trình triển khai GitOps.",
          description:
            "Portfolio kết hợp giao diện React với API Express. SQLite lưu nội dung, lịch sử phiên bản, tin nhắn liên hệ, thống kê tổng hợp và phiên đăng nhập.\n\nTrang quản trị hỗ trợ bản nháp, bản dịch, trang tùy chỉnh và tải ảnh. Kiểm tra phiên bản giúp tránh ghi đè khi chỉnh sửa đồng thời.\n\nJenkins kiểm thử và build ứng dụng; Helm và Argo CD quản lý triển khai. Một API sử dụng ổ đĩa bền vững trên một máy chủ, không phải mô hình high availability.",
        },
      },
    },
  ],
};
export type PortfolioAnalyticsInput = {
  page: string;
  event: "view" | "outbound" | "contact";
  referrerHost: string;
};
export type PortfolioAnalyticsRow = PortfolioAnalyticsInput & {
  day: string;
  count: number;
};
export interface PortfolioRepository {
  ready(): Promise<void>;
  read(): Promise<PortfolioContent>;
  save(content: PortfolioContent): Promise<PortfolioContent | null>;
  listVersions(): Promise<PortfolioVersion[]>;
  restoreVersion(
    targetRevision: number,
    expectedRevision: number,
  ): Promise<PortfolioContent | null>;
  createContact(contact: PortfolioContact): Promise<PortfolioContactRecord>;
  listContacts(limit: number): Promise<PortfolioContactRecord[]>;
  updateContactStatus(
    id: string,
    status: PortfolioContactStatus,
  ): Promise<PortfolioContactRecord | null>;
  setProjectPassword(
    projectId: string,
    passwordHash: string | null,
  ): Promise<void>;
  projectPasswordHash(projectId: string): Promise<string | undefined>;
  recordAnalytics(input: PortfolioAnalyticsInput): Promise<void>;
  listAnalytics(): Promise<PortfolioAnalyticsRow[]>;
}
