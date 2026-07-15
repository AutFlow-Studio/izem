---
name: AutFlow Studio setup
description: Full-stack agency OS — key architectural decisions, bug patterns, and bootstrap facts worth remembering across sessions.
---

## Bootstrap facts
- Login credentials: `admin@autflow.io` / `admin123`
- DB tables (12): clients, projects, deliverables, payments, documents, notes, meetings, tasks, activity, users, settings, notifications
- Codegen command: `pnpm --filter @workspace/api-spec run codegen` (runs orval + typecheck:libs)

## Architecture
- Monorepo: pnpm workspaces
- Frontend: `artifacts/autflow-studio` (React + Vite)
- API: `artifacts/api-server` (Express 5)
- DB schema: `lib/db/src/schema/` — each domain has its own file, all exported from `index.ts`
- API spec → codegen pipeline: `lib/api-spec/openapi.yaml` → `lib/api-client-react/src/generated/api.ts` + `lib/api-zod/src/generated/api.ts`
- `lib/api-client-react/src/index.ts` must NOT have duplicate export lines (codegen used to add them twice; keep only 4 lines)

## Notification system (completed)
- `lib/db/src/schema/notifications.ts` — notificationsTable with: id, type, title, message, entityType, entityId (nullable), href (nullable), isRead (bool), createdAt
- `artifacts/api-server/src/lib/createNotification.ts` — fire-and-forget helper; always `void`-cast the call so route errors don't propagate
- `artifacts/api-server/src/routes/notifications.ts` — 5 endpoints (GET list, GET unread-count, PATCH :id/read, POST mark-all-read, DELETE :id)
- Notification-emitting routes: clients POST, projects POST + PATCH (status), payments POST + PATCH (status=paid), tasks POST + PATCH (status=done), documents POST
- Frontend bell icon: uses `useListNotifications` (refetchInterval 30s), `useMarkNotificationRead`, `useMarkAllNotificationsRead`, `useDeleteNotification`
- Query invalidation pattern: pass `invalidateNotifications` as `onSuccess` callback to each mutation's `mutate()` call
- Pass `queryKey: getListNotificationsQueryKey()` inside the `query:` option to satisfy TypeScript (React Query v5 requires it)

## Known pre-existing TS errors (not introduced by notification work)
- `src/pages/clients/index.tsx` — `Cannot find name 'Users'`
- `src/pages/documents/index.tsx` — `ListClientsResponseItem` not exported
- `artifacts/api-server/src/lib/objectStorage.ts` — `signed_url` property type
- `index.css` color tokens all set to `red` (placeholder, deferred task)
- GCS storage credentials not configured — document uploads fail silently
