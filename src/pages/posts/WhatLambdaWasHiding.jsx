import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiHeart } from 'react-icons/fi';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import { usePostStats } from '../../hooks/usePostStats';
import SubscribeForm from '../../components/SubscribeForm';

const WhatLambdaWasHiding = () => {
  const { hasLiked, like } = usePostStats('what-lambda-was-hiding');

  useEffect(() => {
    Prism.highlightAll();
  }, []);

  return (
    <div className="blog-post-container">
      <Link to="/writing" className="back-link">← back to all posts</Link>
      
      <article className="article-content">
        <header className="article-header">
          <h1 className="article-title">What Lambda was hiding</h1>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <span className="post-tag">distributed systems</span>
              <span className="post-tag">serverless</span>
            </div>
            <div className="article-meta">
              <span>18/06/2026</span>
              <span>•</span>
              <span>15 min read</span>
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
          A class of bugs or design considerations exists only in long-running processes. AWS Lambda's isolated, frequently recycled execution environments had been limiting how long they could accumulate. The migration to long-running containers exposed bugs that had been latent in the same code for years.
        </p>
        <p>
          This is about a migration: Python Lambdas to long-running services. These weren't small handlers – each was a small application. The migration itself was not unusual. What was interesting was the set of bugs Lambda had been absorbing for us – some we caught before rollout, and some production caught for us.
        </p>
        <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
          If you're here for the technical content and not the migration context, <a href="#cases">skip to the cases</a>.
        </p>

        <h2>Why the migration</h2>
        <p>
          The Lambdas were the platform's ingestion path for external time-series data. The decision to migrate had nothing to do with the runtime semantics – three operational pressures pushed for it:
        </p>
        <ul>
          <li>Multi-environment support. Compared to our established Kubernetes platform serving the rest of the cloud, maintaining environment parity across Lambda deployments wasn't manageable.</li>
          <li>Global scaling. Scaling Lambda functions across regions required separate deployment pipelines per region, each with its own configuration and monitoring.</li>
          <li>Cognitive load. Seven Lambdas and a slow buildup of glue code had made the system harder to reason about than the work it was doing.</li>
        </ul>
        <p>
          None of these reasons relate to the bug class this article is about.
        </p>

        <h2>The old architecture, briefly</h2>
        <p>
          The Lambdas ingested external timeseries data and synced it to different target databases, with the entire pipeline written in Python.
        </p>
        <p>
          Each sync Lambda did the same two things: extract and transform data into a shape suitable for its target database(s), then write it. The extraction logic was shared across the four sync paths and lived in a common library – but each Lambda still ran it independently as part of its invocation. The full pipeline included three additional Lambdas that performed slightly different extractions for adjacent purposes.
        </p>
        <p>
          Seven Lambdas total. Four sync paths repeating the same extraction work, plus three more doing variations of it.
        </p>

        <h2>The new architecture</h2>
        <p>
          The new architecture had one deployable unit responsible for extraction and normalization, and a set of consumers each responsible for one or more target databases. Consumers would receive events over a shared contract, fetch the normalized payload from S3, and write it to their respective stores.
        </p>
        <p>
          The extraction service was rewritten in Go. Two reasons: we wanted static typing on the critical path – this service is the producer every consumer depends on – and the team already ran Go across the rest of the platform, so it was a known quantity to build and operate.
        </p>
        <p>
          The Go service was designed for the runtime it runs in. None of the cases that follow surfaced there.
        </p>
        <p>
          The downstream consumers stayed in Python. Their pandas and broader Python ecosystem dependencies would have made a simultaneous language migration too risky. Scope was kept to one language change at a time.
        </p>

        <h2 id="cases">The eight cases</h2>
        <p>
          Some of the cases were anticipated before the migration, some surfaced during testing or in production. The rollout used a custom canary configuration: test and anonymous traffic first, then a small set of real customers, then wider. The migration had one hard constraint: new-service output had to match the Lambda's exactly, on the same input. The data layouts are complex enough that even small code changes can produce subtle differences customers would notice – so we deliberately kept changes minimal. Anticipated fixes that risked behavioral drift were held until the canary could confirm them against real traffic.
        </p>

        <h3>1. <code>/tmp</code> collisions and a duplicate-delivery discovery</h3>
        <p>
          On Lambda, concurrent invocations run in separate execution environments, each with its own <code>/tmp</code>. Two deliveries in flight at once never share a filesystem, so writing intermediate files to <code>/tmp</code> is safe from collisions by construction. In the new service, all in-flight deliveries share one process and one <code>/tmp</code> – two deliveries with the same filename collide.
        </p>
        <p>
          Anticipated before the migration. The question wasn't whether to fix it but how. We had two options for naming the intermediate files: generate a fresh UUID per event at the consumer, or use the delivery UUID from the source upstream. The time-series processing is idempotent at the database insertion level, so either approach would have worked for collision avoidance.
        </p>
        <p>
          I chose the delivery UUID. The reason was a side benefit: if the same delivery arrived twice from upstream, two consumers using a fresh UUID would each write their own intermediate file and proceed independently. Using the delivery UUID caught overlapping duplicates: if the second copy arrived while the first was still in flight, the consumer would try to claim the same path and fail loudly. The fresh-UUID approach would have masked the duplicate.
        </p>
        <p>
          This applies only to the Python consumers. The Go extraction service holds intermediate state in memory and doesn't touch <code>/tmp</code>.
        </p>
        <p>
          After the rollout, the choice paid off. We observed duplicate deliveries arriving from the upstream source – something the Lambda had been silently reprocessing. We added a guardrail at the producer level once we had evidence of the pattern.
        </p>

        <h3>2. SQLAlchemy engine cache growth across requests</h3>
        <p>
          At some point, we noticed premature restarts. The cause was OOM, but not from a spike – memory had grown gradually over hours.
        </p>
        
        <div style={{ margin: '2rem 0', textAlign: 'center' }}>
          <img 
            src="/sqlalchemy-cache-leak.png" 
            alt="SQLAlchemy cache growth diagram" 
            style={{ 
              maxWidth: '100%', 
              height: 'auto', 
              borderRadius: '4px',
              border: '1px solid var(--border-color)'
            }} 
          />
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
            Memory climbing toward the 4 GiB per-pod request, then OOM-killed and restarted. The sawtooth is the cycle repeating. Each line is a separate pod replica.
          </div>
        </div>
        <p>
          The first Lambda migrated had used a SQLAlchemy DB pool created per request. We anticipated this and switched to a persistent pool at service startup. What we didn't anticipate was that another code path implicitly created six DB pools per request, each from a different call site – a misuse of internal library code that Lambda had been concealing. The engine was being disposed correctly, which made the cause non-obvious.
        </p>
        <p>
          Diagnosing the growth was a matter of adding <code>tracemalloc</code> and simulating long-running traffic. The traces pointed back to SQLAlchemy, but indirectly.
        </p>
        <p>
          The accumulator was the SQLAlchemy compiled-statement cache. Each SQLAlchemy engine keeps its own cache of compiled SQL statements, keyed by the statement text. <code>pandas.to_sql()</code> populates that cache aggressively, because pandas generates a different SQL statement every time the column list or chunk size changes – a different column count means a different <code>INSERT INTO ... (cols) VALUES (?, ?, ...)</code>, and each variant gets its own cache entry. With six engines per request instead of one, the problem multiplied: six caches accumulated where there should have been one. The cache lives on the engine itself, not the connection pool, so <code>dispose()</code> released the pool but left the cache attached to the engine. At our request rate, those short-lived engines and their caches added up faster than Python reclaimed them.
        </p>
        <p>
          This is memory bloat, not a memory leak in the strict sense – the cache has a bound. But the bound is high enough that, at our scale, it produces the same observable behavior as a leak. There's <a href="https://github.com/sqlalchemy/sqlalchemy/discussions/6573" target="_blank" rel="noopener noreferrer">a long discussion thread in the SQLAlchemy issue tracker</a> where others have hit the same pattern.
        </p>
        <p>
          For the services that talk to a single database, the fix was to make the engine global and let the cache stabilize at a steady-state size. Memory immediately flattened.
        </p>
        
        <div style={{ margin: '2rem 0', textAlign: 'center' }}>
          <img 
            src="/sqlalchemy-memory-flattened.png" 
            alt="SQLAlchemy memory flattened diagram" 
            style={{ 
              maxWidth: '100%', 
              height: 'auto', 
              borderRadius: '4px',
              border: '1px solid var(--border-color)'
            }} 
          />
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
            Same workload, same pod, after making the SQLAlchemy engine global – memory stabilized.
          </div>
        </div>
        <p>
          This bug mattered much less on Lambda. Concurrent invocations ran in separate execution environments, and each environment handled one invocation at a time; in the service, many deliveries created short-lived engines inside the same long-running process, so their caches accumulated together.
        </p>

        <h3>3. RabbitMQ consumers that don't reconnect</h3>
        <p>
          Lambda doesn't need to consume from RabbitMQ. The services do.
        </p>
        <p>
          The weekend after rollout, the first broker hiccup hit, and the consumer died. It never reconnected.
        </p>
        <p>
          The fix sat across two layers: our code and <code>aio-pika</code>. Our code created each queue inside a small helper function and let the reference go the moment the function returned, so Python garbage-collected the queue. <code>aio-pika</code>'s <code>RobustChannel</code> tracked exchanges and queues in a <code>WeakSet</code>, on the assumption that user code would hold strong references. When connections dropped and our queues had no live references, they were garbage-collected and <code>aio-pika</code> had nothing to restore on reconnect. The contract of <code>robust=True</code> – re-declare on reconnect – silently broke when the user code happened to drop its reference.
        </p>
        <p>
          The upstream fix changed the tracking from <code>WeakSet</code> to <code>set</code>:
        </p>
        <blockquote>
          Replace <code>defaultdict(WeakSet)</code> with <code>defaultdict(set)</code> for both exchanges and queues. Users who don't want exchanges/queues to be restored must now explicitly set <code>robust=False</code>. – <a href="https://github.com/mosquito/aio-pika/commit/3a94dbdaaa0a67e52011c703f27960a57360f7a8" target="_blank" rel="noopener noreferrer">commit</a>
        </blockquote>
        <p>
          Once we picked up the new version of <code>aio-pika</code>, the reconnect path behaved as expected.
        </p>
        <p>
          This was not a latent Lambda bug; it was a new responsibility introduced by leaving Lambda's push-based delivery model. SNS pushed events straight to the function, so there was no long-lived connection to drop and no reconnection to get wrong. The pull-based consumer, and the entire reconnection contract that comes with it, exist only in the long-running services.
        </p>
        <p>
          The other lesson here is more boring: keep your dependencies current. The fix already existed upstream by the time we hit the bug – we just hadn't picked it up.
        </p>

        <h3>4. HTTP requests without retries</h3>
        <p>
          The Lambda made outbound HTTP calls to upstream services. Some of those calls didn’t have retry logic around them.
        </p>
        <p>
          On Lambda, the runtime mostly handled this for us. SNS invokes Lambda asynchronously, and Lambda <a href="https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-error-handling.html" target="_blank" rel="noopener noreferrer">retries a failed async invocation</a> on its own – so a network blip failed the call, the invocation failed with it, and Lambda ran it again. A later attempt went through, and the application code never had to think about it.
        </p>
        <p>
          The service has no equivalent. A failed HTTP call raised, the consumer logged the error, and the message went to the dead-letter queue or back to the broker depending on how that consumer was configured. Both outcomes are worse than what Lambda had been doing. Dead-letter needed manual replay. And requeuing to the broker redelivers on the broker's timing – not the quick, in-process retry-with-backoff a transient HTTP blip actually needs.
        </p>
        <p>
          The fix was the obvious one: wrap the HTTP call in retry-with-backoff, give up after a few attempts, let the queue handle anything that exceeds that.
        </p>
        <p>
          Lambda's async retries had been acting as invisible retry middleware. The application code had no retry logic because it didn't need any – the runtime contract included automatic retries. When that contract changed, the retry logic had to move into the application layer.
        </p>

        <h3>5. Hammering upstream with HTTP requests</h3>
        <p>
          Some time after rollout, an upstream service started returning connection-refused errors. The Lambda had called the same upstream at higher total throughput without issues.
        </p>
        <p>
          The reason was simple. Original code opened a new <code>aiohttp.ClientSession</code> for every outbound call:
        </p>
        <pre><code className="language-python" dangerouslySetInnerHTML={{ __html: `async with aiohttp.ClientSession() as session:
    async with session.post(url, json=payload) as resp:
        ...` }} /></pre>
        <p>
          Lambda invocations run across AWS's fleet, exiting from a wide range of source IPs. The service runs from a small fixed pool of pods, with a much smaller IP footprint. The upstream's per-source-IP limit was never reached on Lambda. The same per-call pattern on the service produced too many connections from one IP at once, and the upstream rejected the extras.
        </p>
        <p>
          The fix was to create one <code>aiohttp.ClientSession</code> at service startup with a connection pool limit, and reuse it for every call. With a bounded pool, the connection count stayed below the upstream's limit.
        </p>
        <pre><code className="language-python" dangerouslySetInnerHTML={{ __html: `# at startup, once
session = aiohttp.ClientSession(
    connector=aiohttp.TCPConnector(limit=MAX_CONNECTIONS)
)` }} /></pre>
        <p>
          Lambda had been providing source-IP diversity as a side effect of its execution model. Once the service consolidated traffic, the upstream's rate limits stopped being theoretical.
        </p>

        <h3>6. Async code that wasn't really async</h3>
        <p>
          The second consumer was more data-intensive than the first – larger upserts, more DB pools, more work per delivery. The symptom was Kubernetes pod restarts from failing liveness probes. The process was alive, it just wasn't responding.
        </p>
        <p>
          The cause was sync I/O inside async code. One DB driver the service depended on had no async alternative, and the upserts it performed were large enough that blocking the event loop for their duration was measurable. While an upsert was running, nothing else got scheduled – including the probe.
        </p>
        <p>
          This is the kind of bug that only exists in long-running, concurrent processes. Lambda's execution model had been making it invisible: each environment handled one invocation at a time, and there was no Kubernetes liveness probe competing for the event loop. The sync call wasn't blocking anything because there was nothing else to block.
        </p>
        <p>
          The fix was <code>asyncio.to_thread()</code>. Sync DB clients and blocking calls were deferred to a thread pool, freeing the event loop. The tradeoff: thread pool exhaustion degrades gracefully – tasks queue – while event loop blocking fails silently. The thread pool still has a size, and that size is now a tunable with real consequences. The broader lesson is that async code is only as async as its slowest sync call, and Lambda had been hiding the slow calls.
        </p>

        <h3>7. DLQ replay that took the pod down</h3>
        <p>
          Some time after the second consumer was stable under normal traffic, we triggered a DLQ replay to reprocess a batch of failed messages. The pod went OOM and Kubernetes restarted it. On restart, the unacked messages re-delivered and the pod went down again.
        </p>
        
        <div style={{ margin: '2rem 0', textAlign: 'center' }}>
          <img 
            src="/lambda-migration-oom.png" 
            alt="OOM and container restarts diagram" 
            style={{ 
              maxWidth: '100%', 
              height: 'auto', 
              borderRadius: '4px',
              border: '1px solid var(--border-color)'
            }} 
          />
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
            DLQ replay cascading into OOM pod restarts.
          </div>
        </div>

        <p>
          Both Python consumers were sized the same way – same pod count, same processes per pod, same prefetch per process. The total concurrency was set to roughly match Lambda's per-function concurrency cap. The shape mirrored Lambda intentionally.
        </p>
        <p>
          What didn't transfer was the isolation. On Lambda, each concurrent invocation had its own execution environment with its own memory and CPU budget. On the service, all those concurrent messages share one process's memory. As long as per-message work was light, the math held. The second consumer did significantly more work per message than the first – larger pandas dataframes, more sync DB calls, more bytes in flight. Under normal traffic the queue depth stayed low and the prefetch buffer never filled. The DLQ replay filled it instantly, all those heavy upserts ran concurrently in one process, and the pod ran out of memory before any of them finished.
        </p>
        <p>
          The fix was to lower the second consumer's prefetch proportionally to its heavier per-message cost. Fewer messages in flight, smaller memory footprint, pod stayed up.
        </p>
        <p>
          Lambda had been absorbing this too, but in a different way than the earlier cases. It wasn't hiding latent code, it was giving every message its own memory budget. The same concurrency math that approximated Lambda's runtime turned into a memory bomb the moment per-message cost varied between services running the same shape.
        </p>

        <h3>8. Credentials that expired mid-process</h3>
        <p>
          A consumer talking to a single database started failing intermittently. Some deliveries synced cleanly. Others hit auth errors. Same code path, same delivery shape, different outcome. The pattern looked random, which made it harder to reason about than a clean failure would have been.
        </p>
        <p>
          The cause was a mismatch between two lifetimes: the process's, which was indefinite, and the database credentials', which were one month. The service used Vault-issued credentials and fetched them once at startup. Nothing refreshed them. The intermittent pattern was the connection pool – deliveries reusing connections opened before expiry succeeded, deliveries opening new connections failed. The bug had a deterministic cause but presented as noise because the pool obscured the boundary.
        </p>
        <p>
          The mental model was that the credentials were static. On Lambda this was effectively true. Nobody designed refresh logic because nobody framed the credential as something that needed refreshing.
        </p>
        <p>
          The migration didn't change the credential. It changed the lifetime ratio. "Static" didn't mean permanent – it meant a longer rotation interval: long enough that a Lambda never met expiry, short enough that an always-on process does.
        </p>
        <p>
          The immediate fix was a pod restart. The longer-term fix was a background refresh task with atomic update to the in-memory credential reference, so in-flight requests don't see a torn state.
        </p>
        <p>
          Lambda's lifetime was shorter than every credential's TTL. The application code never had to think about refresh because the process never lived long enough for refresh to matter. The general pattern: any time-bounded resource the runtime was hiding – credentials, signed URLs, OAuth tokens, TLS certs – becomes application code once the runtime stops hiding it.
        </p>

        <h2>Lambda as a runtime contract</h2>
        <p>
          What this migration made visible is that Lambda isn't just a deployment target – it's a runtime contract. The contract says: each concurrent execution environment gets isolated filesystem and memory, any in-process connection pool is scoped to that environment, SNS-triggered work gets a retry policy outside your code, and the environment's lifetime is short enough that many accumulators never reach steady state. Most of this is documented somewhere – <a href="https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html" target="_blank" rel="noopener noreferrer">the filesystem and memory isolation</a>, even the SNS retries. Some of it isn't, like your code inheriting its own connection pool. But none of it is gathered into the one list that matters: the set of guarantees your code is quietly relying on, that break together the moment the runtime changes.
        </p>
        <p>
          Code written under that contract can rely on it without naming it. The reliance shows up as the absence of code – no reconnect logic, no admission control, no cache eviction, no retry wrappers, no concurrency cap on operator actions. When the contract changes, the absences become bugs.
        </p>
        <p>
          The practical test for anyone planning a similar migration: list every guarantee your current runtime provides that your code doesn't explicitly request. That list is the contract. Each item is a candidate bug under the new runtime. Each of the eight cases above came from a line on it.
        </p>
        <p>
          For years the code ran on Lambda with all eight bugs latent. The runtime never fixed them – it just absorbed them, and nobody noticed. That's the part that matters, more than the count. Any production system on a managed runtime is making the same bet, whether the team running it knows it or not.
        </p>
        <hr style={{ margin: '4rem 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />

        <h2>Appendix A: The eight, at a glance</h2>
        <p>
          &ndash; each one either depended on a guarantee Lambda had been providing, or on an operational responsibility the migration moved into the service.
        </p>

        <div className="table-container" style={{ overflowX: 'auto', margin: '2.5rem 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Case</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>What Lambda hid</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Fix</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 1rem' }}><code>/tmp</code> file collisions</td>
                <td style={{ padding: '0.75rem 1rem' }}>Own filesystem per execution environment</td>
                <td style={{ padding: '0.75rem 1rem' }}>Name files by delivery UUID</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 1rem' }}>SQLAlchemy cache OOM</td>
                <td style={{ padding: '0.75rem 1rem' }}>Caches spread across separate environments</td>
                <td style={{ padding: '0.75rem 1rem' }}>One shared engine, bounded cache</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 1rem' }}>RabbitMQ reconnect failure</td>
                <td style={{ padding: '0.75rem 1rem' }}>No consumer – SNS pushed events</td>
                <td style={{ padding: '0.75rem 1rem' }}>Strong refs (<code>WeakSet</code>→<code>set</code>)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 1rem' }}>HTTP retry failure</td>
                <td style={{ padding: '0.75rem 1rem' }}>Lambda retried for you</td>
                <td style={{ padding: '0.75rem 1rem' }}>Retry-with-backoff at the app</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 1rem' }}>Connection pool exhaustion</td>
                <td style={{ padding: '0.75rem 1rem' }}>Source-IP diversity across the fleet</td>
                <td style={{ padding: '0.75rem 1rem' }}>One pooled client</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 1rem' }}>Sync-in-async loop freeze</td>
                <td style={{ padding: '0.75rem 1rem' }}>One unit of work at a time</td>
                <td style={{ padding: '0.75rem 1rem' }}>Offload to a thread</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 1rem' }}>DLQ replay OOM</td>
                <td style={{ padding: '0.75rem 1rem' }}>Memory isolated per execution environment</td>
                <td style={{ padding: '0.75rem 1rem' }}>Lower prefetch</td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem 1rem' }}>Credentials expire mid-process</td>
                <td style={{ padding: '0.75rem 1rem' }}>Process lifetime ≪ credential TTL</td>
                <td style={{ padding: '0.75rem 1rem' }}>Background refresh, atomic swap</td>
              </tr>
            </tbody>
          </table>
        </div>

        <SubscribeForm />

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

export default WhatLambdaWasHiding;
