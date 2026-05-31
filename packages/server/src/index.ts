import type { SiwxMessage } from "@dolphin-id/core";

export interface NonceRecord {
  readonly nonce: string;
  readonly expiresAt: Date;
  readonly consumedAt?: Date;
}

export interface VerificationRequest {
  readonly message: SiwxMessage;
  readonly signature: string;
}

export interface VerificationResult {
  readonly ok: boolean;
  readonly subject?: string;
  readonly reason?: string;
}

export function isNonceExpired(record: NonceRecord, now: Date = new Date()): boolean {
  return record.expiresAt.getTime() <= now.getTime();
}

export async function verifySiwxPlaceholder(
  request: VerificationRequest
): Promise<VerificationResult> {
  if (!request.signature) {
    return { ok: false, reason: "Missing signature." };
  }

  return { ok: true, subject: request.message.address };
}
