import fs from "node:fs/promises";
import path from "node:path";

import { resolveDefaultAgentId, resolveAgentWorkspaceDir } from "../../agents/agent-scope.js";
import { loadConfig } from "../../config/config.js";
import { getMemorySearchManager } from "../../memory/index.js";
import { listMemoryFiles } from "../../memory/internal.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export const memoryHandlers: GatewayRequestHandlers = {
  "memory.status": async ({ respond }) => {
    const cfg = loadConfig();
    const agentId = resolveDefaultAgentId(cfg);
    const { manager, error } = await getMemorySearchManager({ cfg, agentId });
    if (!manager) {
      respond(true, { enabled: false, error: error ?? "Memory search not configured" });
      return;
    }
    try {
      const status = manager.status();
      const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
      const files = await listMemoryFiles(workspaceDir);
      respond(true, {
        enabled: true,
        agentId,
        files: status.files,
        chunks: status.chunks,
        dirty: status.dirty,
        provider: status.provider,
        model: status.model,
        sources: status.sources,
        totalFiles: files.length,
        vector: status.vector,
        fts: status.fts,
        fallback: status.fallback,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      respond(true, { enabled: false, error: msg });
    }
  },

  "memory.files": async ({ respond }) => {
    const cfg = loadConfig();
    const agentId = resolveDefaultAgentId(cfg);
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    try {
      const absPaths = await listMemoryFiles(workspaceDir);
      const entries = await Promise.all(
        absPaths.map(async (absPath) => {
          const relPath = path.relative(workspaceDir, absPath).replace(/\\/g, "/");
          try {
            const stat = await fs.stat(absPath);
            return {
              path: relPath,
              size: stat.size,
              mtimeMs: stat.mtimeMs,
            };
          } catch {
            return { path: relPath, size: 0, mtimeMs: 0 };
          }
        }),
      );
      respond(true, { agentId, workspaceDir, files: entries });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, msg));
    }
  },

  "memory.read": async ({ params, respond }) => {
    const cfg = loadConfig();
    const agentId = resolveDefaultAgentId(cfg);
    const filePath = typeof params?.path === "string" ? params.path : "";
    const from = typeof params?.from === "number" ? params.from : undefined;
    const lines = typeof params?.lines === "number" ? params.lines : undefined;

    if (!filePath) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "path is required"));
      return;
    }

    const { manager, error } = await getMemorySearchManager({ cfg, agentId });
    if (!manager) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, error ?? "Memory search not configured"),
      );
      return;
    }
    try {
      const result = await manager.readFile({ relPath: filePath, from, lines });
      respond(true, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, msg));
    }
  },
};
