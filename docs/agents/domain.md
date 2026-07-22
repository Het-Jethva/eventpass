# Domain Docs

This repository uses a single-context domain-document layout.

## Before exploring

- Read the root `CONTEXT.md` when it exists.
- Read ADRs under `docs/adr/` that affect the area being changed.
- Proceed silently when a domain document is absent.

## Use the glossary vocabulary

Use terms exactly as defined in `CONTEXT.md` in issue titles, implementation plans, interfaces, tests, and user-facing domain language. Avoid synonyms the glossary explicitly rejects. A missing term may indicate either vocabulary drift or a genuine domain-model gap.

## Respect ADRs

Surface any conflict with an existing ADR explicitly rather than silently overriding it.

## Layout

```text
/
├── CONTEXT.md
└── docs/
    └── adr/
```
