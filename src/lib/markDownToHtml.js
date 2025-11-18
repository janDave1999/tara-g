import { marked } from "marked";

/**
 * Convert Markdown content to safe HTML
 * @param {string} markdown - The markdown string
 * @returns {string} HTML string
 */
export async function markdownToHtml(markdown) {
  if (!markdown) return "";
  
  // Optionally, configure marked for your needs
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  return marked.parse(markdown);
}
