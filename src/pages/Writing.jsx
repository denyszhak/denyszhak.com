import { Link } from 'react-router-dom';
// import SubscribeForm from '../components/SubscribeForm';

const Writing = () => {
  const posts = [
    {
      date: "12/08/2026",
      title: "How a Python type checker decides a variable is unused",
      slug: "how-a-python-type-checker-decides-a-variable-is-unused",
      tags: ["Python", "LSP", "ty"],
      tagline: "ty tracks reads across Python scopes to decide which local bindings your editor should dim."
    },
    {
      date: "07/07/2026",
      title: "What AWS Lambda was hiding",
      slug: "what-aws-lambda-was-hiding",
      tags: ["distributed systems", "serverless"],
      tagline: "A class of bugs Lambda's runtime had been quietly absorbing. The migration to long-running services exposed them."
    }
  ];

  return (
    <div>
      <h1 className="page-title">writing</h1>
      <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        Writing about systems I've built, operated, and contributed to, and what they taught me.
      </p>

      <div className="post-list">
        {posts.map((post, index) => (
          <div key={index} className="post-item" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
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

      </div>

      {/* <SubscribeForm /> */}
    </div>
  );
};

export default Writing;

