import { createLazyRuntimeModule } from "openclaw/plugin-sdk/lazy-runtime";
// Whatsapp plugin module implements login qr runtime behavior.
type StartWebLoginWithQr = typeof import("./src/login-qr.js").startWebLoginWithQr;
type StartWebLoginWithPairingCode = typeof import("./src/login-qr.js").startWebLoginWithPairingCode;
type WaitForWebLogin = typeof import("./src/login-qr.js").waitForWebLogin;

const loadLoginQrModule = createLazyRuntimeModule(() => import("./src/login-qr.js"));

export async function startWebLoginWithQr(
  ...args: Parameters<StartWebLoginWithQr>
): ReturnType<StartWebLoginWithQr> {
  const { startWebLoginWithQr: startWebLoginWithQrLocal } = await loadLoginQrModule();
  return await startWebLoginWithQrLocal(...args);
}

// GoClaw fork: pairing-code login surface.
export async function startWebLoginWithPairingCode(
  ...args: Parameters<StartWebLoginWithPairingCode>
): ReturnType<StartWebLoginWithPairingCode> {
  const { startWebLoginWithPairingCode: startWebLoginWithPairingCodeLocal } =
    await loadLoginQrModule();
  return await startWebLoginWithPairingCodeLocal(...args);
}

export async function waitForWebLogin(
  ...args: Parameters<WaitForWebLogin>
): ReturnType<WaitForWebLogin> {
  const { waitForWebLogin: waitForWebLoginLocal } = await loadLoginQrModule();
  return await waitForWebLoginLocal(...args);
}
