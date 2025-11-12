export type NEWSROOM_CONTENT = {
  id: string;
  title: string;
  published: string;
  // content_type: "BLOG" | "ANNOUNCEMENT" | "MAINTENANCE" | "NEWS";
  // tags: string;
  description: string;
  thumbnail: string;
  excerpt: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  markdown_link: string;
  created_at: string;
  updated_at: string;
  thumbnailSource: string;
  contentSource: string;
}