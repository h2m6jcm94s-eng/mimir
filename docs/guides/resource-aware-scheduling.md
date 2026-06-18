# Resource-aware scheduling

F-042 Phase 1 adds lightweight agency-style resource scheduling to Mimir.

## Concepts

- **Project** — a piece of client work with a deadline, status, and estimated hours.
- **Resource** — a person or role with a weekly capacity in hours.
- **Schedule assignment** — an allocation of a resource to a project for a specific week.
- **Utilization** — capacity vs. allocated hours per week, with over-allocation detection.

## Data model

Postgres tables are tenant-scoped with RLS enforced by `mimir_app`:

- `project`
- `resource`
- `schedule_assignment`

See `apps/api/src/db/migrations/0036_scheduling.sql` and `apps/api/src/db/schema/scheduling.ts`.

## API

All routes live under `/v1/scheduling` and require `scheduling:read` / `scheduling:write` scopes.

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/projects` | List projects, optional `status` filter |
| POST   | `/projects` | Create a project |
| PATCH  | `/projects/:id` | Update a project |
| DELETE | `/projects/:id` | Delete a project |
| GET    | `/resources` | List resources |
| POST   | `/resources` | Create a resource |
| PATCH  | `/resources/:id` | Update a resource |
| DELETE | `/resources/:id` | Delete a resource |
| GET    | `/assignments` | List assignments, optional `weekStarting`, `projectId`, `resourceId` filters |
| POST   | `/assignments` | Create an assignment |
| PATCH  | `/assignments/:id` | Update an assignment |
| DELETE | `/assignments/:id` | Delete an assignment |
| GET    | `/utilization?weekStarting=YYYY-MM-DD` | Weekly capacity/allocated/remaining summary |

## Web UI

Open `/scheduling` in the PWA. The page has four tabs:

1. **Projects** — add and manage client projects.
2. **Resources** — add team members and set weekly capacity.
3. **Schedule** — assign resources to projects by week.
4. **Utilization** — see total capacity, allocated hours, remaining hours, and per-resource breakdown.

Rows highlighted in red indicate over-allocation for the selected week.

## Future work

Phase 2 may add AI-assisted auto-scheduling, conflict resolution, project timeline visualizations, and calendar/ICS exports.
