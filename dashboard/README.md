# Analyst Dashboard

The dashboard is a Next.js 14 app. Use Node.js 20.

## Production build

From the repository root:

```bash
cd dashboard
npm ci
npm run build
```

The build produces `dashboard/out`, which FastAPI serves at `/`. The existing
frontend remains available at `/legacy`.

## Development

Start the backend in one terminal:

```bash
cd backend
uvicorn main:app --port 8000
```

Then start the dashboard in another:

```bash
cd dashboard
npm run dev
```

Next.js runs at [http://localhost:3000](http://localhost:3000) and proxies
`/api/*` requests to `http://localhost:8000/api/*` while the backend is running.

## Checks

Run from `dashboard/`:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
