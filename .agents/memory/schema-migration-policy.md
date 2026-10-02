---
name: Managed schema migration policy
description: How schema changes are verified without running automatic production DDL.
---

Use the schema source plus a disposable fresh-database migration rehearsal for
verification. For the existing Replit-managed database, apply the reviewed
development schema diff and use the Publish-time migration flow; never add a
startup migration script or silently run production DDL.

**Why:** Replit-managed production changes must remain operator-reviewed, while
fresh-database coverage still catches missing tables, constraints, and seed
assumptions.

**How to apply:** Keep destructive renames backed up and explicit, and document
which checks cover the fresh schema versus the already-migrated development
database.