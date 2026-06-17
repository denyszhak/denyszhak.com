import { Link } from 'react-router-dom';
import SubscribeForm from '../components/SubscribeForm';

const Writing = () => {
  const posts = [
    {
      date: "19/05/2026",
      title: "What Lambda was hiding",
      slug: "what-lambda-was-hiding",
      tags: ["distributed systems", "serverless"]
    }
  ];

  return (
    <div>
      <h1 className="page-title">writing</h1>
      <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        Posts about systems engineering, observability, ML, and open source.
      </p>

      <div className="post-list">
        {posts.map((post, index) => (
          <div key={index} className="post-item" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flex: 1 }}>
              <span style={{ color: 'var(--text-secondary)', minWidth: '90px', paddingTop: '0.1rem' }}>{post.date}</span>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <Link to={`/writing/${post.slug}`} className="post-title" style={{ textDecoration: 'none' }}>{post.title}</Link>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                  {post.tags.map(tag => (
                    <span key={tag} className="post-tag">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        <div style={{ marginTop: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', letterSpacing: '0.05em' }}>
          ...more coming soon
        </div>
      </div>

      <SubscribeForm />
    </div>
  );
};

export default Writing;

