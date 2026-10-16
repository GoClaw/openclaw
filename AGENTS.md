# AGENTS.md — GoClaw/openclaw

> Guía para agentes que trabajan en este repo (fork de OpenClaw que usa GoClaw).
> Las reglas de upstream siguen vigentes y están completas, sin recortar, en
> [`.agents/UPSTREAM_GUIDELINES.md`](.agents/UPSTREAM_GUIDELINES.md). Antes de tocar un subárbol, lee también el
> `AGENTS.md` más cercano a esa ruta (`src/gateway/`, `extensions/`, `ui/`, `docs/`, `test/`…).
> La versión anterior de esas reglas (2026.2.18) está en `.agents/UPSTREAM_GUIDELINES-2026.2.18.md`.
> Lo marcado **por confirmar** no se pudo verificar.

## 1. Qué es

- **Fork de [OpenClaw](https://github.com/openclaw/openclaw)**: el asistente de IA personal *local-first*. Un
  **Gateway** con plano de control WebSocket (puerto 18789) conecta un agente con canales de mensajería
  (WhatsApp vía Baileys, Telegram, Slack, Discord, Signal, Teams, Matrix…), apps (macOS/iOS/Android/Linux),
  navegador, cron, skills y memoria.
- **Para quién / para qué**: es el motor de **GoClaw** (www.goclaw.app), un SaaS que da a cada cliente su propio
  bot OpenClaw alojado. El dashboard/backend está en otro repo, **`jonatanvazquez/mymolt`** (Next.js + Prisma,
  privado; en un commit aparece como «GoCrawl»). Crea un contenedor por cliente y lo maneja por WS con token
  compartido y con las RPC de este fork (memoria «Knowledge», chat con capturas, skills, WhatsApp).
- **Lo que añade el fork**: los commits «GoClaw port», portados a mano en cada sincronización con upstream.
  - RPC de memoria `memory.status|files|read|write` → `src/gateway/server-methods/memory.ts`.
  - `skills.create` → `src/gateway/server-methods/skills.ts`; `chat.inject` como método de escritura.
  - `chat.history` con `includeMedia=true` conserva imágenes base64 → `src/gateway/server-methods/chat-history-handler.ts`.
  - WhatsApp por **código de emparejamiento** (`web.login.pairingCode.start`) → `src/gateway/server-methods/web.ts`
    y `extensions/whatsapp/src/login-qr.ts`.
  - `channels.pairing.list|approve|reject` y `channels.allowFrom.list|add|remove` →
    `src/gateway/server-methods/channel-pairing.ts` y `src/pairing/pairing-store.ts`.
  - Auth por secreto compartido que **conserva los scopes** pedidos sin identidad de dispositivo (servidor a
    servidor) → `src/gateway/server/ws-connection/` (`sharedAuthOk`).
  - Docker: `scripts/container-entrypoint.sh` arranca Xvfb y `--build-arg OPENCLAW_INSTALL_BROWSER=1` instala
    Chromium. WhatsApp va incluido en el dist (`openclaw.build.bundledDist=true`).
  - Todos los métodos están registrados en `src/gateway/methods/core-descriptors.ts`.
- **Estado (verificado 2026-10-16)**: **en uso**, con 44 bots activos y 12 pre-aprovisionados. Producción corre
  **2026.9.1**. `main` está al día con ese código desde el PR #2 (merge de `goclaw-sync-2026-09-04`).

## 2. Mapa del repo

| Ruta | Qué hay |
|---|---|
| `src/gateway/` | Gateway: `server-methods/*.ts` (handlers RPC), `methods/core-descriptors.ts` (nombre, scope y política de escritura de cada método), `server/ws-connection/` (auth) |
| `packages/gateway-protocol/` | Esquemas del protocolo (TypeBox) que comparten servidor y clientes |
| `src/channels`, `src/routing`, `src/pairing` | Lógica común de canales, ruteo, allowlists y emparejamiento |
| `extensions/*` | Plugins: canales (`whatsapp`, `telegram`, `discord`…), `browser`, `memory-core`, proveedores… |
| `src/web/` | Utilidades web y medios de WhatsApp (el canal vive en `extensions/whatsapp/`) |
| `src/agents`, `src/memory*`, `src/cron`, `src/cli`, `src/commands`, `src/infra`, `src/plugin-sdk` | Agente, memoria, cron, CLI, SDK de plugins |
| `ui/` · `apps/` · `packages/` | Control UI (Vite) · apps nativas · paquetes `@openclaw/*` del workspace |
| `skills/` · `.agents/skills/` | Skills del agente · skills de mantenimiento de upstream |
| `docs/` · `test/` · `qa/` | Docs Mintlify (docs.openclaw.ai) · configs de Vitest (`test/vitest/`) y helpers · QA |
| `Dockerfile`, `docker-compose.yml`, `scripts/container-entrypoint.sh` | Imagen y arranque en contenedor |
| `.github/workflows/` | ~100 workflows de upstream (ver §4) |

## 3. Cómo correrlo y probarlo

- Node `>=22.22.3 <23`, `>=24.15 <25` o `>=25.9`; **pnpm 12.1** (`packageManager`).
- Instalar: `pnpm install` (un worktree nuevo no tiene `node_modules`). Si sale `Cannot find module` justo después
  de un merge, son `node_modules` viejos: reinstala.
- Typecheck: `pnpm tsgo` (= `tsgo:core`; hay más carriles: `tsgo:extensions`, `tsgo:all`…). Nunca `tsc --noEmit`.
- Lint/formato: `pnpm check:changed` (formato, typecheck, lint y guardas sólo de lo tocado), `pnpm check`
  (todo, pesado), `pnpm lint`, `pnpm format:check`, `pnpm format <rutas>` (escribe).
- Pruebas: `pnpm test <ruta-o-filtro>`, `pnpm test:changed`, `pnpm test:extensions`, `pnpm test:coverage`,
  `pnpm test:e2e`. Live, con claves reales: `pnpm test:live`.
- Protocolo: `pnpm protocol:check` (regenera los esquemas y los modelos Swift/Kotlin; debe quedar sin diff).
- Dev: `pnpm openclaw …`, `pnpm gateway:watch`, `pnpm ui:build`. Build: `pnpm build` (pesado).
- 🚦 En la granja, todo lo pesado va por la cola:
  `turno correr --prio 3 --etiqueta tsgo-goclaw -- nice -n 15 pnpm tsgo`. No levantes servidores sin motivo.

## 4. Despliegue

- **Ramas**: `main` = el código de producción (2026.9.1). Cada sincronización con upstream se hace en una rama
  `goclaw-sync-AAAA-MM-DD`: la upstream del día y, encima, los commits «GoClaw port» re-aplicados. La vigente es
  `goclaw-sync-2026-09-04`; también existen `-06-03` y `-08-10`. Al terminar, se lleva a `main` con un merge
  `-s ours` desde la rama sync, para que entre sin conflictos (así se hizo en el PR #2). Remotos: `origin` =
  GoClaw/openclaw, `upstream` = openclaw/openclaw. Trabaja en un worktree y abre PR; nunca hagas push a `main`.
- **Dónde corre**: en **hosts Docker de Hetzner** («hatchery») que administra mymolt. El único activo es
  **`hetzner-ash-21`**, con 56/56 plazas. Cada bot es un contenedor `openclaw:latest` detrás de Traefik, en
  `<id>.bot.mymolt.app`. Los hosts están en la tabla `HostServer` de la BD de mymolt; el resto está inactivo o
  retirado (srv1 fue host antes de pasar a Coolify; ahí queda `hatchery.service`, inactivo).
- **Imagen**: **no hay registro**. Cada host clona GoClaw/openclaw (rama por defecto, `main`) y construye
  `openclaw:latest` ahí mismo (`scripts/provision-docker-host.sh` y `.github/workflows/provision-docker-host.yml`
  de mymolt). Las actualizaciones de la flota construyen `openclaw:sync-test`, lo retaguean a `latest` y guardan
  `openclaw:rollback` (`scripts/_fleet-prep.ts`, `_fleet-rollout.ts`, `_upgrade-container.ts`, `_canary-*.ts`).
  La UI de un gateway en producción reporta `2026.9.1`. Commit y fecha exactos de la imagen en ash-21: **por
  confirmar**. Nadie de la granja tiene acceso y la regla es **no tocar ash-21** sin autorización expresa de
  Jonatan (Infra lo tiene como «servidor de un cliente»; pendiente de que él lo aclare).
- **Dashboard (mymolt)**: app de Coolify `goclaw` en **srv1**, servida en `www.goclaw.app`. Se despliega con un
  push a `main` de mymolt → workflow `srv1.yml` (runner de la granja) → `srv1-construir`.
- **BD y respaldos** (según Infra): la BD de mymolt es la base `goclaw` del PostgreSQL de srv1, con pgBackRest a
  R2 y un pg_dump diario a S3. Los volúmenes de los bots (`/opt/openclaw/containers/*` en el host) **no tienen
  respaldo conocido**.
- **CI de este repo** (no despliega nada en GoClaw):
  - Desde 2026.9.1 trae unos 100 workflows de upstream.
  - Fuera de `openclaw/openclaw`, la mayoría corre en runners de GitHub (`ubuntu-24.04`) y no en Blacksmith.
  - Algunos se disparan con un push a `main` y están pensados para publicar (`Plugin NPM Release`,
    `Docs Sync Publish Repo`, `Live Media Runner Image`, `OpenClaw Stable Main Closeout`…). Qué hacen en el fork
    sin los secretos de upstream: **por confirmar**.
  - `docker-release.yml` ya sólo se dispara desde otros workflows (`workflow_call`).
  - Producción no usa ghcr, ni `fly.toml`/`render.yaml`, que son plantillas de upstream.
- No publiques nada a npm, ni apps, ni avisos GHSA: eso es de upstream.

## 5. Dependencias

- **Servicios**: modelos IA (Anthropic, OpenAI, Gemini, OpenRouter…; en GoClaw van vía LiteLLM, que configura
  mymolt), canales (WhatsApp con Baileys, no oficial, Telegram, Slack, Discord…), búsqueda web
  (Brave/Perplexity/Firecrawl), voz (ElevenLabs/Deepgram), Chromium/Playwright y OpenTelemetry opcional.
- **Estado del gateway**: sin servidor de BD. Config y workspace en disco (`~/.openclaw/openclaw.json`,
  `~/.openclaw/workspace`), credenciales en `~/.openclaw/credentials/` y perfiles de auth en
  `~/.openclaw/state/openclaw.sqlite`. `OPENCLAW_STATE_DIR` lo mueve. En GoClaw, mymolt escribe el
  `openclaw.json` de cada contenedor.
- **Variables de entorno** (sólo nombres; lista completa en `.env.example` y `docker-compose.yml`):
  - Gateway: `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_GATEWAY_PASSWORD`, `OPENCLAW_STATE_DIR`, `OPENCLAW_HOME`,
    `OPENCLAW_CONFIG_PATH`, `OPENCLAW_CONFIG_DIR`, `OPENCLAW_WORKSPACE_DIR`, `OPENCLAW_GATEWAY_PORT`,
    `OPENCLAW_GATEWAY_BIND`, `OPENCLAW_IMAGE`, `OPENCLAW_AUTH_PROFILE_SECRET_DIR`, `OPENCLAW_TZ`,
    `OPENCLAW_DISABLE_BONJOUR`, `OTEL_*`, `DISPLAY`.
  - Claves: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`,
    `DISCORD_BOT_TOKEN`, `SLACK_*`…
  - Tests live: `OPENCLAW_LIVE_*_KEY`.

## 6. Reglas y trampas

- **Fork que se re-sincroniza**: cada cambio propio hay que volver a portarlo en la próxima sincronización.
  Mantenlo pequeño y aislado (mejor archivos nuevos en `server-methods/` que editar los de upstream) y márcalo
  «GoClaw port» en el commit. Sincronizar es un trabajo grande y no se hace sin que lo pida Jonatan.
  - La rama sync trae el `AGENTS.md` y el `CLAUDE.md` de upstream. Al llevarla a `main`, conserva estos: copia el
    `AGENTS.md` nuevo de upstream a `.agents/UPSTREAM_GUIDELINES.md` y deja `CLAUDE.md` con sólo `@AGENTS.md`.
- 🚨 **`main` es lo que se despliega**: un host nuevo construye `main`. Puede pasar **sin que nadie lo pida**: el
  cron `check-capacity` de mymolt (cada hora, en srv1) lanza `provision-docker-host.yml` cuando quedan ≤ 5 plazas
  libres. Ese cron no deja salida en su log y el auto-escalado no corre desde el 2026-05-23: ¿falla en silencio?
  **Por confirmar**. No lleves a `main` nada que no esté listo para producción. `update-docker-hosts.ts` de mymolt
  hace pull y reconstruye en todos los hosts, y **reinicia todos los bots**.
- Probar en producción = el contenedor real de un cliente. Usa el flujo canario de mymolt (`_canary-*.ts`) con un
  bot de prueba. **No entres ni leas nada en ash-21** sin autorización expresa de Jonatan, y avisa a Infra.
- **Nuevo método RPC** = handler en `src/gateway/server-methods/`, entrada en `methods/core-descriptors.ts` (scope
  y si escribe), esquema en `packages/gateway-protocol/` y `pnpm protocol:check`. Los cambios de protocolo van
  aditivos; subir la versión del protocolo requiere confirmación explícita.
- **Seguridad**:
  - El cambio de scopes con token compartido abre permisos de operador a quien tenga `OPENCLAW_GATEWAY_TOKEN`:
    trátalo como credencial de admin.
  - `memory.write` sólo acepta `.md` dentro del workspace y `skills.create` escribe en disco: no relajes esas
    guardas.
  - El repo es **público**: nada de IPs, tokens, números ni config real.
- **WhatsApp/Baileys** es no oficial: reconexiones o logins repetidos pueden desvincular la cuenta. No pruebes
  contra números reales.
- **Lo esencial de upstream** (detalle en `.agents/UPSTREAM_GUIDELINES.md`):
  - Código: TS ESM estricto, sin `any`, sin `@ts-nocheck`, sin mixins por prototipo; archivos de unos 700 LOC
    como máximo.
  - Dependencias: las de un plugin, en su `package.json`. Parches de dependencias y opciones de config nuevas,
    sólo con aprobación. No editar `node_modules`.
  - Git: commits con `git` normal, añadiendo sólo tus archivos; no tocar `git stash`.
  - Releases y versiones, sólo con permiso.
  - Canales externos: nada de mensajes en streaming.
  - Nombres: **OpenClaw** en títulos, `openclaw` en CLI, rutas y config.
- Granja: `~/goclaw` es un espejo de `main` que se actualiza solo. Trabaja en `~/wt/goclaw-<tema>` y abre PR.

## 7. A quién preguntar

- **Jonatan Vazquez** (autor de los commits del fork): producto, flota, autorizaciones (ash-21, merges a `main`).
  No hay grupo de WhatsApp: se le avisa por el panel (ver `~/CLAUDE.md`).
- **GoClaw** (esta terminal, `~/goclaw`): dueña del repo en la granja.
- **Infra** (`~/infra`, sesión «Infra», repo `jonatanvazquez/infra`): servidores, Coolify, despliegues y respaldos.
  Llévale las dudas sobre srv1, los hosts Docker de Hetzner, la app de Coolify `goclaw` y los respaldos; ella
  tampoco entra a ash-21 sin el sí de Jonatan. `SendMessage` a la fila cuyo tmux es `claude-infra`.
- **Dashboard mymolt**: no tiene terminal propia; su repo es `jonatanvazquez/mymolt` y su runner de CI corre en la
  granja. Infraestructura → Infra; producto o flota → Jonatan.
- **srv1 / Coolify**: compartido con CabGo y otros proyectos. Antes de tocar algo ahí, lee `~/CLAUDE.md` y pregúntale
  a Infra.
- `jonatanvazquez/openclaw` es otro fork (último push 2026-03-01) que mymolt no usa: es legacy.
- No confundir con el **puente de WhatsApp de la granja** (`~/bridge`, también Baileys): es otro sistema y no
  comparte código con este repo, aunque lo que sabe sirve para problemas de Baileys.
