---
name: API no-cache setup
description: Express sends ETags by default causing 304 stale responses; disable ETag and add no-store header for all API routes.
---

Express 5 generates ETag headers automatically. Once a browser caches a `[]` response for an API endpoint, subsequent requests return 304 Not Modified even after data changes — because the browser sends `If-None-Match` and Express compares ETags.

**Why:** During development/testing the blog list showed stale empty data even after posts were created, because the browser had cached the initial empty-array response.

**How to apply:** In `server/index.ts`, immediately after creating the Express app:
```typescript
app.set("etag", false);
```

In `server/routes.ts`, add a no-store middleware for all `/api` routes:
```typescript
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  next();
});
```

Also set `cache: 'no-store'` in frontend fetch calls and `staleTime: 0` in React Query hooks for dynamic data.
