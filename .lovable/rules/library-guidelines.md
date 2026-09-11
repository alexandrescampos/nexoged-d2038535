# Nexo GED — Guidelines

## Components

The design system exports these components — import them from `@ws-ulqt02i4xcbvtpa7lnaz/23a8482d-7fb8-439b-b093-e64529cf2e70` and compose them before building anything from scratch:

`ApiIntegrationSettings`, `DashboardLayout`, `DocumentTypesSettings`, `OrganizationCnpjs`, `OrganizationDataExport`, `SuperAdminLayout`, `UserAuditLog`

Per-component details (import stanzas, props, variants, examples) live in `.lovable/rules/libraries/{slug}/components.md` — on disk, not auto-loaded. Read that file or the component source when the name alone isn't enough.

## Theme Files

The design system's theme is delivered through the following files. The author's original source files carry the full wiring the design system needs — variable declarations, framework-specific directives, provider objects, etc. — and are the canonical import target.

- `@ws-ulqt02i4xcbvtpa7lnaz/23a8482d-7fb8-439b-b093-e64529cf2e70/index.css` (source — preferred import)
- `@ws-ulqt02i4xcbvtpa7lnaz/23a8482d-7fb8-439b-b093-e64529cf2e70/lib/themes` (source — preferred import)
- `@ws-ulqt02i4xcbvtpa7lnaz/23a8482d-7fb8-439b-b093-e64529cf2e70/dist/tokens.css` (auto-generated flat list of CSS custom properties — a raw-values fallback only; does NOT carry framework-specific wiring that the source files above provide)

