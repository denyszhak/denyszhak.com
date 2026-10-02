import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiHeart } from 'react-icons/fi';
import { GoGitMerge } from 'react-icons/go';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
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
              <span>12 Aug 2026</span>
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

        <p><code>x = 1</code> is unused only if no read of <code>x</code> resolves to that assignment. In Python, that read may sit inside a nested function or comprehension. A later assignment can also determine which <code>x</code> the read refers to.</p>

        <p>I ran into these cases while adding <a href="https://github.com/astral-sh/ruff/pull/23305" target="_blank" rel="noopener noreferrer">unused-variable dimming</a> to <a href="https://github.com/astral-sh/ty" target="_blank" rel="noopener noreferrer">ty</a>, Astral's Python type checker written in Rust.</p>

        <p>The way it works is that ty finds local bindings nobody reads, and its language server tells the editor to dim them. By binding I mean any place where a name gets a value, so not only assignments but also parameters and loop variables.</p>

        <figure className="article-demo"><img src="/unused-variable.png" alt="VS Code showing an unused welcome_message binding dimmed by ty" width="356" height="149" /></figure>

        <h2>How ty tells the editor what to dim</h2>

        <p>When you have the ty extension installed, the editor and ty talk to each other over the Language Server Protocol (LSP), and ty sends a diagnostic for every unused binding it finds. A simplified version of the payload looks like this:</p>

        <pre><code className="language-javascript">{"{\n  \"message\": \"`x` is unused\",\n  \"range\": {\n    \"end\": { \"character\": 5, \"line\": 1 },\n    \"start\": { \"character\": 4, \"line\": 1 }\n  },\n  \"severity\": DiagnosticSeverity.Hint,\n  \"source\": \"ty\",\n  \"tags\": [DiagnosticTag.Unnecessary]\n}"}</code></pre>

        <p><code>DiagnosticTag.Unnecessary</code> and <code>DiagnosticSeverity.Hint</code> give the quietest level the protocol has. The range covers only the binding (<code>x</code>), not the whole line. Every editor decides how to dim it, though some let you configure it. In VS Code it's normally dimmed.</p>

        <h2>Binding is not only about <code>=</code></h2>

        <p>My first implementation walked the file's abstract syntax tree (AST), which is how ty represents the parsed Python code, and for every place in the syntax that could create a local name, it looked in ty's semantic model to check if it was used. It worked fine on tens of examples I came up with.</p>

        <p>The problem was finding all the possible candidates. For that, you need to know what counts as a binding, and in Python it's not just <code>=</code>:</p>

        <pre><code className="language-python">{"# parameters\ndef func(x): ...\n\n# variable in loop or comprehensions\nfor item in items: ...\n\nnodes = [n * n for n in rows]\n\n# context managers and exception handling\nwith open(path) as f: ...\n\ntry: ...\nexcept ValueError as exc: ...\n\n# walrus\nif (count := len(items)) > 3: ...\n\n# match pattern\nmatch event:\n    case {\"type\": kind}: ..."}</code></pre>

        <p>Each of the cases needed its own treatment, which was a lot of code for something ty mostly knew already.</p>

        <p>Instead, the merged version goes over the definitions ty already knows about and filters them by kind.</p>

        <p>Annotations, like <code>x: int</code>, only declare a type, so you can only tell they're unused if <a href="https://github.com/astral-sh/ruff/pull/24811" target="_blank" rel="noopener noreferrer">no one reads them in the scope at all</a>.</p>

        <h2>Tracking which bindings are read</h2>

        <p>@carljm suggested recording usage in the place where ty already builds its definition usage map. Most of what I needed was already there.</p>

        <pre><code className="language-python">{"def f(flag):\n    x = 1  # dimmed\n    x = 2\n\n    if flag:\n        y = 1\n    else:\n        y = 2\n\n    print(x, y)"}</code></pre>

        <p>Technically, no one read <code>x</code> while it was <code>1</code>. The <code>print</code> only sees its value of <code>2</code>, so <code>x = 1</code> is marked unused. With conditional branches, like with <code>y</code>, both are used because you can't prove otherwise.</p>

        <p>The simplest option was to track usage in a separate boolean table next to the map of definitions.</p>

        <pre><code className="language-rust">{"struct UseDefMapBuilder<'db> {\n    all_definitions: IndexVec<ScopedDefinitionId, DefinitionState<'db>>,\n    used_bindings: IndexVec<ScopedDefinitionId, bool>,\n}\n\nimpl<'db> UseDefMapBuilder<'db> {\n    fn record_read(&mut self, bindings: &Bindings) {\n        for binding in bindings.iter() {\n            let id = binding.binding;\n\n            if !id.is_unbound() {\n                self.used_bindings[id] = true;\n            }\n        }\n    }\n}"}</code></pre>

        <p>Now the separate <code>unused_bindings</code> query used for dimming no longer figures out usage itself but relies on stored earlier results.</p>

        <h2>How do you actually find the binding?</h2>

        <p>You can read a variable from a different scope compared to where it's bound. Here's an example with a closure:</p>

        <pre><code className="language-python">{"def outer():\n    x = 1\n\n    def inner():\n        return x\n\n    return inner"}</code></pre>

        <p>When ty sees <code>x</code> inside <code>inner</code>, it has to figure out which <code>x</code> it is. In this case it's the <code>x = 1</code> from <code>outer</code>, so that binding in <code>outer</code> gets marked as used.</p>

        <p>With <code>nonlocal</code> it's a bit different. It tells Python that <code>x</code> in <code>mid</code> is not a new local variable, so assignments there go to <code>outer</code>'s <code>x</code>.</p>

        <pre><code className="language-python">{"def outer():\n    x = 1\n\n    def mid():\n        nonlocal x\n        x = 2\n\n        def inner():\n            return x\n\n        return inner\n\n    return mid"}</code></pre>

        <p>So <code>mid</code> has no <code>x</code> of its own. <code>x = 2</code> is still a binding, but it belongs to <code>outer</code>, and the read inside <code>inner</code> refers to that same variable.</p>

        <p><code>global</code> works in a similar way but sends assignments to the module scope, and since this feature only looks at local bindings, ty doesn't report those.</p>

        <p>Comprehensions have their own scope, and they can be inside a function that is itself inside another function.</p>

        <pre><code className="language-python">{"def outer(i: int):\n    def inner():\n        return [[n for n in range(i)] for _ in range(2)]\n\n    return inner"}</code></pre>

        <p>Here <code>i</code> is read inside the comprehension, which is two scopes away from the parameter in <code>outer</code>, so ty has to go through both before the parameter counts as used.</p>

        <p>ty reaches <code>return x</code> before it has finished processing <code>middle</code>:</p>

        <pre><code className="language-python">{"def outer():\n    x = 0\n\n    def middle():\n        def inner():\n            return x\n\n        x = 1\n        return inner\n\n    return middle"}</code></pre>

        <p>Further down, <code>x = 1</code> makes <code>x</code> local to <code>middle</code>. Once ty has seen all of <code>middle</code>, it can connect <code>inner</code>'s read to <code>x = 1</code>. Nothing reads <code>outer</code>'s <code>x = 0</code>.</p>

        <p>At the end of each scope, ty checks the reads it couldn't resolve earlier. If the name is local, it marks the binding as used. Otherwise, it passes the read to the parent.</p>

        <h2>Unused doesn't mean removable</h2>

        <p>Some parameters are unused by all the rules above, but flagging them would just annoy people, so the feature skips the usual placeholders:</p>

        <pre><code className="language-python">{"from typing import overload\n\n@overload\ndef func(val: int) -> int: ...  # overload, parameters not reported\n\nclass Worker:\n    def handle(self, event):       # self not reported\n        ...                        # body is just ..., so event not reported\n\n    def poll(self):\n        _ = self.checkpoint()      # names starting with _ not reported"}</code></pre>

        <p>In stub files every body is a placeholder anyway, so parameters there are never flagged.</p>

        <p>An override may need a parameter to match the base method's signature, even if it never reads it:</p>

        <pre><code className="language-python">{"class Base:\n    def handle(self, event):\n        print(event)\n\n\nclass Child(Base):\n    def handle(self, event):   # event is dimmed here\n        return 0"}</code></pre>

        <p>ty dims <code>event</code> in <code>Child.handle</code> because it's unread. Removing it would break the override, though. Somewhere in the middle of iterating on feedback, I suppressed unused parameters in methods that override a base-class method, but @carljm suggested that this only works in one direction: a base method can have a parameter unused while the method overriding it needs it. To make it fully correct, you have to figure out if subclasses override the method, or limit the implementation to final methods and classes.</p>

        <p>In the end I removed the suppression, so ty now dims an override parameter when the method body never reads it, which is also what Pylance does. As @MichaReiser put it, a false positive here doesn't do much harm. The hint only says that no read resolves to this binding, whether you can remove it is a different question.</p>

        <h2>Why it stops at functions</h2>

        <p>The initial version of the feature reported unused bindings only inside functions, lambdas and comprehensions. A read of a function's variable can't suddenly happen from the scope enclosing it, only from its own scope or a nested one.</p>

        <p>Taking the behaviour to the module scope makes it more challenging to agree on false positives and false negatives. Another file can import or re-export a module level attribute. Even a class scope can be accessed from outside.</p>

        <p>You can handle that too, but you'll need to support analysis across files. On top of the complexity it adds to the feature, it can also affect non-functional requirements, like increased memory usage and degraded performance, which may not be worth it for a dimming feature.</p>

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
