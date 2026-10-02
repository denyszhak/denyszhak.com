import { useState } from 'react';
import { Link } from 'react-router-dom';
// import SubscribeForm from '../components/SubscribeForm';

const Writing = () => {
  const categories = ['all', 'work', 'open source', 'research'];
  const [activeCategory, setActiveCategory] = useState('all');

  const posts = [
    {
      date: "12 Sep 2026",
      title: "A Checkpoint in the Middle of an INSERT",
      slug: "a-checkpoint-in-the-middle-of-an-insert",
      category: "open source",
      tags: ["Turso", "database internals", "Rust"],
      tagline: "How a checkpoint invalidated an unfinished INSERT’s cursor in Turso."
    },
    {
      date: "12 Aug 2026",
      title: "How a Python type checker decides a variable is unused",
      slug: "how-a-python-type-checker-decides-a-variable-is-unused",
      category: "open source",
      tags: ["Python", "LSP", "ty"],
      tagline: "ty tracks reads across Python scopes to decide which local bindings your editor should dim."
    },
    {
      date: "7 Jul 2026",
      title: "What AWS Lambda was hiding",
      slug: "what-aws-lambda-was-hiding",
      category: "work",
      tags: ["distributed systems", "serverless"],
      tagline: "A class of bugs Lambda's runtime had been quietly absorbing. The migration to long-running services exposed them."
    }
  ];

  const visiblePosts = activeCategory === 'all'
    ? posts
    : posts.filter((post) => post.category === activeCategory);

  return (
    <div>
      <h1 className="page-title">writing</h1>
      <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        Writing about systems I’ve built, open source, and technical questions I’ve tried to answer.
      </p>

      <nav className="writing-categories" aria-label="Writing categories">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={'writing-category' + (activeCategory === category ? ' active' : '')}
            aria-pressed={activeCategory === category}
            onClick={() => setActiveCategory(category)}
          >
            [{category}]
          </button>
        ))}
      </nav>

      <div className="post-list">
        {visiblePosts.map((post) => (
          <div key={post.slug} className="post-item" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flex: 1 }}>
              <span style={{ color: 'var(--text-secondary)', minWidth: '90px', paddingTop: '0.1rem' }}>{post.date}</span>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <Link to={`/writing/${post.slug}`} className="post-title" style={{ textDecoration: 'none' }}>{post.title}</Link>
                {post.tagline && (
                  <div style={{ marginTop: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                    {post.tagline}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                  {post.tags.map(tag => (
                    <span key={tag} className="post-tag">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {visiblePosts.length === 0 && (
          <p className="writing-empty">No {activeCategory} articles yet.</p>
        )}

      </div>

      {/* <SubscribeForm /> */}
    </div>
  );
};

export default Writing;
