<div align="right">

**English** | [中文](README.zh.md)

</div>

# NaviKB Workbench

A small web workbench (React + Vite) for
**[NaviKB](https://github.com/Laurent00TT/navikb)** — browse your document
library, inspect navigation and evidence, run searches, and upload PDFs through
a UI instead of the raw API.

> 🔬 **Research / example, early alpha.** This is the companion UI to the NaviKB
> core. It is a *thin HTTP client* of the core's `/ui/api` surface — there is no
> shared code and no backend of its own. It does nothing without a running core
> to talk to, and the core runs fully headless without it.

## How it works

The workbench is a static React SPA that calls a running NaviKB core over HTTP:

- It calls `/ui/api/*` and `/ingestion/*` on the core (default
  `http://127.0.0.1:8000`), sending an `Authorization: Bearer <token>` header.
- All state lives in the core; the workbench holds only the auth token
  (in `localStorage`).

## Quickstart

You need Node 20+ and a running NaviKB core (see the
[core repo](https://github.com/Laurent00TT/navikb)) listening on `:8000`.

```bash
npm ci
npm run dev          # Vite dev server at http://127.0.0.1:5173/ui/
                     # (its proxy forwards /ui/api + /ingestion to the core)
```

Point at a non-default core with `KB_UI_API_TARGET`:

```bash
KB_UI_API_TARGET=http://127.0.0.1:9000 npm run dev
```

Build a static bundle and run the tests:

```bash
npm run build        # English-only UI lint + typecheck + vite build → dist/
npm run test         # vitest
```

Serve `dist/` from any static host, or place it at the core's `web/dist` to
have the core serve it at `/ui`.

## Tech

React 19 · Vite 7 · TypeScript · Vitest. No application backend. The UI is
intentionally English-only (a build-time guard rejects CJK in `src/`).

## Contributing & security

This UI tracks the core. For the contribution model see
[CONTRIBUTING.md](CONTRIBUTING.md); for security reporting see
[SECURITY.md](SECURITY.md). Design and protocol questions usually belong on the
[core repo](https://github.com/Laurent00TT/navikb).

## License

Apache-2.0, same as the core. See [LICENSE](LICENSE).
