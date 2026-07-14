# Meal drafts (`dish_status = draft`)

## Goal
One-page meal create form; Save draft with name-only requirement; Meals tabs Active | Inactive | Drafts; resume draft on another device (phone photos later).

## Status model
`dish_status`: `active | inactive | draft`
- Public browse: `active` only
- List tabs: Active / Inactive / Drafts (use "Inactive", not "Paused")

## API
- `POST /api/business/dishes` with `status: "draft"` — name required; price optional (default placeholder or nullable handling); allergens/ingredients/photos optional
- Publish: create with `active` or PATCH draft → `active` with full validation
- `GET ?status=draft` lists drafts

## UI
- `/business/listings/dishes/new` — single scroll form; Save draft + Create meal
- Draft click → edit page prefilled; Delete from ⋮
- Create meal guards unchanged; draft only needs name

## Tests
Draft create, list filter, not public, delete, publish gates
