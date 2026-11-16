import { Link } from 'react-router-dom';
import { posts } from '../posts';

const tldr = [
  ['Experience.', '9 years building data-intensive systems, the last five for ML.'],
  ['Languages.', 'Extensive experience in the Python ecosystem, 3+ years of production Go, and a recent focus on Rust.'],
  ['Open source.', 'Contributions to developer tools and AI infra – ty, Ruff and others.'],
  ['Background.', 'I studied Air Navigation at the National Aviation University in Kyiv.'],
];

const ExternalLink = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
);

const About = () => {
  return (
    <div>
      <h1 className="visually-hidden">Denys Zhak</h1>
      <img className="profile-photo" src="/photo.jpg" alt="Denys Zhak" />
      <p className="muted">
        software engineer &middot; distributed systems &amp; ML infra &middot; currently at <ExternalLink href="https://imubit.com/">Imubit</ExternalLink>
      </p>
      <p>
        Most machine learning outputs are predictions someone reads. I work on the kind that moves physical equipment &ndash; at <ExternalLink href="https://imubit.com/">Imubit</ExternalLink>, I build the on-prem application and cloud platform around deep-learning controllers that run refineries in closed loop.
      </p>
      <p>
        I enjoy building predictable and reliable systems in the first place. Over the past year, I've also been contributing to open source, which you can check out on <Link to="/open-source">this page</Link>. I write here about whatever piques my engineering curiosity, problems I've run into, and what I learned solving them.
      </p>

      <h2>Recent writing</h2>
      <table className="post-table">
        <tbody>
          {posts.map((post) => (
            <tr key={post.slug}>
              <td className="post-date">{post.date}</td>
              <td><Link to={`/writing/${post.slug}`}>{post.title}</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="more-link"><Link to="/writing">all writing &rarr;</Link></p>

      <h2>tl;dr</h2>
      <ul className="labeled-list">
        {tldr.map(([label, text]) => (
          <li key={label}><strong>{label}</strong> {text}</li>
        ))}
      </ul>

      <h2>Contact</h2>
      <p>I'm always happy to hear from people working on distributed systems, ML infra, dev tools, or inference.</p>
      <table className="contact-table">
        <tbody>
          <tr>
            <td className="contact-key">email</td>
            <td><a href="mailto:denyszhak@gmail.com">denyszhak@gmail.com</a></td>
          </tr>
          <tr>
            <td className="contact-key">github</td>
            <td><ExternalLink href="https://github.com/denyszhak">github.com/denyszhak</ExternalLink></td>
          </tr>
          <tr>
            <td className="contact-key">linkedin</td>
            <td><ExternalLink href="https://www.linkedin.com/in/denyszhak/">linkedin.com/in/denyszhak</ExternalLink></td>
          </tr>
          <tr>
            <td className="contact-key">x</td>
            <td><ExternalLink href="https://x.com/denyszhak_">@denyszhak_</ExternalLink></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default About;
