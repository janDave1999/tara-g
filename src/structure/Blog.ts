export type BlogPost = {
  slug: string;
  title: string;
  created_at: string;
  metadata: {
    excerpt: string;
    title: string;
    content: string;
    featured_image: {
      url: string;
      imgix_url: string;
    };
    author: {
      title: string;
    };
  };
  categories: Array<string>;
};
