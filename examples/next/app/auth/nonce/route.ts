import { NextResponse } from "next/server";

import { auth } from "../auth-store";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    readonly purpose?: string;
    readonly domain?: string;
    readonly address?: string;
    readonly chainType?: string;
    readonly walletName?: string;
  };

  const nonce = await auth.issueNonce({
    purpose: body.purpose ?? "sign-in",
    ...(body.domain ? { domain: body.domain } : {}),
    ...(body.address ? { address: body.address } : {}),
    ...(body.chainType ? { chainType: body.chainType } : {}),
    ...(body.walletName ? { walletName: body.walletName } : {})
  });

  return NextResponse.json({
    nonce: nonce.nonce,
    expiresAt: nonce.expiresAt.toISOString()
  });
}
