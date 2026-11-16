// Newest first: the writing list and the homepage's recent posts read this order.
export const postCategories = ['all', 'work', 'open source'];

export const posts = [
  {
    date: '2026-09-12',
    title: 'A Checkpoint in the Middle of an INSERT',
    slug: 'a-checkpoint-in-the-middle-of-an-insert',
    category: 'open source',
    tags: ['Turso', 'database internals', 'Rust'],
    tagline: 'How a checkpoint invalidated an unfinished INSERT’s cursor in Turso.',
  },
  {
    date: '2026-08-12',
    title: 'How a Python type checker decides a variable is unused',
    slug: 'how-a-python-type-checker-decides-a-variable-is-unused',
    category: 'open source',
    tags: ['Python', 'LSP', 'ty'],
    tagline: 'ty tracks reads across Python scopes to decide which local bindings your editor should dim.',
  },
  {
    date: '2026-07-07',
    title: 'Runtime Promises - What AWS Lambda Was Hiding',
    slug: 'what-aws-lambda-was-hiding',
    category: 'work',
    tags: ['distributed systems', 'serverless'],
    tagline: "A class of bugs Lambda's runtime had been quietly absorbing. The migration to long-running services exposed them.",
  },
];
