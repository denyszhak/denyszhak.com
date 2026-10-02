const About = () => {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2.5rem', flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0, marginTop: '0.4rem' }}>
          <img
            src="/photo.jpg"
            alt="Denys"
            style={{ width: '180px', height: '180px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)', display: 'block' }}
          />
        </div>
        <div style={{ flex: '1', minWidth: '300px' }}>
          <h1 className="page-title" style={{ marginTop: 0, marginBottom: '0.4rem' }}>Denys Zhak</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>software engineer &middot; distributed systems &amp; ML infra</p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.4rem' }}>
            currently at <a href="https://imubit.com/" target="_blank" rel="noopener noreferrer">Imubit</a> &nbsp;&middot;&nbsp; <a href="https://github.com/denyszhak" target="_blank" rel="noopener noreferrer">github</a>
          </p>
          <p>
            Most machine learning outputs are predictions someone reads. I work on the kind that moves physical equipment &ndash; at <a href="https://imubit.com/" target="_blank" rel="noopener noreferrer">Imubit</a>, I build the on-prem application and cloud platform around deep-learning controllers that run refineries in closed loop.
          </p>
          <p style={{ marginBottom: 0 }}>
            I enjoy building predictable and reliable systems in the first place.
            <br />
            Over the past year, I've also been contributing to open source, which you can check out on <a href="https://www.denyszhak.com/open-source">this page</a>. I write here about whatever piques my engineering curiosity, problems I've run into, and what I learned solving them.
          </p>
        </div>
      </div>

      <h2 className="page-title" style={{ marginTop: '3rem' }}>tl;dr</h2>
      <ul>
        <li>9 years building data-intensive systems, the last five for ML</li>
        <li>Extensive experience in the Python ecosystem, 3+ years of production Go, and a recent focus on Rust</li>
        <li>open-source contributions to developer tools and AI infra &ndash; ty, Ruff and others</li>
        <li>I studied Air Navigation at the National Aviation University in Kyiv</li>
      </ul>

      <h2 className="page-title" style={{ marginTop: '3rem' }}>contact</h2>
      <p>
        I'm always happy to hear from people working on distributed systems, ML infra, dev tools, or inference: <a href="mailto:denyszhak@gmail.com">denyszhak@gmail.com</a>.
      </p>

    </div>
  );
};

export default About;
