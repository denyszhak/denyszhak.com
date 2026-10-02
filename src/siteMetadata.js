export const siteUrl = 'https://www.denyszhak.com';

export const routeMetadata = [
  {
    path: '/',
    title: 'Denys Zhak | Software Engineer',
    description: 'Software engineer working on distributed systems, production reliability, and ML infrastructure. Writing and open-source work by Denys Zhak.',
    image: '/photo.jpg',
    imageAlt: 'Denys Zhak',
    type: 'website',
    twitterCard: 'summary',
  },
  {
    path: '/writing',
    title: 'Writing | Denys Zhak',
    description: 'Production engineering notes on distributed systems, serverless runtimes, Python tooling, and open-source development.',
    image: '/photo.jpg',
    imageAlt: 'Denys Zhak',
    type: 'website',
    twitterCard: 'summary',
  },
  {
    path: '/writing/what-aws-lambda-was-hiding',
    title: 'What AWS Lambda was hiding | Denys Zhak',
    description: 'Eight production lessons from moving seven Python ingestion Lambdas into services, and the runtime contract the migration exposed.',
    image: '/lambda-migration-oom.png',
    imageAlt: 'Memory usage during a dead-letter queue replay after migrating from AWS Lambda',
    type: 'article',
    twitterCard: 'summary_large_image',
  },
  {
    path: '/writing/how-a-python-type-checker-decides-a-variable-is-unused',
    title: 'How a Python type checker decides a variable is unused | Denys Zhak',
    description: 'How ty tracks Python bindings and reads across nested scopes to decide which unused variables an editor should dim.',
    image: '/unused-variable.png',
    imageAlt: 'VS Code showing an unused Python binding dimmed by ty',
    type: 'article',
    twitterCard: 'summary_large_image',
  },
  {
    path: '/writing/a-checkpoint-in-the-middle-of-an-insert',
    title: 'A Checkpoint in the Middle of an INSERT | Denys Zhak',
    description: 'A case study of a suspended INSERT, checkpoint cursor invalidation, and guards that survive I/O pauses in Turso.',
    image: '/turso-reproducer.png',
    imageAlt: 'Terminal showing a paused INSERT panicking after a checkpoint on the same Turso connection',
    type: 'article',
    twitterCard: 'summary_large_image',
  },
  {
    path: '/open-source',
    title: 'Open source | Denys Zhak',
    description: "Open-source work by Denys Zhak across Astral's ty and Ruff, Docker Model Runner, GPU inference backends, and developer tooling.",
    image: '/photo.jpg',
    imageAlt: 'Denys Zhak',
    type: 'website',
    twitterCard: 'summary',
  },
];

const normalizePath = (pathname) => {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/$/, '');
};

export const getRouteMetadata = (pathname) => {
  const normalizedPath = normalizePath(pathname);
  return routeMetadata.find((route) => route.path === normalizedPath) ?? routeMetadata[0];
};

export const absoluteUrl = (path) => new URL(path, siteUrl).href;
