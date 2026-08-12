import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiHeart } from 'react-icons/fi';
import { GoGitMerge } from 'react-icons/go';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import { usePostStats } from '../../hooks/usePostStats';

const UnusedVariable = () => {
  const { hasLiked, like } = usePostStats('how-a-python-type-checker-decides-a-variable-is-unused');

  useEffect(() => {
    Prism.highlightAll();
  }, []);

  return (
    <div className="blog-post-container">
      <Link to="/writing" className="back-link">← back to all posts</Link>

      <article className="article-content">
        <header className="article-header">
          <h1 className="article-title">How a Python type checker decides a variable is unused</h1>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <span className="post-tag">Python</span>
              <span className="post-tag">LSP</span>
              <span className="post-tag">ty</span>
            </div>
            <div className="article-meta">
              <span>12/08/2026</span>
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
          <code>x = 1</code> is unused only if no read of <code>x</code> resolves to that assignment. In Python, that read may sit inside a nested function or comprehension. A later assignment can also determine which <code>x</code> the read refers to.
        </p>

        <p>
          I ran into these cases while adding <a href="https://github.com/astral-sh/ruff/pull/23305" target="_blank" rel="noopener noreferrer">unused-variable dimming</a> to <a href="https://github.com/astral-sh/ty" target="_blank" rel="noopener noreferrer">ty</a>, Astral's Python type checker written in Rust.
        </p>

        <p>
          When ty finds a local binding with no reads, its language server tells the editor to dim its name. Here, a binding is one place where a name receives a value. Assignments, parameters, and loop variables all create bindings.
        </p>


        <h2>How ty tells the editor what to dim</h2>

        <p>
          With the ty extension installed, the editor and ty talk over the Language Server Protocol (LSP). For every unused binding ty finds, it publishes a diagnostic. Oversimplified, the payload looks like this:
        </p>

        <pre><code className="language-json">{`{
  "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 1 } },
  "severity": 4,
  "source": "ty",
  "message": "\`x\` is unused",
  "tags": [1]
}`}</code></pre>

        <p>
          <code>tags: [1]</code> is <code>DiagnosticTag.Unnecessary</code>, and <code>severity: 4</code> is a hint, the quietest level the protocol has. The range covers just the binding, so the editor can act on <code>x</code> without touching the rest of the line. The tag is advisory, so each editor decides how to render it. VS Code normally dims the tagged range, with the exact appearance controlled by the active theme.
        </p>

        <h2>Python binds names in more places than =</h2>

        <p>
          My first version walked the file's abstract syntax tree (AST), ty's structured representation of the parsed Python code, in source order. Whenever it reached syntax that could introduce a local name, it looked that name up in ty's semantic model and asked whether the symbol was used in its scope. It worked on the examples I'd written.
        </p>

        <p>
          Finding those candidates means knowing what counts as a binding in the first place, and Python has more answers than <code>=</code>:
        </p>

        <pre><code className="language-python">{`def scale(factor): ...            # parameters bind

for row in rows: ...              # so do loop variables

squares = [n * n for n in rows]   # n, in the comprehension's own scope

with open(path) as f: ...         # as f binds f

try: ...
except ValueError as e: ...       # as e binds e

if (count := len(rows)) > 3: ...  # walrus, mid-expression

match event:
    case {"type": kind}: ...      # match patterns capture names`}</code></pre>

        <p>
          Each of those needed its own branch in my visitor. Somewhere around the match patterns it stopped feeling like a helper and started feeling like a second inventory of Python's binding syntax, and it made me uneasy before I'd even shipped it. The visitor still leaned on ty for scope and usage. Finding every definition worth checking was the duplicated part.
        </p>

        <p>
          The merged version iterates over definitions ty has already recorded and filters them by kind, instead of walking the AST again to find every possible binding. Imports, functions, and classes are left out.
        </p>

        <p>
          Not every definition creates a runtime binding. A bare annotation like <code>x: int</code> only declares a type, so ty dims it <a href="https://github.com/astral-sh/ruff/pull/24811" target="_blank" rel="noopener noreferrer">only when the name is neither bound nor read elsewhere in the scope</a>.
        </p>

        <h2>The semantic index already had the data</h2>

        <p>
          <span className="github-mention">@carljm</span> suggested recording usage where ty already builds its use-to-definition map. For each read, that map already knows which definitions can provide its value.
        </p>

        <pre><code className="language-python">{`x = 1
print(x)`}</code></pre>

        <p>
          Here the read of <code>x</code> resolves to the definition <code>x = 1</code>. If different control-flow paths assigned <code>x</code>, the read could resolve to several definitions. That's the data "is this used" needs, at a finer grain than I was asking. My visitor asked whether a symbol was used somewhere in its scope. The map answers per definition.
        </p>

        <p>
          I added a parallel boolean table* indexed by ty's existing definition IDs. Every entry starts as <code>false</code>. When use-def records a read, each definition that can provide the value gets marked as used.
        </p>

        <p>
          The unused-binding collector now starts from the definitions use-def never marked and filters by scope and definition kind. It no longer decides for itself whether a definition has a read. The separate AST traversal went away, and the result derives from the same name-resolution data type inference consumes.
        </p>

        <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
          * Three months later, Charlie Marsh <a href="https://github.com/astral-sh/ruff/pull/26019" target="_blank" rel="noopener noreferrer">moved usage into the retained definition state</a>. A compile-time assertion keeps the combined enum the same size as the old one, and the retained map dropped one allocation and one byte per definition.
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
          When ty encounters <code>x</code> inside <code>inner</code>, it has to determine which <code>x</code> that name refers to. Here it refers to <code>x = 1</code> in <code>outer</code>, so ty has to mark that outer binding as used.
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
          <code>global</code> sends assignments to the module scope instead of creating a local binding. Because this feature reports only local bindings, ty leaves those assignments alone.
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
          <code>event</code> has no read inside <code>Child.handle</code>, so ty dims it. Deleting it would break the override. I initially suppressed unused parameters in methods that override a base-class signature. <span className="github-mention">@carljm</span> pointed out it only covered one direction. A base method can leave a parameter unused while an override depends on it. Covering both directions would require knowing whether subclasses may override the method, or limiting the suppression to final methods and classes. I removed the suppression, so ty now dims an override parameter when the method body never reads it. Pylance does the same. As <span className="github-mention">@MichaReiser</span> put it, a false positive here does little harm. The hint says no read resolves to this binding. Whether the binding can go is a different question, and the hint doesn't answer it.
        </p>

        <h2>Where the analysis stops</h2>

        <p>
          The feature reports bindings inside functions, lambdas, and comprehensions. Their reads occur in the same scope or in nested scopes that capture them, all of which ty can inspect while analyzing the file.
        </p>

        <p>
          Module and class names are harder to classify. Another file can import or re-export a module-level name, while class attributes can be accessed elsewhere through attribute lookup.
        </p>

        <p>
          Extending the hint to those bindings would require project-wide reference analysis. That meant more implementation work and a higher risk of false positives, so I kept the first version local.
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
