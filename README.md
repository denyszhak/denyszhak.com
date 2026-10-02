# denyszhak.com

My personal site. Posts on systems engineering, observability, ML, and open source.

Live at [denyszhak.com](https://denyszhak.com).

## Stack

- [Vite](https://vitejs.dev) + React
- Deployed on [Vercel](https://vercel.com)
- View / like tracking via [Upstash Redis](https://upstash.com)
- Newsletter via [Buttondown](https://buttondown.email)

## Local development

```bash
npm install
npm run dev
```

For the API routes (view tracking, subscribe), use `vercel dev` instead — `npm run dev` only runs the Vite frontend without serverless functions.

Required environment variables in `.env` (see `.env.example`):

- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- `BUTTONDOWN_API_KEY`
