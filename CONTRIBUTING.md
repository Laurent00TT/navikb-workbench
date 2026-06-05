# Contributing to NaviKB Workbench

The workbench is the companion UI to the
[NaviKB core](https://github.com/Laurent00TT/navikb), and it is **early-alpha
research / example** code. The most useful contributions right now:

- **🐛 Issues** — UI bugs, confusing flows, or a mismatch between what the
  workbench shows and what the core's `/ui/api` actually returns.
- **🧪 Reproducible setups** — a note on running the workbench against a core on
  a clean machine.

Before opening a UI feature PR, please open an issue first. The UI surface
tracks the core's `/ui/api` contract, so changes are usually best discussed
against that contract.

Ground rules:

- The UI is **English-only** — `npm run lint:no-cjk` enforces it.
- `npm run build` (English-only lint + typecheck + build) and `npm run test`
  must pass.
- Be kind — see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
