import { Link } from 'react-router-dom';
import { talks } from '../talks';

const ExternalLink = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
);

const Talks = () => {
  return (
    <div>
      <h1 className="page-title">talks</h1>

      <table className="post-table post-table-detailed talk-table">
        <tbody>
          {talks.map((talk) => (
            <tr key={talk.slidesUrl}>
              <td className="post-date">{talk.date}</td>
              <td>
                <div className="talk">
                  <div className="talk-info">
                    <span className="talk-title">{talk.title}</span>
                    {talk.events.map((event) => (
                      <div key={event.url} className="post-tagline">
                        <ExternalLink href={event.url}>{event.name}</ExternalLink>
                      </div>
                    ))}
                    <div className="talk-links">
                      <ExternalLink href={talk.slidesUrl}>slides (pdf)</ExternalLink>
                      <span className="nav-separator"> · </span>
                      <Link to={`/writing/${talk.postSlug}`}>article</Link>
                      {talk.videoUrl && (
                        <>
                          <span className="nav-separator"> · </span>
                          <ExternalLink href={talk.videoUrl}>video</ExternalLink>
                        </>
                      )}
                    </div>
                  </div>
                  <a className="talk-thumb" href={talk.slidesUrl} target="_blank" rel="noopener noreferrer">
                    <img src={talk.thumbnailUrl} width="640" height="360" alt={`Title slide of ${talk.title}`} />
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Talks;
