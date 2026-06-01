import { NextResponse } from "next/server";
import { createSessionCookieOptions } from "@dolphin-id/server";

import { SESSION_COOKIE, auth } from "../auth-store";

export async function POST(request: Request) {
  const body = (await request.json()) as Parameters<typeof auth.verifySignIn>[0];
  const result = await auth.verifySignIn(body);
  const response = NextResponse.json({
    session: result.session,
    user: result.user,
    verification: result.verification
  });
  const cookieOptions = createSessionCookieOptions({
    name: SESSION_COOKIE,
    expires: result.session.expiresAt,
    runtimeEnvironment: process.env.NODE_ENV
  });

  response.cookies.set(cookieOptions.name, result.session.token, {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path,
    expires: cookieOptions.expires
  });

  return response;
}
