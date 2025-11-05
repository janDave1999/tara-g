import type { SCHEMA_WEB_PAGE_TAGGING_PROPS } from "@/types/seo/pages";
import type { QuantitativeValue, WebPage} from "schema-dts"

export function basicWebPageSchemaTags({
  type,
  title = "__PROJECT_NAME__",
  webUrl = "https://www.example.com",
  description,
  headline,
  keywords,
  inLanguage = "en",
  datePublished,
  dateModified,
  author,
  isPartOf,
  publisher,
  previewImage,
  breadcrumb,
  aggregateRating,
  mentionedKeywords,
  topics,
  license,
  copyrightHolder,
  copyrightYear,
  dateReviewed,
  reviewedBy,
}: SCHEMA_WEB_PAGE_TAGGING_PROPS) {
  const data: WebPage = {
    "@context": "https://schema.org",
    "@type": type,
  } as any;

  // Core Properties
  data.name = title;
  data.url = webUrl;

  // Add optional properties only if provided
  if (description) data.description = description;
  if (headline) data.headline = headline;
  if (keywords) {
    data.keywords = Array.isArray(keywords) ? keywords.join(", ") : keywords;
  }
  if (inLanguage) data.inLanguage = inLanguage;
  
  // Publishing Info
  if (datePublished) data.datePublished = datePublished;
  if (dateModified) data.dateModified = dateModified;
  if (author) {
    if(Array.isArray(author)){
      data.author = author.map(a => ({
        ...a,
        "@type": a.type,
      }));
    } else {
      data.author = {
        ...author,
        "@type": author.type,
      };
    }
  }
  
  // Website & Organization
  if (isPartOf) data.isPartOf = {
    "@type": "WebSite",
    ...isPartOf,
  };
  if (publisher) data.publisher = {
    "@type": "Organization",
    name: publisher.name,
    logo: {
      "@type": "ImageObject",
      ...publisher.logo,
    },
  };
  
  // Media
  if (previewImage) {
    if (typeof previewImage === "string") {
      data.image = {
        "@type": "ImageObject",
        url: previewImage
      };
    } else {
      const width: QuantitativeValue | undefined = previewImage.width !== undefined ? { "@type": "QuantitativeValue", value: previewImage.width } : undefined;
      const height: QuantitativeValue | undefined = previewImage.height !== undefined ? { "@type": "QuantitativeValue", value: previewImage.height } : undefined;
      data.image = {
        "@type": "ImageObject",
        url: previewImage.url,
        width,
        height,
        caption: previewImage.caption,
      };
    }
  }
  
  // Navigation & Structure
  if (breadcrumb) data.breadcrumb = {
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumb.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url || undefined,
    })),
  };
  
  // Reviews & Ratings
  if (aggregateRating) data.aggregateRating = {
    "@type": "AggregateRating",
    ...aggregateRating,
  };
  
  // Additional Properties
  if (mentionedKeywords) data.mentions = mentionedKeywords;
  if (topics) data.about = topics;
  if (license) data.license = license;
  if (copyrightHolder) data.copyrightHolder = {
    "@type": copyrightHolder.type,
    name: copyrightHolder.name,
  };
  if (copyrightYear) data.copyrightYear = copyrightYear;
  
  // Technical
  if (dateReviewed) data.lastReviewed = dateReviewed;
  if (reviewedBy) data.reviewedBy = {
    "@type": reviewedBy.type,
    name: reviewedBy.name,
  };

  return data;
}