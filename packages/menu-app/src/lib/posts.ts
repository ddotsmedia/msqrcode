// Press and blog posts. Add a post by appending an object here; body paragraphs are separated by blank lines.
export interface Post {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  summary: string;
  body: string;
}

export const POSTS: Post[] = [];
