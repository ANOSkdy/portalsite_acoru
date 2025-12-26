import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);

  const url = new URL("/login", request.url);
  return NextResponse.redirect(url, { status: 303 });
}
