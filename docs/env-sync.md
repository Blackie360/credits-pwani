# Environment variables sync with Vercel

To ensure `.env.local` matches Vercel project environment variables:

```bash
pnpm env:pull
```

This runs `vercel env pull .env.local` and fetches all env vars from your linked Vercel project into `.env.local`.

**Prerequisites:**
- [Vercel CLI](https://vercel.com/docs/cli) installed (`npm i -g vercel`)
- Project linked to Vercel (`vercel link` if not already)
