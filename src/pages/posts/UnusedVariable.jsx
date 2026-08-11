import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiHeart } from 'react-icons/fi';
import { GoGitMerge } from 'react-icons/go';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import { usePostStats } from '../../hooks/usePostStats';

const UnusedVariable = () => {
  const { hasLiked, like } = usePostStats('what-counts-as-an-unused-variable-in-python');

  useEffect(() => {
    Prism.highlightAll();
  }, []);

  return (
    <div className="blog-post-container">
      <Link to="/writing" className="back-link">← back to all posts</Link>

      <article className="article-content">
        <header className="article-header">
          <h1 className="article-title">What counts as an unused variable in Python?</h1>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <span className="post-tag">Python</span>
              <span className="post-tag">LSP</span>
            </div>
            <div className="article-meta">
              <span>11/08/2026</span>
              <span>•</span>
              <span>6 min read</span>
              <span>•</span>
              <button
                onClick={like}
                className={`like-button ${hasLiked ? 'liked' : ''}`}
                disabled={hasLiked}
                aria-label="Like this post"
              >
                <FiHeart className="heart-icon" style={{ fill: hasLiked ? 'var(--accent-color)' : 'transparent', stroke: hasLiked ? 'var(--accent-color)' : 'currentColor' }} />
              </button>
            </div>
          </div>
        </header>

        <p>
          I added <a href="https://github.com/astral-sh/ruff/pull/23305" target="_blank" rel="noopener noreferrer">unused-variable dimming</a> to <a href="https://github.com/astral-sh/ty" target="_blank" rel="noopener noreferrer">ty</a>, Astral's Python type checker written in Rust. When ty finds a local binding with no reads, its language server tells the editor to dim its name. Here, a binding is a name attached to a value in a scope. Assignments, parameters, and loop targets all create bindings.
        </p>

        <p>
          <code>a = 1</code> looks simple when nothing later reads <code>a</code>. The hard part is what counts as a read. Reads cross into nested functions and comprehension scopes, Python creates bindings in more places than <code>=</code>, and some parameters have to stay in a signature without ever being read. When a type checker says a name is unused, that's a firm claim about reads. It has to hold across every scope that can reach the name. Get it wrong and someone deletes a variable their program needs.
        </p>


        <h2>How the graying works</h2>

        <p>
          With the ty extension installed, the editor and ty talk over the Language Server Protocol (LSP). For every unused binding ty finds, it publishes a diagnostic. Oversimplified, the payload looks like this:
        </p>

        <pre><code className="language-json">{`{
  "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 1 } },
  "severity": 4,
  "source": "ty",
  "message": "\`a\` is unused",
  "tags": [1]
}`}</code></pre>

        <p>
          <code>tags: [1]</code> is <code>DiagnosticTag.Unnecessary</code>, and <code>severity: 4</code> is a hint, the quietest level the protocol has. The range covers just the binding, so the editor can act on <code>a</code> without touching the rest of the line. The tag is advisory, so each editor decides how to render it. VS Code normally dims the tagged range, with the exact appearance controlled by the active theme.
        </p>

        <h2>Python binds names in more places than =</h2>

        <p>
          My first version walked the file's AST in source order. Whenever it reached syntax that could introduce a local name, it looked that name up in ty's semantic model and asked whether the symbol was used in its scope. It worked on the examples I'd written.
        </p>

        <p>
          Finding those candidates means knowing what counts as a binding in the first place, and Python has more answers than <code>=</code>:
        </p>

        <pre><code className="language-python">{`def scale(factor): ...            # parameters bind

for row in rows: ...              # so do for targets

squares = [n * n for n in rows]   # n, in the comprehension's own scope

with open(path) as f: ...         # with targets

try: ...
except ValueError as e: ...       # except targets

if (count := len(rows)) > 3: ...  # walrus, mid-expression

match event:
    case {"type": kind}: ...      # match patterns capture names`}</code></pre>

        <p>
          Each of those needed its own branch in my visitor. Somewhere around the match patterns it stopped feeling like a helper and started feeling like a second inventory of Python's binding syntax, and it made me uneasy before I'd even shipped it. The visitor still leaned on ty for scope and usage. Finding every definition worth checking was the duplicated part.
        </p>

        <p>
          The merged version filters ty's existing definition kinds instead. It currently considers eleven forms for the hint, while leaving imports, functions, and classes out.
        </p>

        <p>
          Not every definition creates a runtime binding. A bare annotation like <code>x: int</code> only declares a type, so ty dims it <a href="https://github.com/astral-sh/ruff/pull/24811" target="_blank" rel="noopener noreferrer">only when the name is neither bound nor read elsewhere in the scope</a>.
        </p>

        <h2>The semantic index already had the data</h2>

        <p>
          <span className="github-mention">@carljm</span> suggested recording usage where ty already builds its use-to-definition links. As ty analyzes a file, its use-def map records the live definitions each read can resolve to, more than one when control flow splits. That's the data "is this used" needs, at a finer grain than I was asking. My visitor asked whether a symbol was used somewhere in its scope. The map knows which definitions each read can reach. So I added usage state alongside the definitions. Whenever ty records what a read resolves to, those definitions get marked as used, and the feature just iterates over whatever is left unmarked. The extra AST traversal disappeared, and unused-binding detection now derives from the same use-def data type inference consumes.
        </p>

        <h2>A read can cross several scopes</h2>

        <p>
          A name can be read outside the scope that binds it. Closures are the simplest case.
        </p>

        <pre><code className="language-python">{`def outer():
    x = 1

    def inner():
        return x

    return inner`}</code></pre>

        <p>
          <code>x</code> is used even though the read sits inside <code>inner</code>. The read resolves to <code>outer</code>'s binding, so ty has to connect reads in nested scopes to the definitions they capture.
        </p>

        <p>
          <code>nonlocal</code> is a forwarding declaration. It tells Python that <code>x</code> in <code>mid</code> doesn't get a local binding, assignments there reach into an enclosing function.
        </p>

        <pre><code className="language-python">{`def outer():
    x = 1

    def mid():
        nonlocal x
        x = 2

        def inner():
            return x

        return inner

    return mid`}</code></pre>

        <p>
          <code>nonlocal x</code> creates no binding in <code>mid</code>, so both the <code>x = 2</code> assignment and the read inside <code>inner</code> resolve to the binding <code>outer</code> owns.
        </p>

        <p>
          Comprehensions add one more scope, and a comprehension can sit inside a function that sits inside another function.
        </p>

        <pre><code className="language-python">{`def outer(i: int):
    def inner():
        return [[k for k in range(i)] for _ in range(2)]

    return inner`}</code></pre>

        <p>
          The read of <code>i</code> lives in the comprehension's own scope, two boundaries from the parameter in <code>outer</code>. ty walks it through both before the parameter counts as used.
        </p>

        <p>
          The owning scope isn't always known at the moment of the read.
        </p>

        <pre><code className="language-python">{`def outer():
    x = 0

    def middle():
        def inner():
            return x

        x = 1
        return inner

    return middle`}</code></pre>

        <p>
          Python determines a function's local names from its whole body. The later <code>x = 1</code> makes <code>x</code> local to <code>middle</code>, so <code>inner</code> captures <code>middle</code>'s <code>x</code> and <code>outer</code>'s <code>x = 0</code> really is unused.
        </p>

        <p>
          So ty resolves captures late. As each scope completes, unresolved reads propagate to the parent, and the first completed scope that owns the name claims them and marks its binding as used.
        </p>

        <h2>Unused doesn't mean removable</h2>

        <p>
          Some parameters are unused by every rule above, and flagging them would only annoy people. The feature skips the conventional placeholders:
        </p>

        <pre><code className="language-python">{`from typing import overload


@overload
def scale(value: int) -> int: ...    # @overload declaration, parameters skipped


class Worker:
    def handle(self, event):         # self skipped by convention
        ...                          # body left unimplemented, event skipped too

    def poll(self):
        _ = self.checkpoint()        # underscore-prefixed names are never flagged`}</code></pre>

        <p>
          In stub files every body is a placeholder, so parameters there are never flagged.
        </p>

        <p>
          An override can leave a parameter unread and still need it to stay compatible with the base method's signature.
        </p>

        <pre><code className="language-python">{`class Base:
    def handle(self, event):
        print(event)


class Child(Base):
    def handle(self, event):   # event is dimmed here
        return 0`}</code></pre>

        <p>
          <code>event</code> has no read inside <code>Child.handle</code>, so ty dims it. Deleting it would break the override. I initially suppressed unused parameters in methods that override a base-class signature. <span className="github-mention">@carljm</span> pointed out it only covered one direction. A base method can leave a parameter unused while an override depends on it. Covering both directions would require knowing whether subclasses may override the method, or limiting the suppression to final methods and classes. The suppression came out, and ty now dims override parameters knowingly. Pylance makes the same call. As <span className="github-mention">@MichaReiser</span> put it, a false positive here does little harm. The hint says no read resolves to this binding. Whether the binding can go is a different question, and the hint doesn't answer it.
        </p>

        <h2>Where the analysis stops</h2>

        <p>
          The feature reports bindings in function scopes, lambdas, and comprehensions, and stops there. A module-level name can be imported by another file, re-exported, or read as an attribute, and a class attribute can be reached from anywhere in the codebase. No single file shows all of its readers.
        </p>

        <p>
          Supporting module and class bindings requires project-wide reference analysis, so the first version leaves them alone.
        </p>

        <h2>Related changes</h2>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GoGitMerge size={16} style={{ color: '#8250df', flexShrink: 0 }} aria-hidden="true" />
            <a href="https://github.com/astral-sh/ruff/pull/23305" target="_blank" rel="noopener noreferrer">Initial unused-binding diagnostics <span style={{ color: 'var(--text-secondary)' }}>#23305</span></a>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GoGitMerge size={16} style={{ color: '#8250df', flexShrink: 0 }} aria-hidden="true" />
            <a href="https://github.com/astral-sh/ruff/pull/24811" target="_blank" rel="noopener noreferrer">Annotation-only declarations <span style={{ color: 'var(--text-secondary)' }}>#24811</span></a>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GoGitMerge size={16} style={{ color: '#8250df', flexShrink: 0 }} aria-hidden="true" />
            <a href="https://github.com/astral-sh/ruff/pull/25536" target="_blank" rel="noopener noreferrer">Captures across nested scopes <span style={{ color: 'var(--text-secondary)' }}>#25536</span></a>
          </li>
        </ul>

        <footer className="article-footer" style={{ marginTop: '3rem', padding: '1.5rem 0', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={like}
            className={`like-button ${hasLiked ? 'liked' : ''}`}
            disabled={hasLiked}
            aria-label="Like this post"
          >
            <FiHeart className="heart-icon" style={{ fill: hasLiked ? 'var(--accent-color)' : 'transparent', stroke: hasLiked ? 'var(--accent-color)' : 'currentColor' }} />
          </button>
        </footer>
      </article>
    </div>
  );
};

export default UnusedVariable;
