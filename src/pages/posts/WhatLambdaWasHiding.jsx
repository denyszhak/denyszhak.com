import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiHeart } from 'react-icons/fi';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import { usePostStats } from '../../hooks/usePostStats';
import SubscribeForm from '../../components/SubscribeForm';

const WhatLambdaWasHiding = () => {
  const { hasLiked, like } = usePostStats('what-aws-lambda-was-hiding');

  useEffect(() => {
    // Highlighting handled inline during render
  }, []);

  return (
    <div className="blog-post-container">
      <Link to="/writing" className="back-link">← back to all posts</Link>

      <article className="article-content">
        <header className="article-header">
          <h1 className="article-title">What AWS Lambda was hiding</h1>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <span className="post-tag">distributed systems</span>
              <span className="post-tag">serverless</span>
            </div>
            <div className="article-meta">
              <span>7 Jul 2026</span>
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

        <p>Earlier this year I finished moving seven Python Lambdas into services. It took about six months including rollout, partly because none of them were simple handlers, each was more like a small application. Along the way we hit problems in code that had been running on Lambda for years without anyone worrying about it.</p>

        <p>If you're here for the technical content and not the migration context, <a href="#cases">skip to the cases</a>.</p>

        <h2>Why the migration</h2>

        <p>The Lambdas were the ingestion pipeline for the external time-series data. Some of the reasons are:</p>

        <ul>
<li>Deployment consistency. The rest of the platform was already on Kubernetes, and the Lambdas were the only part we released, configured and monitored differently, which meant keeping a second setup working in every environment and region.</li>
<li>Cognitive load. We had seven Lambdas and an orchestration between them, and tracing what happened to one event took more effort than the actual work the system was doing. New devs couldn't catch up quickly and required more time to internalize the system.</li>
<li>Non-functional bottlenecks. The data grew, and for some functionality, Lambda's cap of 15 minutes wasn't enough. We found ourselves trying to work around that, and although it was possible, we didn't want to think about non-functional limits like this.</li>
</ul>

        <h2>The old architecture, briefly</h2>

        <p>In total, we migrated 7 lambdas, all written in Python. Most of them were part of the pipeline that ingested external time-series data and synced it to different databases.</p>

        <p>Each sync Lambda did two things: extract and transform data into a form suitable for its target database(s), then write it. The extraction logic lived in a shared library, but most of the Lambdas still ran it on their own as part of every invocation, and the other three did their own slightly different extraction and also took care of a few other things like resampling.</p>

        <h2>The new architecture</h2>

        <p>Now there is one service for extraction and normalization. Each consumer is responsible for one or more target databases. Consumers get events over a shared contract, fetch the normalized payload from S3 and write it to their stores.</p>

        <p>We rewrote the extraction service in Go. It's the producer all consumers depend on, so static typing there was important for us, and since the rest of the platform is in Go, we could reuse internal libraries we already had.</p>

        <p>We could have rewritten the consumers too, but they depend on pandas, the Python ecosystem and our internal libraries, and doing both language changes at once would make the migration longer and less predictable, so we kept them in Python.</p>

        <h2 id="cases">The six cases</h2>

        <p>The rollout used a custom canary configuration: test and anonymous traffic first, then a small set of real customers, then wider and so on.</p>

        <p>The migration had one constraint: the new service's output had to match the Lambda's exactly on the same input. Because of that, we didn't clean up any code while moving it unless the migration needed it. Some design changes we expected from the start because the runtime was different, but we waited with them until we could check them on anonymous traffic during the canary rollout.</p>

        <h3 id="case-1">1. We didn't know we had duplicates</h3>

        <p>On Lambda, concurrent invocations run in separate execution environments, each with its own <code>/tmp</code>. Two deliveries in flight at once never share a filesystem. Warm invocations can reuse <code>/tmp</code>, but only one after another, so they can't collide. In the service, concurrent deliveries on the same pod share a filesystem, so intermediate files with the same name can collide. This only affected the Python consumers. The Go extraction service keeps intermediate state in memory and doesn't use <code>/tmp</code>.</p>

        <p>We planned for this before the migration. Each delivery writes to its own directory, and we had two options for naming it: a fresh UUID generated by the consumer, or the delivery UUID from upstream. We chose the delivery UUID because it made debugging easier. This follows the identifier-reuse pattern Kleppmann describes in <a href="https://www.oreilly.com/library/view/designing-data-intensive-applications/9781098119058/" target="_blank" rel="noopener noreferrer"><i>Designing Data-Intensive Applications</i></a>. Each delivery removed its directory when it finished, whether processing succeeded or failed, so a later retry could use the same path.</p>

        <p>The source could send the same event more than once, usually within seconds or tens of seconds. The producer extracted each copy and published two deliveries with the same UUID. We didn't expect those copies to reach the same pod at the same time. When they did, the second copy's <code>mkdir</code> failed because the directory already existed, and that copy was discarded. That's how we noticed the duplicates.</p>

        <p>The duplicates existed on Lambda too. Extraction and insertion ran inside the same Lambda, each copy ran in its own environment with its own <code>/tmp</code>, and the inserts were idempotent. The work was repeated, but nothing failed, so nobody noticed.</p>

        <p>We added a guardrail to the producer. When it starts extracting an event to S3, it first writes a marker there. Later copies of the same event find the marker and are rejected at the producer.</p>

        <p>You may ask why the check went into the producer rather than the consumers, where idempotency is usually done. The two layers protect against different things. The producer check avoids repeating extraction work. The consumers deliberately don't reject duplicates in general, because replaying from an older offset is how we recover from bugs, and database idempotency makes redelivery safe. The <code>/tmp</code> collision can catch concurrent duplicates on the same pod, but it isn't the main deduplication mechanism.</p>

        <h3>2. Memory bloat from creating SQLAlchemy engines per request</h3>

        <p>Some time into testing we noticed premature restarts. Over one to two days, memory climbed toward the pod's 4 GiB memory limit until the pods were restarted.</p>

        <div style={{ margin: '2rem 0', textAlign: 'center' }}><img src="/sqlalchemy-cache-leak.png" alt="Pod memory growing between restarts, with a separate line for each replica" style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px', border: '1px solid var(--border-color)' }} /></div>

        <p>The first Lambda we migrated created a SQLAlchemy engine per request instead of reusing one across invocations. We corrected that during the migration but missed similar calls inside our internal library.</p>

        <p>At first sight, this didn't seem like a big problem considering they all disposed of their engines at the end, but this wasn't the first time we'd dealt with memory quirks in Python, so we had a sense of what was going on.</p>

        <p><code>tracemalloc</code> pointed at SQLAlchemy early on. We replayed 51 deliveries against the old version on Linux, with <code>tracemalloc</code> turned off so it wouldn't impact the numbers, and with <code>MALLOC_ARENA_MAX=1</code>, which limits glibc to a single arena. They created a bit more than 1000 engines, none of which were alive after garbage collection. The process still held about 485 MiB of resident memory (RSS).</p>

        <p>Since live Python objects could not explain the RSS, we looked one level lower at glibc, the C library that allocates memory for our process. glibc reported 54 MiB allocated in its heap. Another 169 MiB was free, but glibc hadn't returned it to Linux.</p>

        <p>We called <a href="https://man7.org/linux/man-pages/man3/malloc_trim.3.html" target="_blank" rel="noopener noreferrer"><code>malloc_trim()</code></a>, which asks glibc to return its free pages to Linux. RSS dropped by 151 MiB. None of that memory was being used by the application.</p>

        <p>Each time the service created and destroyed an engine, it allocated memory and freed it shortly after. <a href="https://sourceware.org/glibc/manual/latest/html_node/Freeing-after-Malloc.html" target="_blank" rel="noopener noreferrer">Some of that freed memory stayed inside the process</a> for glibc to reuse, instead of going back to Linux. Free chunks ended up scattered across glibc's heap, and they still counted toward the pod's memory usage. Limiting glibc to one arena didn't prevent this, so capping arenas wouldn't have fixed it.</p>

        <p>This explains why memory grew gradually. Most deliveries could reuse memory. Some larger deliveries, or several arriving at once, needed more than the free chunks could cover, so glibc took more from Linux and RSS moved to a new plateau.</p>

        <p>After we switched to a global engine, memory grew at a much slower rate, and we no longer saw the earlier restarts between routine deploys.</p>

        <div style={{ margin: '2rem 0', textAlign: 'center' }}><img src="/sqlalchemy-memory-flattened.png" alt="Pod memory staying level after reusing the SQLAlchemy engine across deliveries" style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px', border: '1px solid var(--border-color)' }} /></div>

        <p>We never had the memory problem on Lambda. Each execution environment handled one invocation at a time and could <a href="https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html#runtimes-lifecycle-shutdown" target="_blank" rel="noopener noreferrer">eventually be recycled</a>, so leftover memory didn't have time to grow. In the service, the same processes ran concurrent deliveries for days, and memory kept growing until the processes restarted.</p>

        <p>The per-request engine was still a problem on Lambda. Each engine has its own connection pool, so every delivery opened new database connections, each with its own TCP handshake and authentication.</p>

        <h3>3. Outbound HTTP calls: a new connection per call, and no retries</h3>

        <p>The consumers called an internal upstream service to look up metadata, using code we carried over from the Lambda unchanged. It opened a new <code>aiohttp.ClientSession</code> for every call and never retried:</p>

        <pre><code className="language-python" dangerouslySetInnerHTML={{ __html: Prism.highlight("async with aiohttp.ClientSession() as session:\n    async with session.post(url, json=payload) as resp:\n        ...", Prism.languages.python, 'python') }} /></pre>

        <p>As we moved more customers over, some of those calls started failing with <code>ServerDisconnectedError</code>: the request went out, but the connection closed before any response came back. The canary setup made the pattern easy to see. When we moved half of the customers back to the Lambda, the errors went away, even though the upstream was handling the same total traffic, and the Lambda itself didn't log a single failure at any split.</p>

        <p>We suspected too many parallel connections from the service. On Lambda, the same calls were spread across many short-lived environments and at least three source addresses, so no single source ever carried that many. On the service, they all came from a couple of pods. We switched to one pooled <code>ClientSession</code> per process (<code>limit=25</code>) and added retries with backoff, which was safe because the call is a read-only search. The service already had broker redelivery, but retrying the HTTP call let us recover from transient disconnects without repeating the whole delivery. Both changes shipped together, and the errors stopped. We didn't investigate further to find what had closed the connections.</p>

        <h3>4. Async code that wasn't really async</h3>

        <p>The cases so far came from the first of the four consumers. The second consumer was more data-intensive than the first – larger upserts, more work per delivery. The symptom we hit was Kubernetes pod restarts from failing liveness probes. The process was alive, it just wasn't responding.</p>

        <p>The cause was sync I/O inside async code. One custom DB driver the service depended on had no async alternative, and the upserts it performed were large enough that blocking the event loop for their duration was measurable. While an upsert was running, nothing else got scheduled – including the probe.</p>

        <p>Lambda's execution model had been making it invisible. Each environment handled one invocation at a time, and there was no Kubernetes liveness probe competing for the event loop. The sync call wasn't blocking anything except active delivery, there was nothing else to block.</p>

        <p><code>asyncio.to_thread()</code> moved the blocking calls to Python's default thread pool.</p>

        <p>When all workers were busy, additional upserts waited in the queue while the event loop remained responsive. Async code is only as async as its slowest sync call.</p>

        <h3>5. DLQ replay that took the pod down</h3>

        <p>Once the second consumer was stable under normal traffic, we triggered a DLQ replay to reprocess failed messages in batches. The pod went OOM and Kubernetes restarted it. As the replay continued, subsequent batches caused the same failure.</p>

        <div style={{ margin: '2rem 0', textAlign: 'center' }}><img src="/lambda-migration-oom.png" alt="OOM and container restarts diagram" style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px', border: '1px solid var(--border-color)' }} /></div>

        <p>DLQ replay cascading into OOM pod restarts.</p>

        <p>All types of Python consumers were configured the same way – same pod count, same processes per pod, same prefetch count per process. The total concurrency was set to roughly match Lambda's per-function concurrency cap, and this setup had worked for the first consumer we migrated. The shape mirrored Lambda intentionally.</p>

        <p>What didn't transfer was the isolation. On Lambda, each concurrent invocation had its own execution environment with its own memory and CPU budget. On the service, all those concurrent messages share one process's memory. The second consumer did significantly more work per message than the first – larger pandas dataframes, more sync DB calls, more bytes in flight. Under normal traffic the queue depth stayed low and the prefetch buffer never filled. The DLQ replay filled it instantly, all those heavy upserts ran concurrently in one process, and the pod ran out of memory before any of them finished. The fix from case 4 also made this easier to hit, because with blocking calls off the event loop each process could run more of this work at the same time.</p>

        <p>The second consumer needed its own memory calculation. We lowered its prefetch based on peak memory per delivery, processes per pod, and the pod's memory limit. With fewer messages in flight and a smaller memory footprint, the restarts stopped.</p>

        <p>We copied Lambda's concurrency settings, but the service had to fit those deliveries into shared pod memory.</p>

        <p>To estimate prefetch, you need the peak additional memory one large delivery uses. Lambda's REPORT log line shows Max Memory Used for each invocation. Take that value from a large delivery and subtract the baseline, what the same function uses on a tiny delivery. Use this measured number, not the function's configured memory size, which is only a ceiling.</p>

        <pre><code>{"prefetch per process = (memory limit per pod \u2212 baseline memory per pod \u2212 headroom) \u00f7 (processes per pod \u00d7 peak additional memory per delivery)"}</code></pre>

        <p>For example, with an 8 GiB pod limit, 768 MiB baseline, 768 MiB headroom, four processes and 200 MiB of additional memory per delivery:</p>

        <pre><code>{"prefetch = (8192 \u2212 768 \u2212 768) \u00f7 (4 \u00d7 200) = 8.32"}</code></pre>

        <p>Round down to <strong>prefetch 8 per process</strong>. With four processes per pod and three pods:</p>

        <pre><code>{"3 pods \u00d7 4 processes \u00d7 8 prefetch = 96 deliveries in flight"}</code></pre>

        <p>This is a starting estimate to validate under load.</p>

        <p>Lowering prefetch was the simple first step, but prefetch isn't actually a concurrency setting. It limits how many unacknowledged messages the broker sends to a process. Our consumers start processing a message as soon as it arrives, so in our case it also limits how much work runs at the same time.</p>

        <p>That makes prefetch look like the fix, but it limits memory only indirectly, through the number of deliveries, and it doesn't know which parts of the handler actually use memory. To limit memory properly, you have to go through the handler, find the sections that load large payloads or build big dataframes, and put them under a semaphore sized with the same formula. Prefetch can then go a bit above the semaphore limit so there's always a message ready, but not much higher, since messages waiting on the semaphore stay unacknowledged and other pods can't process them.</p>

        <p>Be careful with what a delivery keeps in memory between those sections. If it builds a dataframe in one step and still holds it in the next, releasing the semaphore in between doesn't free that memory, so the semaphore has to cover the whole time the data is alive, not only the heavy calls. In a handler where large data stays alive for most of the delivery, that means one semaphore around almost the whole handler, which is close to what prefetch already gives you.</p>

        <h3>6. Credentials that expired mid-process</h3>

        <p>A consumer talking to a single database started failing intermittently. Some deliveries synced cleanly. Others hit auth errors. Same code path, same delivery shape, different outcome. The pattern looked random, which made it harder to reason about than a clean failure would have been.</p>

        <p>The cause was a mismatch between two lifetimes. The process lived indefinitely, while the credentials lived one month. The service used Vault-issued credentials and fetched them once at startup. Nothing refreshed them. The intermittent pattern was the connection pool – deliveries reusing connections opened before expiry succeeded, deliveries opening new connections failed.</p>

        <p>We called these credentials “static” to distinguish them from the short-lived ones. They still rotated, just less often, but the name led us to overlook refreshing them in the service.</p>

        <p>The immediate fix was a pod restart. The longer-term fix was a background refresh task with atomic update to the in-memory credential reference, so in-flight requests don't see a torn state.</p>

        <p>Lambda's lifetime was shorter than every credential's TTL. The application code never had to think about refresh because the process never lived long enough for refresh to matter. The general pattern: any time-bounded resource the runtime was hiding – credentials, signed URLs, OAuth tokens, TLS certs – becomes application code once the runtime stops hiding it.</p>

        <p>The same problem can hit new responsibilities the service takes on. With Lambda, you might receive events from SNS. In a service, you might consume from RabbitMQ or Kafka, so you control how credentials are fetched. Even with a reliable broker, you still have to handle reconnects in your application. If credentials expire or rotate, you may need fresh ones before reconnecting after a broker hiccup.</p>

        <p>Re-fetching credentials on auth error would also have worked: retry once with fresh credentials, and if it still fails something is broken. Scheduled refresh has its own benefits. Rotation gets handled ahead of time instead of being discovered through failed connections, and an auth error during normal operation stays a signal that something is actually wrong.</p>

        <h2>Lambda as a runtime contract</h2>

        <p>None of this is an argument against Lambda – the same kind of contract exists under any runtime, including the one we moved to.</p>

        <p>What this migration made visible is that Lambda is a runtime contract, not just a deployment target. The contract says: each concurrent execution environment gets isolated filesystem and memory, any in-process pools and caches are scoped to that environment, SNS-triggered work gets a retry policy outside your code, and the environment's lifetime is short enough that many accumulators never reach steady state. Most of this is documented somewhere – <a href="https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html" target="_blank" rel="noopener noreferrer">the filesystem and memory isolation</a>, even the Lambda retries. Some of it isn't, like your code inheriting its own pools and caches. But none of it is gathered into the one list that matters – the set of guarantees your code is <a href="https://www.hyrumslaw.com/" target="_blank" rel="noopener noreferrer">quietly relying on</a>.</p>

        <p>Code written under that contract can rely on it without naming it. The reliance shows up as the absence of code – no reconnect logic, no per-process work limit, no engine reuse, no retry wrappers, no concurrency cap on bulk replays. When the contract changes, the absences become bugs.</p>

        <p>The <a href="https://www.joelonsoftware.com/2002/11/11/the-law-of-leaky-abstractions/" target="_blank" rel="noopener noreferrer">Law of Leaky Abstractions</a> says what's underneath your abstraction eventually shows through. With Lambda it went the other way. Our bugs disappeared into the runtime. You still have to learn what the abstraction hides. Lambda just let us postpone it.</p>

        <p>The practical test for anyone planning a similar migration is to list every guarantee your current runtime provides that your code doesn't explicitly request. Each item is a candidate bug under the new runtime.</p>

        <p>For years the system ran on Lambda with these assumptions intact – some of them latent bugs, some responsibilities Lambda had been handling for us. The runtime never made any of it visible. It just absorbed it, and nobody noticed. Any production system on a managed runtime is making the same bet, whether the team running it knows it or not.</p>

        <hr style={{ margin: '4rem 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />

        <h2>Appendix A: The cases, at a glance</h2>

        <div className="table-container" style={{ overflowX: 'auto', margin: '2.5rem 0' }}><table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}><thead><tr><th style={{ padding: '0.75rem 1rem' }}>Case</th><th style={{ padding: '0.75rem 1rem' }}>What Lambda hid</th><th style={{ padding: '0.75rem 1rem' }}>Fix</th></tr></thead><tbody><tr><td style={{ padding: '0.75rem 1rem' }}><code>/tmp</code> file collisions</td><td style={{ padding: '0.75rem 1rem' }}>Own <code>/tmp</code> per execution environment, so duplicate events never collided</td><td style={{ padding: '0.75rem 1rem' }}>Directory per delivery UUID, plus S3 marker at the producer</td></tr><tr><td style={{ padding: '0.75rem 1rem' }}>Memory growth from per-request engines</td><td style={{ padding: '0.75rem 1rem' }}>Recycled environments reset the heap</td><td style={{ padding: '0.75rem 1rem' }}>One engine reused for the process lifetime</td></tr><tr><td style={{ padding: '0.75rem 1rem' }}>Per-call connections, no retries</td><td style={{ padding: '0.75rem 1rem' }}>We suspected too many parallel connections from the service</td><td style={{ padding: '0.75rem 1rem' }}>One pooled session per process, plus retry with backoff</td></tr><tr><td style={{ padding: '0.75rem 1rem' }}>Sync-in-async loop freeze</td><td style={{ padding: '0.75rem 1rem' }}>One unit of work at a time</td><td style={{ padding: '0.75rem 1rem' }}>Offload to a thread</td></tr><tr><td style={{ padding: '0.75rem 1rem' }}>DLQ replay OOM</td><td style={{ padding: '0.75rem 1rem' }}>Memory isolated per execution environment</td><td style={{ padding: '0.75rem 1rem' }}>Lower prefetch</td></tr><tr><td style={{ padding: '0.75rem 1rem' }}>Credentials expire mid-process</td><td style={{ padding: '0.75rem 1rem' }}>Process lifetime ≪ credential TTL</td><td style={{ padding: '0.75rem 1rem' }}>Background refresh, atomic swap</td></tr></tbody></table></div>

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
