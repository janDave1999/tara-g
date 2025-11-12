import { createBucketClient } from '@cosmicjs/sdk'

const cosmic = createBucketClient({
  bucketSlug: import.meta.env.PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: import.meta.env.PUBLIC_COSMIC_READ_KEY
})

const props = `{
  slug
  title
  metadata {
    seo
    content
    author {
      title
    }
    featured_image {
      imgix_url
      url
    }
    excerpt
  }
  author {
    name
  }
  created_at
  categories
}`


export async function getAllPosts(skip, limit, slug) {
  if (slug !== undefined) {
    let data = await cosmic.objects.findOne({
      type: 'posts',
      slug: slug
    }).props(props)
    return data
  } else {
  const data = await cosmic.objects
    .find({
      type: 'posts'
    })
    .props(props)
    .sort('-created_at')
    .skip(skip || 0)
    .limit(limit || 10)
  return data
  }
}