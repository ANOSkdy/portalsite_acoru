"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { getUserByEmail } from "@/lib/airtable";
import { verifyPassword } from "@/lib/password";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from "@/lib/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const parsed = schema.safeParse({ email, password });
  if (!parsed.success) redirect("/login?error=invalid");

  const user = await getUserByEmail(parsed.data.email);
  if (!user) redirect("/login?error=invalid");

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) redirect("/login?error=invalid");

  const token = await createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect("/home");
}
