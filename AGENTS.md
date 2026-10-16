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
- **Para quién / para qué**: es el motor de **GoClaw** (www.goclaw.app), un SaaS que da a cada cliente su
  propio bot OpenClaw alojado. El dashboard/backend es otro repo, **`jonatanvazquez/mymolt`** (Next.js +
  Prisma, privado; en un commit aparece como «GoCrawl»): crea un contenedor por cliente y lo maneja por WS
  con token compartido y por las RPC de este fork (memoria «Knowledge», chat con capturas, skills, WhatsApp).
- **Lo que añade el fork** (portado a mano en cada sincronización con upstream; en `main` son 14 commits sobre
  `e426a9bb6fe`, feb-2026; en `goclaw-sync-2026-09-04` son 11 commits «GoClaw port» sobre upstream del 02-sep):
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
- **Estado (verificado 2026-10-16)**: **en uso**. Producción corre **2026.9.1**, que sale de la rama
  `goclaw-sync-2026-09-04`, **no de `main`**. `main` se quedó en `2026.2.18` (20-feb) y ya no es lo que corre.
  Hay 44 bots activos y 12 pre-aprovisionados.

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

- **Ramas**: el código vivo está en ramas de sincronización `goclaw-sync-AAAA-MM-DD`: la upstream del día y,
  encima, los commits «GoClaw port» (`goclaw-sync-2026-06-03`, `-08-10` y `-09-04`, que es la vigente). `main`
  está congelada en feb-2026. Las otras ~270 ramas remotas son de upstream. Remotos: `origin` = GoClaw/openclaw,
  `upstream` = openclaw/openclaw. Trabaja desde un worktree y abre PR; nunca hagas push a `main`.
- **Dónde corre**: en **hosts Docker de Hetzner** («hatchery») que administra mymolt. El único activo hoy es
  **`hetzner-ash-21`** (56/56 plazas). Cada bot es un contenedor `openclaw:latest` detrás de Traefik, en
  `<id>.bot.mymolt.app`. Los hosts se guardan en la tabla `HostServer` de la BD de mymolt; los demás están
  inactivos o retirados, y srv1 (`5.161.62.25`) fue ash-13/ash-16 antes de pasar a Coolify.
- **Imagen**: **no hay registro**. Cada host clona GoClaw/openclaw y hace `docker build -t openclaw:latest` ahí
  mismo (`scripts/provision-docker-host.sh` y `.github/workflows/provision-docker-host.yml` de mymolt).
  Las actualizaciones de 2026 se hicieron construyendo `openclaw:sync-test` desde la rama sync y retagueándola a
  `latest`, con `openclaw:rollback` como respaldo (`scripts/_fleet-prep.ts`, `_fleet-rollout.ts` y
  `_upgrade-container.ts` de mymolt). La UI de un gateway en producción reporta `2026.9.1`. Fecha exacta del
  build y commit de la imagen: **por confirmar**. Ni la granja ni Infra tienen acceso a ash-21: hace falta el sí
  de Jonatan. La documentación de Infra lo marca como «servidor de un cliente, no se toca»; está anotado en
  `infra/pendientes.md` para que él lo aclare.
- **BD y respaldos** (según Infra): la BD de mymolt es la base `goclaw` del PostgreSQL 17 nativo de srv1, con
  pgBackRest a R2 (PITR) y un pg_dump diario a S3; `litellm` tiene lo mismo. Los volúmenes de los bots en ash-21
  (`/opt/openclaw/containers/*`) **no tienen respaldo conocido**. En srv1 queda `hatchery.service` inactivo, de
  cuando srv1 era host.
- **Dashboard (mymolt)**: app de Coolify `goclaw` (uuid `6ltvp3pcnwkuc8egsgyk1pqe`) en **srv1**, servida en
  `www.goclaw.app` y `goclaw.apps.apphive.dev`. Se despliega con un push a `main` de mymolt → workflow
  `srv1.yml` (runner `[self-hosted, mymolt]` de la granja) → `srv1-construir`. La imagen en curso es la del
  commit `7c8639c0a8`, desplegada el 2026-10-13.
- **CI de este repo (no despliega nada)**:
  - `ci.yml` usa runners **Blacksmith** (`blacksmith-4vcpu-*`) que la org GoClaw no tiene. Los jobs se quedan
    en cola unas 24 h y GitHub los cancela.
  - `docker-release.yml` falla con `repository name (GoClaw/openclaw-cache) must be lowercase`. Sólo hubo un
    build OK (2026-02-19). Producción no usa ghcr, así que no bloquea nada.
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
  claves de proveedores y canales (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`,
  `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN`, `SLACK_*`…; lista completa en `.env.example`); tests live: `OPENCLAW_LIVE_*_KEY`.
  Los contenedores reciben su config (`openclaw.json`) de mymolt; los modelos van vía LiteLLM
  (`LITELLM_API_URL` en mymolt).

## 6. Reglas y trampas

- **Es un fork que se re-sincroniza por ramas**: un cambio para producción va sobre la rama sync vigente
  (`goclaw-sync-2026-09-04`), no sobre `main`. En la próxima sincronización hay que volver a portarlo, así
  que mantenlo pequeño y aislado: mejor archivos nuevos en `server-methods/` que editar los de upstream.
  Sincronizar es un trabajo grande y no se hace sin que lo pida Jonatan. Esa rama trae el `AGENTS.md` de
  upstream: al sincronizar, conserva este y actualiza `.agents/UPSTREAM_GUIDELINES.md`.
- 🚨 **Trampa de aprovisionamiento**: un host nuevo clona la rama por defecto (`main`, 2026.2.18) y construye la
  versión vieja. Puede pasar **sin que nadie lo pida**: el cron `check-capacity` de mymolt (cada hora,
  `/etc/cron.d/goclaw` en srv1) lanza `provision-docker-host.yml` cuando quedan ≤ 5 plazas libres. ash-21 está
  lleno, pero el cron no deja salida en `/var/log/goclaw-cron.log` (usa `curl -sf`) y no hay ejecuciones desde el
  2026-05-23: ¿falla en silencio? **Por confirmar**. Lo mismo pasa con el `/update` de los VPS legacy
  (`git pull` de `main`). Mientras `main` no se ponga al día, hay que construir desde la rama sync.
- Probar algo en producción = un contenedor real de un cliente. Usa el flujo canario de mymolt
  (`_canary-*.ts`) y no toques ash-21 sin permiso de Jonatan (y avisa a Infra).
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
- **Infra** (`~/infra`, sesión «Infra», repo `jonatanvazquez/infra`): servidores, Coolify, despliegues y
  respaldos. A ella van las dudas sobre srv1, los hosts Docker de Hetzner (ash-21: acceso, imagen, rama del
  checkout `/opt/openclaw/repo`), la app de Coolify `goclaw` y los respaldos. Usa `SendMessage` a la fila
  cuyo tmux es `claude-infra`.
- **Dashboard mymolt**: no tiene terminal propia en la granja; su repo es `jonatanvazquez/mymolt`. Sólo su
  runner de CI (`mymolt`) corre aquí. Infraestructura → Infra; decisiones de producto o de la flota → Jonatan.
- **srv1 / Coolify**: lo comparten CabGo y otros proyectos. Antes de tocar algo ahí, lee `~/CLAUDE.md` y
  pregúntale a Infra.
- `jonatanvazquez/openclaw` es otro fork (último push 2026-03-01) que mymolt no usa: es legacy.
- No confundir con el **puente de WhatsApp de la granja** (`~/bridge`, también Baileys): es otro sistema;
  lo que sabe es útil para problemas de Baileys, pero no comparte código con este repo.
