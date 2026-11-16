import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { postCategories, posts } from '../posts';
// import SubscribeForm from '../components/SubscribeForm';

const Writing = () => {
  const [activeCategory, setActiveCategory] = useState('all');

  const visiblePosts = activeCategory === 'all'
    ? posts
    : posts.filter((post) => post.category === activeCategory);

  return (
    <div>
      <h1 className="page-title">writing</h1>
      <p className="muted">
        Writing about systems I’ve built, open source, and technical questions I’ve tried to answer.
      </p>

      <p className="writing-filter">
        <span className="muted">filter: </span>
        {postCategories.map((category, index) => (
          <Fragment key={category}>
            {index > 0 && <span className="nav-separator"> · </span>}
            <button
              type="button"
              aria-pressed={activeCategory === category}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          </Fragment>
        ))}
      </p>

      <table className="post-table post-table-detailed">
        <tbody>
          {visiblePosts.map((post) => (
            <tr key={post.slug}>
              <td className="post-date">{post.date}</td>
              <td>
                <Link to={`/writing/${post.slug}`}>{post.title}</Link>
                <div className="post-tagline">{post.tagline}</div>
                <div className="post-tags">
                  {post.tags.map((tag) => <span key={tag} className="post-tag">{tag}</span>)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {visiblePosts.length === 0 && (
        <p className="muted">No {activeCategory} articles yet.</p>
      )}

      {/* <SubscribeForm /> */}
    </div>
  );
};

export default Writing;
