import { Link, useParams } from 'react-router-dom';
import { POSTS } from './lib/posts';
import { setMetaDescription, setPageTitle } from './lib/seo';

const fmt = (d: string) =>
  new Date(`${d}T00:00:00+04:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function BlogListPage() {
  setPageTitle('Blog');
  setMetaDescription('News, new drinks and branch openings from Milestones Coffee.');
  const posts = [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">News and press</h1>
      {posts.length === 0 && <p className="text-gray-600">No posts yet. Check back soon.</p>}
      {posts.map((p) => (
        <Link key={p.slug} to={`/blog/${p.slug}`} className="block bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">{fmt(p.date)}</p>
          <h2 className="font-semibold text-lg">{p.title}</h2>
          <p className="text-gray-700 mt-1">{p.summary}</p>
        </Link>
      ))}
    </div>
  );
}

export function BlogPostPage() {
  const { slug } = useParams();
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) {
    setPageTitle('Post not found');
    return (
      <div className="space-y-3">
        <p className="text-gray-700">That post was not found.</p>
        <Link to="/blog" className="underline">Back to news</Link>
      </div>
    );
  }
  setPageTitle(post.title);
  setMetaDescription(post.summary);
  return (
    <article className="bg-white rounded-xl p-5 shadow-sm space-y-4">
      <Link to="/blog" className="text-sm underline">← All news</Link>
      <p className="text-xs text-gray-500">{fmt(post.date)}</p>
      <h1 className="text-2xl font-bold">{post.title}</h1>
      {post.body.split(/\n\s*\n/).map((para, i) => (
        <p key={i} className="text-gray-800 leading-relaxed whitespace-pre-line">{para}</p>
      ))}
    </article>
  );
}
