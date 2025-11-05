import type { LANGUAGE_CODE } from "@/i18/lang";
import type { TAG_AUTHOR, TAG_COPYRIGHT_HOLDER, TAG_IMAGE_OBJECT, TAG_IMAGE_STRING, TAG_PUBLISHER, TAG_RATING, TAG_REVIEWED_BY, TAG_WEBSITE } from "./tag";
import type { BREADCRUMB_LIST } from "./breadcrumb";

// For Web Pages
const pageTypes = [
  "WebPage",           // Generic web page

  "AboutPage",         // About us pages
  "CheckoutPage",      // Checkout process pages
  "CollectionPage",    // Category/collection pages
  "ContactPage",       // Contact information pages
  "FAQPage",           // Frequently Asked Questions
  "ItemPage",          // Individual item pages
  "MedicalWebPage",    // Medical information pages
  "ProfilePage",       // User/company profile pages
  "SearchResultsPage", // Search results pages  
] as const;
// Reference: https://schema.org/WebPage

export type PAGE_TYPE = typeof pageTypes[number];

export interface SCHEMA_WEB_PAGE_TAGGING_PROPS {
  type: PAGE_TYPE,
  
  // Core Properties
  title?: string,
  webUrl?: string,
  description?: string, // Summary or abstract of the page content
  
  // Content Properties
  headline?: string, // Kicker content or just plain old clickbait though not recommended just use your SEO technique here
  keywords?: string | string[],
  inLanguage?: LANGUAGE_CODE,
  
  // Publishing Info
  datePublished?: string,
  dateModified?: string,
  author?: TAG_AUTHOR|TAG_AUTHOR[],
  
  // Website & Organization
  isPartOf?: TAG_WEBSITE,
  publisher?: TAG_PUBLISHER,
  
  // Media
  previewImage?: TAG_IMAGE_STRING|TAG_IMAGE_OBJECT,
  
  // Navigation & Structure
  breadcrumb?: BREADCRUMB_LIST,
  
  // Reviews & Ratings
  aggregateRating?: TAG_RATING,
  
  // Additional Properties
  mentionedKeywords?: string[],
  topics?: string[],
  license?: string,
  copyrightHolder?: TAG_COPYRIGHT_HOLDER,
  copyrightYear?: number,
  
  // Technical
  dateReviewed?: string,
  reviewedBy?: TAG_REVIEWED_BY,
}