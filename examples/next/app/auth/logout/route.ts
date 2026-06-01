import { NextResponse } from "next/server";

import { REFRESH_COOKIE, SESSION_COOKIE, auth } from "../auth-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { readonly refreshToken?: string };
  if (body.refreshToken) {
    await auth.revokeRefreshToken(body.refreshToken);
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  response.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}
