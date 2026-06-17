const About = () => {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0 }}>
          <img 
            src="/photo.jpg" 
            alt="Denys" 
            style={{ width: '180px', height: '180px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)', display: 'block' }}
          />
        </div>
        <div style={{ flex: '1', minWidth: '300px' }}>
          <h1 className="page-title" style={{ marginTop: 0 }}>hi,</h1>
          <p>
            Most machine learning outputs are predictions someone reads. I work on the kind that moves physical equipment &ndash; at <a href="https://imubit.com/" target="_blank" rel="noopener noreferrer">Imubit</a>, I build the backend and platform around deep-learning controllers that run refineries in closed loop.
          </p>
          <p>
            I love engineering around serving, monitoring, and reliability. Lately my attention has widened to GPU inference, LLM serving, and keeping large models fast and observable under load.
          </p>
          <p>
            I write here occasionally &ndash; long-form, usually about engineering. Social links at the top if you want to find me elsewhere.
          </p>
        </div>
      </div>

      <h2 className="page-title" style={{ marginTop: '3rem' }}>tl;dr</h2>
      <ul>
        <li>9 years building and operating data-intensive systems, the last five for ML</li>
        <li>Extensive experience in the Python ecosystem, 3 years of production Go, and a recent focus on Rust</li>
        <li>20+ merged open-source contributions to AI infrastructure and developer tools &ndash; Ruff, Ty, Docker Model Runner and others</li>
        <li>I studied Air Navigation at the National Aviation University in Kyiv &ndash; I picked up engineering along the way</li>
      </ul>

    </div>
  );
};

export default About;
