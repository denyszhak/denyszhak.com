import { FiGithub } from 'react-icons/fi';
import { Link } from 'react-router-dom';

const OpenSource = () => {
  const contributions = [
    {
      title: "ty & Ruff",
      type: "Rust",
      stars: "49k",
      githubUrl: "https://github.com/astral-sh/ruff",
      description: (
        <>
          <a href="https://github.com/astral-sh/ruff/pulls?q=is%3Apr+author%3Adenyszhak+sort%3Acomments-desc+is%3Amerged" target="_blank" rel="noopener noreferrer">22 merged pull requests</a> to ty and Ruff, Astral's Python tools written in Rust: <Link to="/writing/how-a-python-type-checker-decides-a-variable-is-unused">diagnostic rules for unused bindings</Link>, unreachable-code hints, type-checking fixes, and faster AST parenthesized-range handling.
        </>
      )
    },
    {
      title: "AI infra",
      type: "Go, Rust, Vulkan & ROCm",
      description: (
        <>
          <span className="work-desc-section"><strong>Docker Model Runner.</strong> Implemented <a href="https://github.com/docker/model-runner/pull/618" target="_blank" rel="noopener noreferrer"><code>docker model launch</code></a> (<a href="https://docs.docker.com/reference/cli/docker/model/launch/" target="_blank" rel="noopener noreferrer">docs</a>) and added the <a href="https://github.com/docker/model-runner/pull/477" target="_blank" rel="noopener noreferrer">SGLang inference backend</a>, enabling agentic tools such as Claude Code and Codex to run against local models.</span>
          <span className="work-desc-section"><strong>GPU backends.</strong> Brought up LLM inference on non-NVIDIA GPUs across two stacks. Implemented the <a href="https://github.com/ericcurtin/vllm-vulkan/pull/10" target="_blank" rel="noopener noreferrer">Vulkan decode-attention path</a> in vllm-vulkan, including GLSL kernels for online softmax and cooperative QK reduction over paged KV caches. Added the <a href="https://github.com/ericcurtin/inferrs/pull/248" target="_blank" rel="noopener noreferrer">ROCm backend</a> to inferrs, which loads HIP and hipBLAS at runtime without requiring the ROCm toolchain at build time and serves models on an MI300X.</span>
        </>
      )
    },
    {
      title: "Dev tools and infra",
      type: "Rust & Zig",
      description: (
        <>
          <span className="work-desc-section"><strong>Databases.</strong> Prevented <a href="https://github.com/tursodatabase/turso/pull/8032" target="_blank" rel="noopener noreferrer">explicit checkpoints from overlapping root statements</a> on the same Turso connection, and <a href="https://github.com/SeaQL/sea-orm/pull/2845" target="_blank" rel="noopener noreferrer">fixed LEFT JOIN deserialization for nested models</a> in SeaORM.</span>
          <span className="work-desc-section"><strong>Shells and terminals.</strong> Contributed fixes and tooling to <a href="https://github.com/ghostty-org/ghostty/pulls?q=is%3Apr+author%3Adenyszhak+is%3Amerged" target="_blank" rel="noopener noreferrer">Ghostty</a> and <a href="https://github.com/fish-shell/fish-shell/commit/daa554123ffce7277fefbe52f6bb4547066242f9" target="_blank" rel="noopener noreferrer">fish shell</a>.</span>
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
    </div>
  );
};

export default OpenSource;
