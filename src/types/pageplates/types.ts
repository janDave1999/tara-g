import type { HTMLAttributes } from "astro/types"
import type { PAGE_TYPE } from "../seo/pages"

export interface PAGE_PLATE_PROPS {
  title?: string,
  noHeader?: boolean,
  noFooter?: boolean,
  noContainer?: boolean,
  clean?: boolean,
  expectedHeight?: string,
  prefetch?: string[],
  html?: HTMLAttributes<'html'>,
  description?:{
    fbAppId?: string,
    
    title?: string,
    type?: PAGE_TYPE,
    containsArticle?: boolean,

    description?: string,
    headline?: string,

    datePublished?: string,
    dateModified?: string,
    dateReviewed?: string,
    reviewer?: string,
    reviewerIs?: "Person" | "Organization",

    breadCrumb?: Array<{ name: string, url: string }>,

    author?: string|string[],
    authorUrl?: string,
    authorIs?: "Person" | "Organization",

    keywords?: string[], // For SEO keywords
    mentionedKeywords?: string[], // Different from keywords as this one is the actual keys being discussed in the page
    topics?: string[], // General topics of the page for categorization

    previewImage?: string,
  }
}