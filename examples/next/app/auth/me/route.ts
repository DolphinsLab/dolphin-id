import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE, readSession } from "../auth-store";

export async function GET() {
  const cookieStore = await cookies();
  const session = readSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ session: null }, { status: 401 });
  }

  return NextResponse.json({ session });
}
