import fs from "node:fs/promises";
import path from "node:path";

import { resolveDefaultAgentId, resolveAgentWorkspaceDir } from "../../agents/agent-scope.js";
import { loadConfig } from "../../config/config.js";
import { getMemorySearchManager } from "../../memory/index.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

async function listWorkspaceFiles(
  workspaceDir: string,
): Promise<Array<{ path: string; size: number; mtimeMs: number }>> {
  const entries: Array<{ path: string; size: number; mtimeMs: number }> = [];

  const addFile = async (absPath: string) => {
    try {
      const stat = await fs.stat(absPath);
      if (!stat.isFile()) return;
      const relPath = path.relative(workspaceDir, absPath).replace(/\\/g, "/");
      entries.push({ path: relPath, size: stat.size, mtimeMs: stat.mtimeMs });
    } catch {}
  };

  // List all .md files in workspace root
  try {
    const rootEntries = await fs.readdir(workspaceDir, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        await addFile(path.join(workspaceDir, entry.name));
      }
    }
  } catch {}

  // List memory/ subdirectory files
  const memoryDir = path.join(workspaceDir, "memory");
  try {
    const memEntries = await fs.readdir(memoryDir, { withFileTypes: true });
    for (const entry of memEntries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        await addFile(path.join(memoryDir, entry.name));
      }
    }
  } catch {}

  return entries;
}

async function readWorkspaceFile(
  workspaceDir: string,
  relPath: string,
  from?: number,
  lines?: number,
): Promise<{ text: string; path: string }> {
  const absPath = path.resolve(workspaceDir, relPath);
  // Security: ensure the resolved path is inside the workspace
  if (!absPath.startsWith(workspaceDir + path.sep) && absPath !== workspaceDir) {
    throw new Error("path outside workspace");
  }
  const raw = await fs.readFile(absPath, "utf-8");
  if (from === undefined && lines === undefined) {
    return { text: raw, path: relPath };
  }
  const allLines = raw.split("\n");
  const start = Math.max(0, (from ?? 1) - 1);
  const count = lines ?? allLines.length;
  const sliced = allLines.slice(start, start + count).join("\n");
  return { text: sliced, path: relPath };
}

async function writeWorkspaceFile(
  workspaceDir: string,
  relPath: string,
  content: string,
): Promise<{ ok: true; path: string }> {
  const absPath = path.resolve(workspaceDir, relPath);
  // Security: ensure the resolved path is inside the workspace
  if (!absPath.startsWith(workspaceDir + path.sep) && absPath !== workspaceDir) {
    throw new Error("path outside workspace");
  }
  // Only allow .md files
  if (!relPath.endsWith(".md")) {
    throw new Error("only .md files are supported");
  }
  // Create parent directory if needed
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, "utf-8");
  return { ok: true, path: relPath };
}

async function safeGetManager(cfg: ReturnType<typeof loadConfig>, agentId: string) {
  try {
    const { manager } = await getMemorySearchManager({ cfg, agentId });
    return manager;
  } catch {
    return null;
  }
}

export const memoryHandlers: GatewayRequestHandlers = {
  "memory.status": async ({ params, respond }) => {
    try {
      const cfg = loadConfig();
      const agentId =
        typeof params?.agentId === "string" ? params.agentId : resolveDefaultAgentId(cfg);
      const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
      const wsFiles = await listWorkspaceFiles(workspaceDir);

      const manager = await safeGetManager(cfg, agentId);
      if (!manager) {
        respond(true, {
          enabled: true,
          searchEnabled: false,
          agentId,
          totalFiles: wsFiles.length,
          workspaceDir,
        });
        return;
      }
      try {
        const status = manager.status();
        respond(true, {
          enabled: true,
          searchEnabled: true,
          agentId,
          files: status.files,
          chunks: status.chunks,
          dirty: status.dirty,
          provider: status.provider,
          model: status.model,
          sources: status.sources,
          totalFiles: wsFiles.length,
          vector: status.vector,
          fts: status.fts,
          fallback: status.fallback,
        });
      } catch {
        respond(true, {
          enabled: true,
          searchEnabled: false,
          agentId,
          totalFiles: wsFiles.length,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, msg));
    }
  },

  "memory.files": async ({ params, respond }) => {
    try {
      const cfg = loadConfig();
      const agentId =
        typeof params?.agentId === "string" ? params.agentId : resolveDefaultAgentId(cfg);
      const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
      const files = await listWorkspaceFiles(workspaceDir);
      respond(true, { agentId, workspaceDir, files });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, msg));
    }
  },

  "memory.read": async ({ params, respond }) => {
    try {
      const cfg = loadConfig();
      const agentId =
        typeof params?.agentId === "string" ? params.agentId : resolveDefaultAgentId(cfg);
      const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
      const filePath = typeof params?.path === "string" ? params.path : "";
      const from = typeof params?.from === "number" ? params.from : undefined;
      const lines = typeof params?.lines === "number" ? params.lines : undefined;

      if (!filePath) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "path is required"));
        return;
      }

      // Try the memory manager first (handles security checks + extra paths),
      // fall back to direct workspace read
      const manager = await safeGetManager(cfg, agentId);
      if (manager) {
        try {
          const result = await manager.readFile({ relPath: filePath, from, lines });
          respond(true, result);
          return;
        } catch {}
      }

      // Direct workspace read fallback
      const result = await readWorkspaceFile(workspaceDir, filePath, from, lines);
      respond(true, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, msg));
    }
  },

  "memory.write": async ({ params, respond }) => {
    try {
      const cfg = loadConfig();
      const agentId =
        typeof params?.agentId === "string" ? params.agentId : resolveDefaultAgentId(cfg);
      const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
      const filePath = typeof params?.path === "string" ? params.path : "";
      const content = typeof params?.content === "string" ? params.content : undefined;

      if (!filePath) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "path is required"));
        return;
      }
      if (content === undefined) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "content is required"));
        return;
      }

      const result = await writeWorkspaceFile(workspaceDir, filePath, content);
      respond(true, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, msg));
    }
  },
};
