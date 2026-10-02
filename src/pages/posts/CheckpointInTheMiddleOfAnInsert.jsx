import { Link } from 'react-router-dom';
import { FiHeart } from 'react-icons/fi';
import { GoGitMerge } from 'react-icons/go';
import Prism from 'prismjs';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import { usePostStats } from '../../hooks/usePostStats';

const CheckpointInTheMiddleOfAnInsert = () => {
  const { hasLiked, like } = usePostStats('a-checkpoint-in-the-middle-of-an-insert');

  return (
    <div className="blog-post-container">
      <Link to="/writing" className="back-link">← back to all posts</Link>

      <article className="article-content" style={{ overflowWrap: 'anywhere' }}>
        <header className="article-header">
          <h1 className="article-title">A Checkpoint in the Middle of an INSERT</h1>
          <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>How a checkpoint invalidated an unfinished INSERT’s cursor in Turso.</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <span className="post-tag">Turso</span>
              <span className="post-tag">database internals</span>
              <span className="post-tag">Rust</span>
            </div>
            <div className="article-meta">
              <time dateTime="2026-09-12">12 Sep 2026</time>
              <span>•</span>
              <span>6 min read</span>
              <span>•</span>
              <button
                onClick={like}
                className={'like-button ' + (hasLiked ? 'liked' : '')}
                disabled={hasLiked}
                aria-label="Like this post"
              >
                <FiHeart className="heart-icon" style={{ fill: hasLiked ? 'var(--accent-color)' : 'transparent', stroke: hasLiked ? 'var(--accent-color)' : 'currentColor' }} />
              </button>
            </div>
          </div>
        </header>

        <p>
          I recently helped fix an <a href="https://github.com/tursodatabase/turso/issues/8025" target="_blank" rel="noopener noreferrer">issue</a> in Turso, an in-process, SQLite-compatible database written in Rust. An INSERT could panic after a checkpoint ran on the same connection.
        </p>

        <p>
          In <a href="https://sqlite.org/wal.html#how_wal_works" target="_blank" rel="noopener noreferrer">write-ahead log (WAL) mode</a>, SQLite records changed database pages in a separate log. A checkpoint later copies committed page versions from the log into the main database file.
        </p>

        <p>
          It has nothing to do with multithreading. When the INSERT query paused when doing I/O, the client could run a checkpoint, and the INSERT would panic when it resumed. The checkpoint had cleared the state the unfinished INSERT still needed.
        </p>

        <pre><code className="language-text">{"INSERT starts → pauses for I/O\n                  ↓\n           checkpoint runs\n                  ↓\nINSERT resumes → saved position is gone → panic"}</code></pre>

        <h2>Pausing a statement</h2>

        <p>
          To manage INSERT's state, Turso keeps track of where it stopped and preserves the state it needs to continue. The behaviour is correct if you run sequential <code>execute()</code> calls because nothing slips through in between. However, when using <code>prepare()</code> and <code>step()</code> the caller regains control when <code>step()</code> returns <code>StepResult::IO</code>, which in Turso's lower-level API means the statement is waiting for IO. In the meantime, nothing prevents you from running another operation.
        </p>

        <p>
          With some setup and I/O handling omitted, the reproducer looks like this:
        </p>

        <pre><code className="language-rust" dangerouslySetInnerHTML={{ __html: Prism.highlight("let mut insert = conn.prepare(\"INSERT INTO t VALUES (100, zeroblob(50000))\")?;\nif matches!(insert.step()?, StepResult::IO) {\n    let _ = conn.prepare(\"PRAGMA wal_checkpoint(PASSIVE)\")?.run_collect_rows();\n    insert.run_collect_rows()?; // Resume the INSERT.\n}", Prism.languages.rust, "rust") }} /></pre>

        <p>
          Here, <code>run_collect_rows()</code> runs a statement until it finishes.
        </p>

        <h2>Why did the checkpoint affect the INSERT?</h2>

        <p>
          The connection also caches pages in memory.
        </p>

        <p>
          Turso uses an internal B-tree cursor to remember its current page, its position within that page, and the path it followed to get there. That path holds references to cached pages.
        </p>

        <p>
          The pager loads and caches database pages and keeps track of cursors. Explicit checkpoints finish with these steps, shown here in simplified form:
        </p>

        <pre><code className="language-rust" dangerouslySetInnerHTML={{ __html: Prism.highlight("self.invalidate_all_cursors();\nself.page_cache.write().clear(false)?;", Prism.languages.rust, "rust") }} /></pre>

        <p>
          The first call cleared the INSERT's saved path and set <code>current_page</code> to <code>-1</code>. Its stored write phase remained unchanged. On the next <code>step()</code>, the INSERT continued that write and tried to access its current page:
        </p>

        <pre><code className="language-rust" dangerouslySetInnerHTML={{ __html: Prism.highlight("fn current(&self) -> usize {\n    turso_assert_greater_than_or_equal!(self.current_page, 0);\n    self.current_page as usize\n}", Prism.languages.rust, "rust") }} /></pre>

        <p>
          With <code>current_page</code> now <code>-1</code>, the assertion failed.
        </p>

        <p>
          The fix rejects an explicit checkpoint while another statement has started executing but hasn't finished, before the checkpoint can invalidate that statement's cursor.
        </p>

        <h2>Why reject the overlap?</h2>

        <p>
          Automatic checkpoints ran as part of Turso's commit process. They use PASSIVE mode and skip cursor invalidation and whole cache clearing. An explicit PASSIVE could skip cursor invalidation and cache clearing too, but that alone wouldn't make the overlap safe.
        </p>

        <p>
          The fix didn't change how and when Turso cleaned up its cached pages and query cursors, it prevented explicit checkpoints from overlapping unfinished statements.
        </p>

        <p>
          Statements on one Turso connection share a pager and its transaction state. Before adding a row, an INSERT reads the existing database pages. It may stop to wait for I/O, but it still needs those pages and its read transaction. In the affected version, a checkpoint on the same connection could clear state the INSERT was still using. The INSERT would then resume and try to use it.
        </p>

        <p>
          Two explicit checkpoint modes also affect that transaction:
        </p>

        <pre><code className="language-sql" dangerouslySetInnerHTML={{ __html: Prism.highlight("PRAGMA wal_checkpoint(RESTART);\nPRAGMA wal_checkpoint(TRUNCATE);", Prism.languages.sql, "sql") }} /></pre>

        <p>
          RESTART makes the WAL reusable from its beginning. TRUNCATE also shrinks the WAL file to zero bytes after its committed changes have been copied into the database file.
        </p>

        <p>
          Before resetting the WAL, a RESTART or TRUNCATE checkpoint ends the connection's read transaction to release its read lock, but a paused INSERT still needs that transaction to finish. Therefore, at the start of a new checkpoint, Turso checks for unfinished statements on the same connection and rejects the initiated operation if it finds one.
        </p>

        <p>
          If overlap were allowed, that could end the read transaction used by the paused INSERT.
        </p>

        <p>
          To allow the overlap, you can't drop the INSERT's pages. You have to keep its read transaction active, avoid releasing locks the INSERT requires, and test every point where the INSERT can pause for I/O. I'm not sure it's worth it.
        </p>

        <p>
          SQLite's <a href="https://github.com/sqlite/sqlite/blob/701092f4a5e8320460219dab733f31dc7a723629/src/btree.c#L11378" target="_blank" rel="noopener noreferrer"><code>sqlite3BtreeCheckpoint()</code></a> returns <code>SQLITE_LOCKED</code> when the relevant B-tree has an open read or write transaction.
        </p>

        <p>
          Checkpointing on another connection is still possible. You can still run a checkpoint on another connection. It has its own pager, so the INSERT keeps its cursor and read transaction.
        </p>

        <h2>Keeping protection across the pause</h2>

        <p>
          Turso already prevented overlap between two write statements, but <code>PRAGMA wal_checkpoint</code> did not fall under the write category. Also, classifying it as a write still wouldn't achieve correct behaviour because it would allow overlap with a paused SELECT.
        </p>

        <p>
          Rejecting checkpoints while another statement is unfinished handles the INSERT starting first. Now reverse the order:
        </p>

        <pre><code className="language-text">{"Checkpoint checks for active statements → none\nCheckpoint starts                      → pauses for I/O\nINSERT attempts to start               → the earlier check cannot stop it"}</code></pre>

        <p>
          A flag marks the checkpoint as active and prevents new statements from starting until it ends.
        </p>

        <p>
          Both startup checks use the same mutex. Their logic, in pseudocode, is:
        </p>

        <pre><code className="language-text">{"start_statement:\n    with activity locked:\n        if checkpoint_active:\n            reject\n        register this statement as active\n\nstart_checkpoint:\n    with activity locked:\n        if checkpoint_active or another_statement_is_active:\n            reject\n        checkpoint_active = true"}</code></pre>

        <p>
          Checking and updating happen under the same lock. A new statement cannot start between the checkpoint checking for other active statements and setting its flag.
        </p>

        <p>
          The mutex is then released, but the flag stays set during I/O.
        </p>

        <p>
          An <code>ExplicitCheckpointGuard</code> keeps references to the shared flag and the pager while the checkpoint is paused:
        </p>

        <pre><code className="language-rust" dangerouslySetInnerHTML={{ __html: Prism.highlight("pub(crate) struct StatementActivity {\n    explicit_checkpoint_active: bool,\n}\n\npub(crate) struct ExplicitCheckpointGuard {\n    activity: Arc<Mutex<StatementActivity>>,\n    pager: Arc<Pager>,\n}", Prism.languages.rust, "rust") }} /></pre>

        <p>
          For a SQL checkpoint, this guard is stored in the statement's <a href="https://github.com/tursodatabase/turso/blob/135db0aa2222fae809e0ba7c2f7d3a238ba639cd/core/vdbe/mod.rs#L799" target="_blank" rel="noopener noreferrer">execution state</a>, so it survives I/O pauses.
        </p>

        <p>
          When the checkpoint finishes, fails, or its statement is reset or dropped, the guard is dropped and runs this cleanup (internal assertion omitted):
        </p>

        <pre><code className="language-rust" dangerouslySetInnerHTML={{ __html: Prism.highlight("impl Drop for ExplicitCheckpointGuard {\n    fn drop(&mut self) {\n        if self.pager.is_checkpointing() {\n            self.pager.cleanup_after_checkpoint_failure();\n        }\n        let mut activity = self.activity.lock();\n        activity.explicit_checkpoint_active = false;\n    }\n}", Prism.languages.rust, "rust") }} /></pre>

        <p>
          Cleanup happens before the flag is cleared. Another statement cannot start while unfinished checkpoint work is still being cleaned up, even if the paused checkpoint never resumes.
        </p>

        <p>
          In the original reproducer, the checkpoint now returns <code>StatementsInProgress</code>. The INSERT now finishes without panicking, and the integrity check passes. Returning for I/O doesn’t mean the operation is finished.
        </p>

        <h2>Related changes</h2>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GoGitMerge size={16} style={{ color: '#8250df', flexShrink: 0 }} aria-hidden="true" />
            <a href="https://github.com/tursodatabase/turso/pull/8032" target="_blank" rel="noopener noreferrer">Prevent explicit checkpoints and root statements on the same connection <span style={{ color: 'var(--text-secondary)' }}>#8032</span></a>
          </li>
        </ul>

        <footer className="article-footer" style={{ marginTop: '3rem', padding: '1.5rem 0', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={like}
            className={'like-button ' + (hasLiked ? 'liked' : '')}
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

export default CheckpointInTheMiddleOfAnInsert;
