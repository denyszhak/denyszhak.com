import { FiGithub } from 'react-icons/fi';

const OpenSource = () => {
  const contributions = [
    {
      title: "Ruff & Ty (Astral)",
      type: "Rust",
      stars: "48k",
      githubUrl: "https://github.com/astral-sh/ruff",
      description: (
        <>
          Contributing <a href="https://github.com/astral-sh/ruff/pulls?q=is%3Apr+author%3Adenyszhak+sort%3Acomments-desc+is%3Aclosed" target="_blank" rel="noopener noreferrer">20+ pull requests</a> with major IDE-facing LSP features, parser optimizations, and type-checking fixes to Ruff and Ty, very fast Python tools written in Rust. E.g., implemented diagnostic rules to detect unused bindings, exposed unreachable code hints, and optimized AST parenthesized range handling.
        </>
      )
    },
    {
      title: "Docker Model Runner",
      type: "Go",
      stars: "590",
      githubUrl: "https://github.com/docker/model-runner",
      description: (
        <>
          Expanding local inference capabilities by adding the <a href="https://github.com/docker/model-runner/pull/477" target="_blank" rel="noopener noreferrer">SGLang alternative inference backend</a> and implementing the <a href="https://github.com/docker/model-runner/pull/618" target="_blank" rel="noopener noreferrer"><code>docker model launch</code> command</a>, enabling agentic tools like Claude Code or Codex to run against local models.
        </>
      )
    },
    {
      title: "Ghostty, fish-shell, SeaORM",
      type: "Rust & Zig",
      description: (
        <>
          Shipped cross-ecosystem improvements to popular developer tooling. E.g., fixed <a href="https://github.com/SeaQL/sea-orm/pull/2845" target="_blank" rel="noopener noreferrer">LEFT JOIN deserialization mappings</a> in SeaORM and improved <a href="https://github.com/fish-shell/fish-shell/commit/daa554123ffce7277fefbe52f6bb4547066242f9" target="_blank" rel="noopener noreferrer">conditional formatting logic</a> in the fish shell code formatter, and added <a href="https://github.com/ghostty-org/ghostty/pull/9551" target="_blank" rel="noopener noreferrer">fish-shell completions</a> while resolving a <a href="https://github.com/ghostty-org/ghostty/pull/9831" target="_blank" rel="noopener noreferrer">macOS UI bug</a> for the Ghostty terminal.
        </>
      )
    }
  ];

  const projects = [
    {
      title: "candle-oxide-kernels",
      type: "Rust, CUDA & PTX",
      githubUrl: "https://github.com/denyszhak/candle-oxide-kernels",
      description: (
        <>
          A research project on replacing <a href="https://github.com/huggingface/candle" target="_blank" rel="noopener noreferrer">Candle</a>'s CUDA kernel crate with PTX generated from Rust via <a href="https://github.com/luminafoundation/cuda-oxide" target="_blank" rel="noopener noreferrer">cuda-oxide</a>, no fork of Candle required. The swap works on simple kernels (copy, fill, cast, affine), verified on a 4090, but doesn't yet extend to kernels using libdevice math (<code>exp</code>, <code>sin</code>, <code>sqrt</code>) – cuda-oxide compiles those to NVVM IR instead of PTX, which Candle's loader doesn't accept.
        </>
      )
    }
  ];

  const renderWorkItem = (project, index) => (
    <div key={index} className="work-item">
      <h2 className="work-title">
        {project.title}
        {project.type && <span>{project.type}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {project.stars && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              {project.stars} ★
            </span>
          )}
          {project.githubUrl && (
            <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>
              <FiGithub size={18} />
            </a>
          )}
        </div>
      </h2>
      <p className="work-desc">{project.description}</p>
    </div>
  );

  return (
    <div>
      <h1 className="page-title">open source contributions</h1>
      <div className="work-list">
        {contributions.map(renderWorkItem)}
      </div>

      <h1 className="page-title" style={{ marginTop: '4rem' }}>engineering research</h1>
      <div className="work-list">
        {projects.map(renderWorkItem)}
      </div>
    </div>
  );
};

export default OpenSource;
