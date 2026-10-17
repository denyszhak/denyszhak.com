import { Link } from 'react-router-dom';
import { FiHeart } from 'react-icons/fi';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import { usePostStats } from '../../hooks/usePostStats';
import SubscribeForm from '../../components/SubscribeForm';

const WhatLambdaWasHiding = () => {
  const { hasLiked, like } = usePostStats('what-aws-lambda-was-hiding');

  return (
    <div className="blog-post-container">
      <Link to="/writing" className="back-link">← back to all posts</Link>

      <article className="article-content">
        <header className="article-header">
          <h1 className="article-title">Runtime Promises, Part 1 - What AWS Lambda Was Hiding</h1>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <span className="post-tag">distributed systems</span>
              <span className="post-tag">serverless</span>
            </div>
            <div className="article-meta">
              <span>7 Jul 2026</span>
              <span>•</span>
              <span>19 min read</span>
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

        <p>Since August 2025, I've done four production migrations of different kinds, with 2 major ones changing the product runtime.</p>

        <p>This post represents what I would have loved to have as a reference before starting one of these migrations: moving 7 Python Lambdas into services on k8s. Having it would have made the transition smoother and more predictable.</p>

        <p>Building serverful or serverless systems, which include Lambdas, is complex enough from the start, let alone moving between them. Lambdas come with particular limits, like memory, execution time, ephemeral storage, and concurrency, and some are simply runtime behaviour, like recycling environments. These are what you could consider first-order characteristics of the system. There are also second-order characteristics, or what I'll call promises, which you should infer from the nature of your application and the transition. For example, Lambda recycles environments, so nothing lives long enough to go bad. Our code could have reused database engines or refreshed credentials, but it was never required to. In a long-running service, both became issues.</p>

        <h2 id="the-old-architecture-briefly">The old architecture, briefly</h2>

        <p>The Lambdas were the ingestion pipeline for external time-series data (the reasons we moved them are in Appendix B). Most of the Lambdas synced that data to different databases. Each sync Lambda did two things: extract and transform data into a form suitable for its target database(s), then write it. The extraction logic lived in a shared library, but most of the Lambdas still ran it on their own as part of every invocation, and the other three did their own slightly different extraction and also took care of a few other things like resampling.</p>

        <h2 id="the-new-architecture">The new architecture</h2>

        <p>Now there is one service for extraction and normalization. Each consumer is responsible for one or more target databases. Consumers get events over a shared contract, fetch the normalized payload from S3 and write it to their stores.</p>

        <p>We rewrote the extraction service in Go. Static typing there was important for us in that piece of functionality, and since the rest of the platform is in Go, we could reuse internal libraries we already had.</p>

        <p>Consumers depend on pandas, the Python ecosystem and our internal libraries, rewriting them too would have made the migration longer and less predictable, so we kept them in Python.</p>

        <p>We didn't clean up any code while moving it unless the migration needed it. We rolled it out through a staged canary, starting with test and anonymous traffic.</p>

        <h2 id="the-four-promises">The four promises</h2>

        <p>The early tests went fine, even with several deliveries running at once. We started finding problems when we added more traffic and left the services running for days.</p>

        <p>Each problem exposed something we'd been relying on Lambda for. I've grouped those dependencies into four promises.</p>

        <ol>
          <li>Blocking only hurt the caller</li>
          <li>Every delivery had the place to itself</li>
          <li>Nothing lived long enough to go bad</li>
          <li>The outside world saw a different you</li>
        </ol>

        <h2 id="promise-1-blocking-only-hurt-the-caller">Promise 1: Blocking only hurt the caller</h2>

        <p>Each Lambda invocation runs in a dedicated execution environment. It might be reused after a particular request has finished, but concurrent requests don't reuse the environment and run in independent environments.</p>

        <p>We have four different types of consumers, and by the time we finished the rollout of the first, we were somewhat confident that the second wouldn't give us much trouble.</p>

        <p>The fun started when we crossed the threshold of about half of the customers running on the new service: k8s kept restarting our container periodically due to the failing liveness probe. However, the service was running fine and didn't show any obvious failure symptoms.</p>

        <div style={{ margin: '2rem 0', textAlign: 'center' }}><img src="/k8s-liveness-events.png" alt="Kubernetes events showing failed liveness probes timing out while awaiting response headers and restarting the container" style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px', border: '1px solid var(--border-color)' }} /></div>

        <p>The probe error ends with <code>Client.Timeout exceeded while awaiting headers</code>. The request reached the service, but no response came back before the timeout.</p>

        <p>The database writes were synchronous, even though we called them from async handlers. They could take seconds to finish, and the event loop was blocked the whole time. The service couldn't answer the liveness probe until the write finished.</p>

        <p>We'd been making those same calls on Lambda for years. Each concurrent delivery had its own environment, so waiting for the database didn't hold up the others. Once deliveries shared an event loop in the service, they all had to wait.</p>

        <p>We moved the database writes to a thread pool and stopped seeing the restarts. CSV parsing and pandas resampling were also running on the loop, so we moved those to threads too. <strong>Async code is only as async as its slowest sync call.</strong></p>

        <p>When reviewing the handlers, follow the calls into the database drivers and SDKs as well, especially those without async versions. For testing, leave the liveness probes enabled and run the service under load. Enabling asyncio debug mode also helps here. By default, it logs callbacks and task steps that take longer than 100 ms, giving you somewhere to start looking.</p>

        <h2 id="promise-2-every-delivery-had-the-place-to-itself">Promise 2: Every delivery had the place to itself</h2>

        <p>On Lambda, each execution environment has its own memory, CPU and <code>/tmp</code>. In the service, deliveries no longer had the place to themselves.</p>

        <p>Once the second consumer was stable under normal traffic, we triggered a DLQ replay to process failed messages in batches. The container OOMed and restarted. As the replay continued, each new batch caused the same failure.</p>

        <div style={{ margin: '2rem 0', textAlign: 'center' }}><img src="/lambda-migration-oom.png" alt="CPU and memory usage spiking during a dead-letter queue replay, followed by container restarts" style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px', border: '1px solid var(--border-color)' }} /></div>

        <p>All our Python consumers were configured the same way: same pod count, same processes per pod, same prefetch count per process (we use RabbitMQ). We set concurrency to roughly match Lambda's concurrency, and this had worked for the first consumer.</p>

        <p>However, isolation didn't transfer. On Lambda, each concurrent invocation had its own memory budget. In the service, all deliveries in a pod share the pod's memory limit. The second consumer did much more work per delivery than the first. It had more bytes in flight with larger pandas dataframes and more database calls. Under regular traffic, the queue stayed short and the prefetch never filled. The DLQ replay filled it instantly, and the pod ran out of memory before any of the deliveries finished. The fix from Promise 1 made this easier to hit: with blocking calls off the event loop, each process could run more of this work at the same time.</p>

        <p>To size prefetch, you need the peak additional memory one large delivery uses. Lambda's REPORT line includes Max Memory Used, but when invocations share an environment, it reports the maximum across all of them. So use a large delivery that ran first in a fresh environment (its REPORT line includes Init Duration), and subtract the function's memory right after init, which you can log at the end of the init code. Use this number, not the function's configured memory size, which is only a ceiling, and be sure to validate it in the service under load.</p>

        <p>For the baseline, take the pod's memory in the service with all its processes running but idle.</p>

        <pre><code>{"concurrency per process = (memory limit per pod − baseline memory per pod − headroom) ÷ (processes per pod × peak additional memory per delivery)"}</code></pre>

        <p>For example, with an 8 GiB pod limit, 768 MiB baseline, 768 MiB headroom, four processes and 200 MiB of additional memory per delivery:</p>

        <pre><code>{"concurrency = (8192 − 768 − 768) ÷ (4 × 200) = 8.32"}</code></pre>

        <p>Round down to concurrency 8 per process. With four processes per pod and three pods:</p>

        <pre><code>{"3 pods × 4 processes × 8 prefetch = 96 deliveries in flight"}</code></pre>

        <p>This is a starting estimate to validate under load.</p>

        <p>Lowering prefetch was our first step. Prefetch isn't a dedicated concurrency primitive. It limits how many unacknowledged messages the broker will deliver to a consumer. In our case, it acts like a semaphore around the whole delivery. It may be unnecessarily strict in how it limits memory, and you could potentially run at a higher concurrency than you otherwise would. For a precise limit, put the memory-heavy sections of the handler under a semaphore sized with the same formula. It has to cover the whole time the data is alive, so in a handler that holds large data for most of the delivery, prefetch already gets you most of the way.</p>

        <p>In the service, deliveries on the same pod share a filesystem. We planned for this: each delivery writes to its own directory, named after the delivery UUID from upstream. But the source could send the same event more than once within tens of seconds, and the producer published each copy with the same UUID. When two copies arrived at the same pod at once, the second <code>mkdir</code> failed, and that's how we noticed the duplicates. They existed on Lambda too, but each copy ran in its own environment and the inserts were idempotent, so nothing failed and nobody noticed. We added a marker at the producer to reject later copies. Consumers still accept duplicates, since replaying from an older offset is how we recover from bugs.</p>

        <h2 id="promise-3-nothing-lived-long-enough-to-go-bad">Promise 3: Nothing lived long enough to go bad</h2>

        <p>A Lambda execution environment is short-lived. As noted earlier, it can be reused, but even in this case, it's recycled every few hours. It's the complete opposite in a service, where a process stays running unless deployments or crashes intervene. You might have scheduled rotation, but it's nothing close to how Lambda operates.</p>

        <p>Some time into testing, we noticed premature restarts. Over one to two days, memory climbed toward the pod's 4 GiB memory limit until the pods were restarted.</p>

        <div style={{ margin: '2rem 0', textAlign: 'center' }}><img src="/sqlalchemy-cache-leak.png" alt="Pod memory growing toward the 4 GiB limit over one to two days, with a separate line for each replica" style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px', border: '1px solid var(--border-color)' }} /></div>

        <p>The first Lambda we migrated created a SQLAlchemy engine per request instead of reusing one across invocations. We corrected that during the migration but missed similar calls inside our internal library, which created several engines on every delivery.</p>

        <p>At first sight, this didn't seem like a big problem, since they all disposed of their engines at the end. But this wasn't the first time we'd dealt with memory quirks in Python, so we had a sense of what was going on.</p>

        <p><code>tracemalloc</code> pointed at SQLAlchemy early on. We replayed 51 deliveries against the old version, and they created a bit more than 1,000 engines. None of them were alive after garbage collection, but the process still held about 485 MiB of resident memory (RSS). glibc, the C library that allocates memory for our process, reported only 54 MiB in use. Another 169 MiB was free, but glibc hadn't returned it to Linux. When we called <code>malloc_trim()</code> to give free pages back, RSS dropped by 151 MiB.</p>

        <p>It wasn't a leak but heap fragmentation, sometimes called memory bloat. Each new engine allocated memory and freed it after, but some memory still stayed in the process for reuse instead of going back to Linux. As more deliveries came in, some needed more than the free slots could cover, so glibc took more from Linux and the growth pattern continued. Limiting glibc to a single arena didn't change this.</p>

        <p>After we switched to a global engine, memory grew at a much slower rate, and we no longer saw the restarts between routine deploys. At that rate, our pods get restarted long before they could get anywhere near the limit, but we still want to track down what's left. If you can't remove the churn at the source, a common workaround in Python is to recycle processes instead of pods. Gunicorn has <code>max_requests</code>, Celery has <code>worker_max_tasks_per_child</code> and <code>worker_max_memory_per_child</code>, and Python has <code>ProcessPoolExecutor(max_tasks_per_child=...)</code>, all for exactly this purpose.</p>

        <p>Even though it wasn't a visible problem on Lambda, the code shouldn't have created several engines per delivery. The engine should have been created outside the handler so it could be reused. Even on Lambda, every new engine meant new connections, each with a new TCP handshake and authentication.</p>

        <p>We also had a consumer that started failing intermittently when writing to a database. Some deliveries synced fine, while others failed with authentication errors.</p>

        <p>The credentials came from Vault and rotated monthly. We fetched them at startup but never refreshed. After a rotation, the service was still trying to open connections with the old credentials.</p>

        <p>We called these credentials "static" to distinguish them from the short-lived ones. We'd already added periodic refresh for the short-lived credentials by that time, but overlooked the static ones. Of course they were also rotated, a month was just much longer than anything we tested.</p>

        <p>Restarting the pod is the immediate fix since it fetched the current credentials. We then added a background task to refresh them while the service was running. Our Lambdas didn't live for this long to expose the problem.</p>

        <p>Before migration, review whether the code creates new engines, clients and sessions on every delivery when it could reuse them. I'd also check what happens when credentials, tokens, signed URLs or certificates expire while the service is still running.</p>

        <p>I'd also look at memory usage across repeated invocations in one Lambda environment. If <code>Max Memory Used</code> keeps climbing, it's worth finding out why before leaving that code running for days.</p>

        <h2 id="promise-4-the-outside-world-saw-a-different-you">Promise 4: The outside world saw a different you</h2>

        <p>Our code barely changed in the migration, so it's easy to consider that you are the same client for the upstream services. On Lambda, in our setup, the calls to upstream came from at least three source addresses, and if a call failed, Lambda retried the whole invocation. After the migration, the same calls came from a couple of pods running many deliveries at once, and retries were up to us.</p>

        <p>While moving customers over, calls to one of our internal services started failing with <code>ServerDisconnectedError</code>, signalling that the connection closed before we got a response. Our first thought was to add retries, these looked like occasional disconnects.</p>

        <p>We tried moving customers back and forth between Lambda and the service, and found the errors appeared only once more than half were on the service. Lambda didn't show any errors at any split.</p>

        <p>When we looked at the code, the client created a new <code>aiohttp.ClientSession</code> for every call:</p>

        <pre><code className="language-python" dangerouslySetInnerHTML={{ __html: Prism.highlight("async with aiohttp.ClientSession() as session:\n    async with session.post(url, json=payload) as resp:\n        ...", Prism.languages.python, 'python') }} /></pre>

        <p>Each call opened a fresh connection, with no shared pool to reuse connections or limit their number. We first suspected we were opening too many. We switched to one <code>ClientSession</code> per process, with a pool limited to 25 connections, and added retries with backoff. Both changes shipped together, and the errors stopped.</p>

        <p>The pool change went in before we moved the blocking calls to threads. Looking at the upstream configuration afterwards, our best explanation is that the event-loop blocking also affected how quickly we sent requests. The upstream was a Go <code>net/http</code> server with a 10-second <code>ReadHeaderTimeout</code>. A TCP connection could be established while the client’s event loop was busy with other deliveries. If those deliveries kept it busy for more than 10 seconds before it could send the headers, the upstream would close the connection.</p>

        <p>The timing changes when a connection is reused. On an idle HTTP/1 connection, Go doesn’t start the header timeout until the first bytes of the next request arrive. So a delay before sending anything doesn’t eat into that timeout the way it would on a new connection. You can see this in <a href="https://go.dev/src/net/http/server.go" target="_blank" rel="noopener noreferrer">Go’s server implementation</a>.</p>

        <p>I reproduced this locally against a Go server, using a shorter, two-second timeout. Blocking the loop for three seconds after connecting caused a disconnect; reusing an established connection after the same delay succeeded. A local load test also produced failures with a session per call and none with a shared session. We haven't confirmed that this was the cause in production, but it fits the configuration and the behaviour we observed.</p>

        <p>The retries let us recover from transient failures without repeating the whole delivery. That was safe here because the call was a read-only search.</p>

        <p>Before migrating, check whether HTTP clients reuse connections, what limits their pools have and when the upstream starts its timeouts. Test the HTTP calls as part of the full handler, with the concurrency you expect in production. Also check whether the network path or source addresses will change, especially if the upstream uses per-IP limits or allowlists.</p>

        <p>Also check your Lambda logs for deliveries that failed but eventually succeeded when Lambda retried the invocation. The service won't give you that by default, so if you relied on it, add retries where the call is made.</p>

        <h2 id="how-to-make-it-reliable">How to make it reliable</h2>

        <p>Local testing is the obvious first step. The e2e tests we started with passed, including concurrent deliveries, so it's worth also testing the conditions that changed with the runtime.</p>

        <p>For Python, you can run the service under load with <a href="https://docs.python.org/3/library/asyncio-dev.html" target="_blank" rel="noopener noreferrer">asyncio debug mode</a> enabled and the same liveness probes you intend to use in production.</p>

        <p>Also ensure that you allocate enough time for the service to run and potentially expose some quirks. Our memory problem took one to two days to show up, so a few hours in staging wouldn't have been enough. Leave the service running with traffic comparable to prod and watch its memory and error logs over time. How long to do this depends on the workflow and how expensive a failure would be to recover from.</p>

        <p>A good thing is to also test what happens at the boundaries: queues, databases, upstream services and anything providing credentials. Simulate dropping connections or making responses take longer. See what happens when the same work arrives again.</p>

        <p>For queues, it can be a DLQ replay. For us, usual traffic never filled the prefetch buffer, but replay filled it immediately. Don't wait until you need a production replay to find out whether the service can handle it.</p>

        <p>For credentials that rotate periodically, trigger a rotation during the test and check that the service can open new connections afterwards. Also check reconnecting after an existing connection is lost.</p>

        <p>For upstream services, try slow responses, timeouts and failed calls. You can use something like Shopify's Toxiproxy for this. It sits between the service and a dependency, allowing you to add latency or cut connections during a test. A pod killed during a delivery is another useful case, especially after it has written to a database but before it has acknowledged the message. Check what gets repeated on the next attempt and whether the result is still correct.</p>

        <p>For the rollout, shadowing lets you send a copy of real traffic to the new system while the old one is also running. You can compare their outputs before relying on the new system, but it means twice as much work. For consumers like ours, which write to databases, we would also need new databases. Providing this infrastructure surely involves more coordination and hence more time, as well as more cost.</p>

        <p>A canary rollout doesn't require that. At any given moment, you will still have the same amount of total traffic. It will just be distributed between the old and new systems. You move part of the traffic over, watch its behaviour and move it back if needed. That's the approach we used.</p>

        <p>A canary doesn't have to use an off-the-shelf tool. A small implementation can be enough, especially when you only need it for the migration. Our routing was controlled by a config file in S3. It mapped customers to pipelines and consumers, so one customer could use pipeline A with consumers A and B, while another used pipeline B with consumers C and D. For our rollout, controlling which pipeline processed each delivery was enough. If traffic assigned to the old system must never reach the new service, the routing decision needs to happen upstream, before that traffic enters the service.</p>

        <h2 id="lambda-as-a-runtime-contract">Lambda as a runtime contract</h2>

        <p>This post is not a pitch against Lambda, it kept its promises. The trouble only started when we moved to services.</p>

        <p>This migration simply highlighted that Lambda is a runtime contract, not just a deployment target. Concurrent deliveries had separate memory and filesystems, and each environment had its own pools and caches. Lambda handled retries for asynchronous invocations. In our case, environments were also recycled before the memory growth or monthly credential rotation caused visible problems. Most of this is documented somewhere –&nbsp;<a href="https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html" target="_blank" rel="noopener noreferrer">the filesystem and memory isolation</a>, even the Lambda retries. Some of it isn't, like your environment getting its own pools and caches. But none of it is gathered into the one list that matters – the set of guarantees your code is&nbsp;<a href="https://www.hyrumslaw.com/" target="_blank" rel="noopener noreferrer">quietly relying on</a>.</p>

        <p>Code written under that contract can rely on it, ignoring many best practices. The reliance shows up as missing code, and when the contract changes, the absences become bugs.</p>

        <p>The <a href="https://www.joelonsoftware.com/2002/11/11/the-law-of-leaky-abstractions/" target="_blank" rel="noopener noreferrer">Law of Leaky Abstractions</a> says what's underneath your abstraction eventually shows through. With Lambda, it went the other way. Our bugs disappeared into the runtime. Lambda gave us fewer reasons to look at these parts of the code, but they still needed attention.</p>

        <p>Before migrating, list what the current runtime provides out of the box for your code. Then check those assumptions against the new runtime to see what needs to change. Appendix A puts the checks from the four promises into one list.</p>

        <p>Most of the handler code had run on Lambda for years and moved over unchanged. We should have reused the engines on Lambda too, but the memory growth only caused restarts once we moved to services. We also had to lower prefetch because all the deliveries running in a pod now had to fit within its memory limit.</p>

        <h2 id="appendix-a-checklist">Appendix A: Checklist</h2>

        <div className="table-container" style={{ overflowX: 'auto', margin: '2.5rem 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
            <thead>
              <tr>
                <th scope="col" style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Promise</th>
                <th scope="col" style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>What to check</th>
                <th scope="col" style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>How</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Blocking only hurt the caller</td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Sync calls inside async handlers, including drivers, SDKs and pandas work</td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Enable asyncio debug mode and run a load test with liveness probes enabled.</td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Every delivery had the place to itself</td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Memory needed for a large delivery</td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>For a large first invocation in a fresh environment, subtract memory after init from <code>Max Memory Used</code>. Validate the estimate in the service.</td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}></td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Shared paths in <code>/tmp</code></td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Look at how files and directories are named. Try processing two copies of the same event at once.</td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}></td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Duplicate deliveries</td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Log the event ID once per invocation, then look for IDs that appear more than once.</td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Nothing lived long enough to go bad</td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Engines, clients and sessions created per delivery</td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Find where they're created, including inside internal libraries. See which ones could be kept and reused.</td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}></td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Credentials, tokens, signed URLs and certificates</td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Find their expiry times and how the service gets replacements.</td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}></td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Memory between deliveries</td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Log memory before each invocation. Follow one Lambda log stream to see whether it keeps growing.</td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>The outside world saw a different you</td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>HTTP sessions and connection limits</td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Count the sessions per process and check how many connections each pool allows.</td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}></td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Source addresses</td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Find out which addresses the upstream sees. Check any per-IP limits or allowlists against those addresses.</td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}></td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Retries outside the handler</td>
                <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>Look up the trigger's retry settings. Check logs for event IDs that failed and later succeeded.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 id="appendix-b-why-we-migrated">Appendix B: Why we migrated</h2>

        <ul>
          <li>Deployment consistency. The rest of the platform was already on k8s, and the Lambdas were the only part we released differently, which meant keeping a second setup working in every environment and region.</li>
          <li>Cognitive load. We had seven Lambdas and an orchestration between them, and tracing what happened to one event took more effort than the actual work the system was doing. New devs couldn't catch up quickly and required more time to internalize the system.</li>
          <li>Non-functional bottlenecks. The data grew, and for some functionality, Lambda's cap of 15 minutes wasn't enough. We found ourselves trying to work around that, and although it was possible, we didn't want to think about non-functional limits like this.</li>
        </ul>

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
