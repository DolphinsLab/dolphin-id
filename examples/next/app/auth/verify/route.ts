import { NextResponse } from "next/server";

import { SESSION_COOKIE, auth } from "../auth-store";

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof auth.verifySignIn>[0];
  const result = await auth.verifySignIn(body);
  const response = NextResponse.json({
    session: result.session,
    user: result.user,
    verification: result.verification
  });

  response.cookies.set(SESSION_COOKIE, result.session.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: result.session.expiresAt
  });

  return response;
}
