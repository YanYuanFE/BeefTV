# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Project conventions, architecture, layering, API/state contracts and verification rules live in AGENTS.md — follow it:

@AGENTS.md

## Commands

Frontend (`web/`, Bun only — never npm/pnpm):

```bash
bun install --frozen-lockfile
bun run dev                 # Vite on :3000 (don't start unless asked)
bun run typecheck           # tsc --noEmit
bun run build               # typecheck + vite build
bun run lint                # only bans antd / @ant-design/* / react-aria-components imports
bun run test                # scripts/run-test-suite.mjs: shared run + isolated run for files touching browser globals
bun test test/<file>.test.ts   # single test file
bun test test/<file>.test.ts -t "<name>"   # single test case
```

Backend (`backend/`, Go 1.25):

```bash
sh ../plugin-packages/build-packages.sh   # CI runs this before go test
go test ./...
go test ./internal/<pkg> -run TestName    # single test
CANVAS_BACKEND_DATA_DIR=../.local/project-workbench-debug go run ./cmd/server
```

Desktop (Wails, entry `backend/cmd/desktop`):

```bash
./scripts/framely-shared-dev.sh           # Vite + `wails dev` together
./scripts/update-local-framely-app.sh     # only way to update /Applications/Framely.app
BEEFTV_GO_DIR=/path/to/go ./scripts/build-framely-release.sh
BEEFTV_GO_DIR=/path/to/go ./scripts/verify-framely-local-release.sh
```

Docs site (`docs/`): `bun run types:check` or `bun run build`.

CI (`.github/workflows/quality.yml`) runs web lint + typecheck + test and backend `go test ./...`.

## Further reading

- `docs/local-first-architecture.md` — local capability contract and release gates
- `docs/desktop-local-development.md`, `docs/desktop-release.md` — desktop dev/release, data dirs
- `docs/content/docs/backend/code-map.mdx`, `http-api.mdx`, `backend-database.mdx` — backend map, error codes, schema
