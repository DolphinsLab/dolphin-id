import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSessionCookieOptions } from "@dolphin-id/server";

import { REFRESH_COOKIE, SESSION_COOKIE, auth } from "../auth-store";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const body = (await request.json().catch(() => ({}))) as { readonly refreshToken?: string };
  const result = await auth.refreshSession({
    refreshToken: body.refreshToken ?? cookieStore.get(REFRESH_COOKIE)?.value ?? ""
  });
  const response = NextResponse.json({
    session: result.session,
    refreshToken: result.refreshToken
  });
  const cookieOptions = createSessionCookieOptions({
    name: SESSION_COOKIE,
    expires: result.session.expiresAt,
    runtimeEnvironment: process.env.NODE_ENV
  });
  const refreshCookieOptions = createSessionCookieOptions({
    name: REFRESH_COOKIE,
    expires: result.refreshToken.expiresAt,
    runtimeEnvironment: process.env.NODE_ENV
  });

  response.cookies.set(cookieOptions.name, result.session.token, {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path,
    expires: cookieOptions.expires
  });
  response.cookies.set(refreshCookieOptions.name, result.refreshToken.token, {
    httpOnly: refreshCookieOptions.httpOnly,
    secure: refreshCookieOptions.secure,
    sameSite: refreshCookieOptions.sameSite,
    path: refreshCookieOptions.path,
    expires: refreshCookieOptions.expires
  });

  return response;
}
