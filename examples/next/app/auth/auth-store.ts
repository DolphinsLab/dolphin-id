import { createServerAuth, decodeJwtPayload, type VerificationRequest } from "@dolphin-id/server";

export const SESSION_COOKIE = "dolphin_session";

export const auth = createServerAuth({
  jwtSecret: "local-development-secret-with-32-plus-characters",
  verifySiwx: async (request: VerificationRequest) => {
    const expected = `mock-siwx:${request.message.format}:${request.nonce}:${request.message.address}`;

    if (request.signature !== expected) {
      return { ok: false, reason: "Mock wallet signature is invalid." };
    }

    return {
      ok: true,
      subject: `${request.message.chainType}:${request.message.chainId}:${request.message.address.toLowerCase()}`
    };
  }
});

export function readSession(token: string | undefined) {
  if (!token) {
    return null;
  }

  const payload = decodeJwtPayload(token);
  const expiresAtSeconds = typeof payload.exp === "number" ? payload.exp : 0;

  if (expiresAtSeconds * 1000 <= Date.now()) {
    return null;
  }

  return {
    subject: String(payload.sub),
    issuedAt: new Date(Number(payload.iat) * 1000).toISOString(),
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
    token
  };
}
