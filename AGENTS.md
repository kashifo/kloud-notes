# AGENTS.md

## Instructions

- Read `PROJECT_CONTEXT.md` before making changes.
- Treat `PROJECT_CONTEXT.md` as the single source of truth for project context and understanding. Update it when you change code.
- Treat `docs/INITITAL_PLAN.md` as archived initial planning context only.
- Use `docs/FINDINGS.md` for known issues and review notes.
- Keep docs aligned when behavior, file ownership, or environment variables change.
- Always run `pnpm typecheck` before `pnpm build`.

## Commit Message Format

When generating commit messages, use a clear title followed by a brief bulleted list covering everything that changed:

```text
Title summarizing the overall update

- Brief bullet point explaining change 1
- Brief bullet point explaining change 2
- Brief bullet point explaining change 3
```