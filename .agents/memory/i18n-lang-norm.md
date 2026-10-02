---
name: i18n language normalization
description: i18n.language returns locale codes like "en-US" not "en"; always normalize before using as a DB filter.
---

The `i18next-browser-languagedetector` uses `navigator.language` which returns full locale codes like `"en-US"`, `"ar-SA"`, etc. The i18next resources are keyed as `"en"` and `"ar"`, so translations resolve correctly, but `i18n.language` itself returns the full locale.

**Why:** Blog posts are stored in DB with `language: "en"` or `"ar"`. Filtering by `lang=en-US` returns `[]` because no post matches the full locale string.

**How to apply:** Whenever `i18n.language` is used as a DB query parameter or passed to a backend API, normalize it first:
```typescript
const lang = i18n.language.split("-")[0]; // "en-US" → "en"
```
Applied in `Blog.tsx`. Apply the same pattern in any future page that filters content by language.
