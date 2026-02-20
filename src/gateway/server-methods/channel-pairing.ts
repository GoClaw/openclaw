import { normalizeChannelId } from "../../channels/plugins/index.js";
import {
  addChannelAllowFromStoreEntry,
  approveChannelPairingCode,
  listChannelPairingRequests,
  readChannelAllowFromStore,
  rejectChannelPairingCode,
  removeChannelAllowFromStoreEntry,
} from "../../pairing/pairing-store.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateChannelsAllowFromAddParams,
  validateChannelsAllowFromListParams,
  validateChannelsAllowFromRemoveParams,
  validateChannelsPairingApproveParams,
  validateChannelsPairingListParams,
  validateChannelsPairingRejectParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

function resolveChannel(params: Record<string, unknown>) {
  const raw = params.channel;
  return typeof raw === "string" ? normalizeChannelId(raw) : null;
}

export const channelPairingHandlers: GatewayRequestHandlers = {
  "channels.pairing.list": async ({ params, respond }) => {
    if (!validateChannelsPairingListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid params: ${formatValidationErrors(validateChannelsPairingListParams.errors)}`,
        ),
      );
      return;
    }
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
    if (!validateChannelsPairingApproveParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid params: ${formatValidationErrors(validateChannelsPairingApproveParams.errors)}`,
        ),
      );
      return;
    }
    const channel = resolveChannel(params);
    if (!channel) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid channel"));
      return;
    }
    const code = String(params.code ?? "").trim();
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
    if (!validateChannelsPairingRejectParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid params: ${formatValidationErrors(validateChannelsPairingRejectParams.errors)}`,
        ),
      );
      return;
    }
    const channel = resolveChannel(params);
    if (!channel) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid channel"));
      return;
    }
    const code = String(params.code ?? "").trim();
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
    if (!validateChannelsAllowFromListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid params: ${formatValidationErrors(validateChannelsAllowFromListParams.errors)}`,
        ),
      );
      return;
    }
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
    if (!validateChannelsAllowFromAddParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid params: ${formatValidationErrors(validateChannelsAllowFromAddParams.errors)}`,
        ),
      );
      return;
    }
    const channel = resolveChannel(params);
    if (!channel) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid channel"));
      return;
    }
    const entry = String(params.entry ?? "").trim();
    const accountId = typeof params.accountId === "string" ? params.accountId : undefined;
    const result = await addChannelAllowFromStoreEntry({ channel, entry, accountId });
    respond(true, { channel, changed: result.changed, allowFrom: result.allowFrom }, undefined);
  },

  "channels.allowFrom.remove": async ({ params, respond }) => {
    if (!validateChannelsAllowFromRemoveParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid params: ${formatValidationErrors(validateChannelsAllowFromRemoveParams.errors)}`,
        ),
      );
      return;
    }
    const channel = resolveChannel(params);
    if (!channel) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid channel"));
      return;
    }
    const entry = String(params.entry ?? "").trim();
    const accountId = typeof params.accountId === "string" ? params.accountId : undefined;
    const result = await removeChannelAllowFromStoreEntry({ channel, entry, accountId });
    respond(true, { channel, changed: result.changed, allowFrom: result.allowFrom }, undefined);
  },
};
