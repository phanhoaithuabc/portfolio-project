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
      "PostgreSQL",
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
      slug: "dailypick",
      title: "DailyPick",
      category: "Full-stack & Cloud Platform",
      summary:
        "An everyday marketplace, engineered beyond the storefront. Microservices, event-driven workflows, and a GitOps delivery platform on one server.",
      description:
        "DailyPick brings together a React storefront and independently deployed backend services. PostgreSQL and a transactional outbox coordinate order events, while Kafka handles asynchronous fulfillment work.\n\nThe platform includes Elasticsearch product search, Stripe test payments, multilingual shopping, and multiple display currencies. Helm, Argo CD, and Jenkins provide a repeatable delivery workflow, with Terraform configurations for AWS, Azure, and GCP.\n\nObservability and cost attribution are part of the design: OpenTelemetry traces, Prometheus metrics, Grafana dashboards, and guarded FinOps recommendations. The single-server deployment is a cost-conscious learning environment, not a claim of high availability.",
      coverImage: "/dailypick-preview.png",
      liveUrl: "https://dailypick.phanhoaithu.io.vn",
      repositoryUrl: "",
      tags: [
        "React",
        "TypeScript",
        "Kubernetes",
        "Terraform",
        "Kafka",
        "PostgreSQL",
        "Argo CD",
        "OpenTelemetry",
      ],
      year: "2026",
      published: true,
      featured: true,
      sortOrder: 0,
      seoTitle: "DailyPick | Nền tảng thương mại điện tử hướng sự kiện",
      seoDescription:
        "Khám phá cách DailyPick kết hợp storefront, PostgreSQL, Kafka và GitOps trong một nền tảng cloud-native.",
      ogImage: "/dailypick-preview.png",
      coverImageAlt: "Ảnh chụp giao diện cửa hàng DailyPick",
      translations: {
        vi: {
          category: "Full-stack & nền tảng Cloud",
          summary:
            "Một marketplace được xây dựng như một hệ thống hoàn chỉnh: microservice, xử lý sự kiện và nền tảng GitOps trên một máy chủ.",
          description:
            "DailyPick kết hợp storefront React với các backend service triển khai độc lập. PostgreSQL và transactional outbox điều phối sự kiện đơn hàng, còn Kafka xử lý fulfillment bất đồng bộ.\n\nNền tảng tích hợp tìm kiếm Elasticsearch, thanh toán Stripe test, trải nghiệm đa ngôn ngữ và nhiều đơn vị tiền tệ hiển thị. Helm, Argo CD và Jenkins tạo quy trình triển khai có thể lặp lại; Terraform cung cấp cấu hình cho AWS, Azure và GCP.\n\nOpenTelemetry, Prometheus, Grafana và các đề xuất FinOps có kiểm soát hỗ trợ quan sát hệ thống và phân bổ chi phí. Mô hình một máy chủ phục vụ học tập và tối ưu chi phí, không phải cam kết high availability.",
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
