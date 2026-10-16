# AGENTS.md — GoClaw/openclaw

> Guía para agentes que trabajan en este repo. Las guías originales de upstream (OpenClaw), completas
> y sin recortar, están en [`.agents/UPSTREAM_GUIDELINES.md`](.agents/UPSTREAM_GUIDELINES.md): léelas antes
> de tocar canales, docs, apps móviles/macOS, releases o dependencias parcheadas.
> Lo marcado **por confirmar** no se pudo verificar en el código ni en GitHub.

## 1. Qué es

- **Fork de [OpenClaw](https://github.com/openclaw/openclaw)** (`openclaw/openclaw`), el asistente de IA personal
  *local-first*: un **Gateway** con plano de control WebSocket (puerto 18789) que conecta un agente (runtime Pi)
  con canales de mensajería (WhatsApp vía Baileys, Telegram, Slack, Discord, Signal, iMessage, Teams, Matrix…),
  apps (macOS/iOS/Android), navegador por CDP, cron, skills y memoria.
- **Para quién / para qué**: GoClaw usa este fork como **backend de agentes** de su propio producto. Un
  dashboard/backend de GoClaw (en los commits aparece también como «GoCrawl») se conecta a cada gateway por WS
  con token compartido y lo maneja por RPC: muestra memoria («Knowledge»), chat con capturas del navegador,
  crea skills y vincula WhatsApp. Ese dashboard **no vive en este repo** (repo y ubicación: por confirmar).
- **Lo que añade el fork** (14 commits de Jonatan Vazquez sobre upstream `e426a9bb6fe`, feb-2026):
  - RPC de memoria: `memory.status`, `memory.files`, `memory.read`, `memory.write` → `src/gateway/server-methods/memory.ts`.
  - `skills.create` → `src/gateway/server-methods/skills.ts`; `chat.inject` pasa a método de escritura (operator).
  - `chat.history` con `includeMedia=true` conserva imágenes base64 → `src/gateway/server-methods/chat.ts`.
  - WhatsApp por **código de emparejamiento** (además de QR): `web.login.pairingCode.start` →
    `src/gateway/server-methods/web.ts`, `src/web/login-qr.ts`, `src/web/session.ts`, `extensions/whatsapp/src/channel.ts`.
  - Gestión de emparejamiento de canales: `channels.pairing.list|approve|reject`, `channels.allowFrom.list|add|remove`
    → `src/gateway/server-methods/channel-pairing.ts`, `src/pairing/pairing-store.ts`.
  - Auth por secreto compartido **conserva los scopes** pedidos aunque no haya identidad de dispositivo
    (servidor a servidor) → `src/gateway/server/ws-connection/message-handler.ts`.
  - Docker con navegador: `chromium` + `xvfb` del sistema (`--build-arg OPENCLAW_INSTALL_BROWSER=1`) y
    `scripts/container-entrypoint.sh` que arranca Xvfb; `src/browser/chrome.ts` limpia locks de Chrome.
- **Estado**: el último commit en `main` es del **2026-02-20**; upstream sigue activo (va ~8 meses por delante).
  Versión en `package.json`: `2026.2.18`. CI del fork sin pasar: `CI` siempre cancelado y `Docker Release`
  falla (ver §4). ¿Se sigue usando en producción? **por confirmar**.

## 2. Mapa del repo

| Ruta | Qué hay |
|---|---|
| `src/gateway/` | Gateway WS: `server-methods/*.ts` (handlers RPC), `server-methods-list.ts` (métodos anunciados), `server-methods.ts` (scopes/escritura), `protocol/schema/*.ts` (esquemas TypeBox) |
| `src/web/`, `extensions/whatsapp/` | WhatsApp Web (Baileys): login QR / código, sesión |
| `src/channels`, `src/routing`, `src/pairing` | Lógica común de canales, ruteo, allowlists y emparejamiento |
| `src/telegram`, `src/discord`, `src/slack`, `src/signal`, `src/imessage`, `src/line` | Canales núcleo |
| `extensions/*` | Plugins (canales, memoria, auth de proveedores…), paquetes del workspace pnpm |
| `src/agents`, `src/memory`, `src/browser`, `src/cron`, `src/cli`, `src/commands`, `src/infra` | Agente, memoria, navegador CDP, cron, CLI |
| `ui/` | Control UI web (Vite) · `apps/` macOS/iOS/Android · `packages/` shims `clawdbot`/`moltbot` |
| `skills/` | Skills del agente · `.agents/skills/` skills de mantenimiento (review/prepare/merge PR, mintlify) |
| `docs/` | Docs Mintlify (docs.openclaw.ai); `docs/zh-CN/**` es generado |
| `Dockerfile`, `docker-compose.yml`, `scripts/container-entrypoint.sh` | Imagen y arranque en contenedor |
| `fly.toml`, `render.yaml` | Plantillas de despliegue de upstream (no hay evidencia de que GoClaw las use) |
| `.github/workflows/` | `ci.yml`, `docker-release.yml`, `install-smoke.yml`, `labeler.yml`, `stale.yml`… |

## 3. Cómo correrlo y probarlo

- Node **≥ 22.12**, **pnpm 10.23** (`packageManager`); Bun también soportado.
- Instalar: `pnpm install` (en un worktree nuevo no hay `node_modules`).
- Typecheck: `pnpm tsgo` (binario de `@typescript/native-preview`). Build completo: `pnpm build` (pesado).
- Lint/formato: `pnpm check` (= `format:check` + `tsgo` + `lint`); `pnpm lint` (oxlint), `pnpm format:check`,
  `pnpm format` (**escribe**: es `oxfmt --write`, no `--check`).
- Pruebas: `pnpm test` (todo, en paralelo), `pnpm test:fast` (unit), `pnpm test:e2e`, `pnpm test:coverage`
  (umbral 70 %). Una sola: `pnpm vitest run <ruta>.test.ts`. Live (claves reales): `pnpm test:live`.
- Si tocas esquemas de protocolo: `pnpm protocol:check` (regenera `dist/protocol.schema.json` y los modelos Swift).
- Dev: `pnpm openclaw …`, `pnpm gateway:watch`, `pnpm ui:build`.
- 🚦 En la granja, todo lo pesado va por la cola:
  `turno correr --prio 3 --etiqueta tsgo-goclaw -- nice -n 15 pnpm tsgo`. No levantes servidores sin motivo.

## 4. Despliegue

- **Ramas**: `main` es la única viva del fork (las otras ~270 ramas remotas son de upstream). Cambios por PR
  desde worktree; nunca push a `main`. Remotos: `origin` = GoClaw/openclaw, `upstream` = openclaw/openclaw.
- **Publicación**: `docker-release.yml` construye en cada push a `main` (o tag `v*`) imágenes amd64/arm64 para
  `ghcr.io/<repo>`. ⚠️ **Falla desde el 2026-02-19**: `repository name (GoClaw/openclaw-cache) must be lowercase`
  (la org tiene mayúsculas). Solo 1 build OK (commit `577ceac504`, 2026-02-19). Las imágenes con los últimos
  commits del fork, por lo tanto, **no se publicaron** por esta vía.
- **Dónde corre en producción**: **por confirmar** (no hay manifiestos de GoClaw en el repo; ¿Fly, Render,
  contenedores propios del dashboard?). Imagen que se usa realmente: por confirmar.
- `ci.yml` aparece siempre como *cancelled* en el fork (por confirmar si es por concurrencia o por runners).
- Upstream publica a npm (`openclaw`) y apps macOS; **eso no aplica a GoClaw**: no publiques nada a npm.

## 5. Dependencias

- **Modelos IA**: Anthropic (recomendado), OpenAI, Gemini, OpenRouter, MiniMax, Z.AI… según config.
- **Canales**: WhatsApp (Baileys, no oficial), Telegram, Slack, Discord, Mattermost, Zalo, Twitch, etc.
- **Otros servicios**: Brave/Perplexity/Firecrawl (búsqueda web), ElevenLabs y Deepgram (voz), Chromium/CDP.
- **Base de datos**: no hay servidor de BD; el estado vive en disco: `~/.openclaw/openclaw.json`,
  `~/.openclaw/workspace`, `~/.openclaw/credentials/`, `~/.openclaw/agents/<id>/sessions/*.jsonl`
  (`OPENCLAW_STATE_DIR` lo mueve; en contenedor suele ir a un volumen `/data`). Memoria: `extensions/memory-core`
  y `extensions/memory-lancedb` (local).
- **Variables de entorno** (nombres, ver `.env.example`, `docker-compose.yml`, `render.yaml`):
  `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_GATEWAY_PASSWORD`, `OPENCLAW_STATE_DIR`, `OPENCLAW_HOME`,
  `OPENCLAW_CONFIG_PATH`, `OPENCLAW_CONFIG_DIR`, `OPENCLAW_WORKSPACE_DIR`, `OPENCLAW_GATEWAY_PORT`,
  `OPENCLAW_GATEWAY_BIND`, `OPENCLAW_BRIDGE_PORT`, `OPENCLAW_IMAGE`, `OPENCLAW_LOAD_SHELL_ENV`,
  `OPENCLAW_SHELL_ENV_TIMEOUT_MS`, `OPENCLAW_PREFER_PNPM`, `SETUP_PASSWORD`, `PORT`, `DISPLAY`;
  claves: `ANTHROPIC_API_KEY(S|_1)`, `OPENAI_API_KEY(S|_1)`, `GEMINI_API_KEY(S|_1)`, `GOOGLE_API_KEY`,
  `OPENROUTER_API_KEY`, `AI_GATEWAY_API_KEY`, `MINIMAX_API_KEY`, `ZAI_API_KEY`, `SYNTHETIC_API_KEY`,
  `BRAVE_API_KEY`, `PERPLEXITY_API_KEY`, `FIRECRAWL_API_KEY`, `ELEVENLABS_API_KEY`, `XI_API_KEY`,
  `DEEPGRAM_API_KEY`, `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`,
  `MATTERMOST_BOT_TOKEN`, `MATTERMOST_URL`, `ZALO_BOT_TOKEN`, `OPENCLAW_TWITCH_ACCESS_TOKEN`,
  `CLAUDE_AI_SESSION_KEY`, `CLAUDE_WEB_SESSION_KEY`, `CLAUDE_WEB_COOKIE`; tests live: `OPENCLAW_LIVE_*_KEY`.
  Qué variables usa el despliegue real de GoClaw: **por confirmar**.

## 6. Reglas y trampas

- **Es un fork**: cada cambio propio debe poder sobrevivir a un merge de upstream. Mantén los cambios pequeños
  y aislados (archivos nuevos en `server-methods/` mejor que editar los de upstream). Sincronizar con upstream
  (~8 meses de atraso) es un trabajo grande: no lo hagas sin que lo pida Jonatan. Al sincronizar, `AGENTS.md`
  y `CLAUDE.md` chocarán con los de upstream: conserva estos y actualiza `.agents/UPSTREAM_GUIDELINES.md`.
- **Nuevo método RPC** = handler en `server-methods/`, registrarlo en `server-methods-list.ts`, decidir su scope
  (lectura vs `WRITE_METHODS` en `server-methods.ts`), esquema en `protocol/schema/` + `protocol-schemas.ts`,
  y `pnpm protocol:check`.
- **Seguridad**: el cambio de scopes con token compartido (§1) abre permisos de operador a quien tenga el token;
  trata `OPENCLAW_GATEWAY_TOKEN` como credencial de admin y no lo amplíes sin revisarlo. `memory.write`
  (sólo `.md`, rechaza rutas fuera del workspace) y `skills.create` escriben en disco: no relajes esas guardas.
- **WhatsApp/Baileys** es no oficial: reconexiones o logins repetidos pueden desvincular la cuenta. No pruebes
  contra números reales; nunca subas números, sesiones ni config real (usa datos falsos obvios).
- **Docker Release roto** por mayúsculas en el nombre del registro: si lo arreglas, usa el nombre en minúsculas
  (p. ej. `${{ github.repository }}` → minúsculas) también para la caché.
- Del upstream (detalle en `.agents/UPSTREAM_GUIDELINES.md`): TypeScript ESM estricto, sin `any`, sin
  `@ts-nocheck`, sin mixins por prototipo; archivos < ~500–700 líneas; tests `*.test.ts` junto al código;
  deps de plugins en su `package.json` (no `workspace:*` en `dependencies`); no editar `node_modules`;
  no actualizar Carbon; parches de deps sólo con aprobación y versión exacta; no editar `docs/zh-CN/**`;
  links de docs root-relative sin `.md`; nombre **OpenClaw** en títulos, `openclaw` en CLI/rutas/config;
  no cambiar versiones ni publicar (npm, apps, GHSA) sin permiso explícito; commits con
  `scripts/committer "<msg>" <archivos…>`; no tocar `git stash` ni ramas ajenas; nunca enviar respuestas
  parciales/streaming a canales externos.
- Granja: `~/goclaw` es un espejo que se actualiza solo; trabaja en `~/wt/goclaw-<tema>` y abre PR.

## 7. A quién preguntar

- **Jonatan Vazquez** (autor de todos los commits del fork): producto, dónde corre y qué consume estas RPC.
  Sin grupo de WhatsApp: se le avisa por el panel (ver `~/CLAUDE.md`).
- **GoClaw** (esta terminal, `~/goclaw`): dueña del repo en la granja.
- Ninguna otra terminal de la granja tiene relación conocida con GoClaw (no hay referencias en los demás
  repos); el dashboard/backend de GoClaw no está en este servidor (**por confirmar** dónde vive).
- No confundir con el **puente de WhatsApp de la granja** (`~/bridge`, también Baileys): es otro sistema;
  lo que sabe es útil para problemas de Baileys, pero no comparte código con este repo.
