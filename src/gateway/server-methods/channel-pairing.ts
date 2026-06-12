import { ErrorCodes, errorShape } from "../../../packages/gateway-protocol/src/index.js";
import { normalizeChannelId } from "../../channels/plugins/registry.js";
import {
  addChannelAllowFromStoreEntry,
  approveChannelPairingCode,
  listChannelPairingRequests,
  readChannelAllowFromStore,
  rejectChannelPairingCode,
  removeChannelAllowFromStoreEntry,
} from "../../pairing/pairing-store.js";
import type { GatewayRequestHandlers } from "./types.js";

// GoClaw fork: channel pairing + allow-list management RPC methods. The
// platform dashboard uses these to list/approve/reject WhatsApp pairing
// requests and to manage per-channel allowFrom entries without shell access.

function resolveChannel(params: Record<string, unknown>) {
  const raw = params.channel;
  return typeof raw === "string" ? normalizeChannelId(raw) : null;
}

export const channelPairingHandlers: GatewayRequestHandlers = {
  "channels.pairing.list": async ({ params, respond }) => {
    const channel = resolveChannel(params);
    if (!channel) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid channel"));
      return;
    }
    const accountId = typeof params.accountId === "string" ? params.accountId : undefined;
    const requests = await listChannelPairingRequests(channel, process.env, accountId);
    respond(true, { channel, requests }, undefined);
  },

  "channels.pairing.approve": async ({ params, respond }) => {
    const channel = resolveChannel(params);
    if (!channel) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid channel"));
      return;
    }
    const code = String(params.code ?? "").trim();
    if (!code) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "code is required"));
      return;
    }
    const accountId = typeof params.accountId === "string" ? params.accountId : undefined;
    const result = await approveChannelPairingCode({ channel, code, accountId });
    if (!result) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "pairing code not found or expired"),
      );
      return;
    }
    respond(true, { channel, id: result.id }, undefined);
  },

  "channels.pairing.reject": async ({ params, respond }) => {
    const channel = resolveChannel(params);
    if (!channel) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid channel"));
      return;
    }
    const code = String(params.code ?? "").trim();
    if (!code) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "code is required"));
      return;
    }
    const accountId = typeof params.accountId === "string" ? params.accountId : undefined;
    const result = await rejectChannelPairingCode({ channel, code, accountId });
    if (!result) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "pairing code not found or expired"),
      );
      return;
    }
    respond(true, { channel, id: result.id }, undefined);
  },

  "channels.allowFrom.list": async ({ params, respond }) => {
    const channel = resolveChannel(params);
    if (!channel) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid channel"));
      return;
    }
    const accountId = typeof params.accountId === "string" ? params.accountId : undefined;
    const allowFrom = await readChannelAllowFromStore(channel, process.env, accountId);
    respond(true, { channel, allowFrom }, undefined);
  },

  "channels.allowFrom.add": async ({ params, respond }) => {
    const channel = resolveChannel(params);
    if (!channel) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid channel"));
      return;
    }
    const entry = String(params.entry ?? "").trim();
    if (!entry) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "entry is required"));
      return;
    }
    const accountId = typeof params.accountId === "string" ? params.accountId : undefined;
    const result = await addChannelAllowFromStoreEntry({ channel, entry, accountId });
    respond(true, { channel, changed: result.changed, allowFrom: result.allowFrom }, undefined);
  },

  "channels.allowFrom.remove": async ({ params, respond }) => {
    const channel = resolveChannel(params);
    if (!channel) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid channel"));
      return;
    }
    const entry = String(params.entry ?? "").trim();
    if (!entry) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "entry is required"));
      return;
    }
    const accountId = typeof params.accountId === "string" ? params.accountId : undefined;
    const result = await removeChannelAllowFromStoreEntry({ channel, entry, accountId });
    respond(true, { channel, changed: result.changed, allowFrom: result.allowFrom }, undefined);
  },
};
