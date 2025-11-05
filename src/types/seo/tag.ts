/**
 * https://schema.org/Person
 * https://schema.org/Organization
 */
export type TAG_AUTHOR = {
  type: "Person" | "Organization",
  name: string,
  url?: string, // URL to the author's profile or homepage
};

export type TAG_WEBSITE = {
  name: string,
  url: string,
};

export type TAG_PUBLISHER = {
  name: string,
  logo?: TAG_LOGO,
}

export type TAG_LOGO = {
  url: string,
}

export type TAG_IMAGE_STRING = string

export type TAG_IMAGE_OBJECT = {
  url: string,
  width?: number,
  height?: number,
  caption?: string,
}

export type TAG_QUANTITATIVE_VALUE = {
  value: number,
}

export type TAG_RATING = {
  ratingValue: number,
  reviewCount: number,
  bestRating?: number,
  worstRating?: number,
}

export type TAG_COPYRIGHT_HOLDER = {
  type: "Person" | "Organization",
  name: string,
}

export type TAG_REVIEWED_BY = {
  type: "Person" | "Organization",
  name: string,
}