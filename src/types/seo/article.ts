// For Content & Publishing
const articles = [
  "Article",           // General articles
  "AdvertiserContentArticle", // Sponsored articles
  "NewsArticle",       // News content
  "Report",            // Formal reports
  "SatiricalArticle", // Satirical articles
  "ScholarlyArticle",  // Academic articles
  "SocialMediaPosting", // Social media posts
  "TechArticle",       // Technical articles
];

export type ARTICLE_TYPE = typeof articles[number];