<div align="right">

**中文** | [English](README.md)

</div>

# NaviKB Workbench

**[NaviKB](https://github.com/Laurent00TT/navikb)** 的一个小型 Web 工作台
（React + Vite）—— 浏览文档库、查看导航与证据、跑搜索、通过 UI 上传 PDF，
而不必直接调 API。

> 🔬 **研究 / 示例，早期 alpha。** 这是 NaviKB core 的配套 UI。它是 core 的
> `/ui/api` 面的*薄 HTTP 客户端* —— 不共享代码、自己也没有后端。没有运行中的
> core 它什么都做不了；没有它，core 也能完全 headless 运行。

## 工作方式

工作台是一个静态 React SPA，通过 HTTP 调用运行中的 NaviKB core：

- 调用 core 的 `/ui/api/*` 和 `/ingestion/*`（默认 `http://127.0.0.1:8000`），
  带 `Authorization: Bearer <token>` 头。
- 所有状态都在 core；工作台只持有 auth token（存 `localStorage`）。

## 快速开始

需要 Node 20+ 和一个运行中的 NaviKB core（见
[core 仓库](https://github.com/Laurent00TT/navikb)）监听在 `:8000`。

```bash
npm ci
npm run dev          # Vite dev server，http://127.0.0.1:5173/ui/
                     # 其 proxy 把 /ui/api + /ingestion 转发到 core
```

登录用的 user token 在 **core** 侧创建 —— 明文只在创建时显示一次，
请存入密码管理器：

```bash
# 在 core 仓库内执行
python scripts/manage_users.py create <username> --role admin
```

用 `KB_UI_API_TARGET` 指向非默认 core：

```bash
KB_UI_API_TARGET=http://127.0.0.1:9000 npm run dev
```

构建静态产物并跑测试：

```bash
npm run build        # 英文-only UI lint + 类型检查 + vite build → dist/
npm run test         # vitest
```

把 `dist/` 部署到任意静态托管，或放到 core 的 `web/dist` 让 core 在 `/ui` 提供它。

## 技术栈

React 19 · Vite 7 · TypeScript · Vitest。无应用后端。UI 刻意保持英文-only
（构建时守卫拒绝 `src/` 里的 CJK）。

## 贡献与安全

这个 UI 跟随 core。贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md)；安全报告见
[SECURITY.md](SECURITY.md)。设计与协议问题通常应在
[core 仓库](https://github.com/Laurent00TT/navikb)讨论。

## License

Apache-2.0，与 core 相同。见 [LICENSE](LICENSE)。
