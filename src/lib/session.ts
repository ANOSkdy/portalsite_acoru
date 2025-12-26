import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "portal_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role?: string;
};

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing env: SESSION_SECRET");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role ?? "",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE_SECONDS)
    .setSubject(user.id)
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser> {
  const { payload } = await jwtVerify(token, getSessionSecret(), {
    algorithms: ["HS256"],
  });

  const id = String(payload.id ?? payload.sub ?? "");
  const email = String(payload.email ?? "");
  const name = String(payload.name ?? "");
  const roleRaw = payload.role ? String(payload.role) : "";

  if (!id || !email || !name) throw new Error("Invalid session payload");

  return {
    id,
    email,
    name,
    role: roleRaw ? roleRaw : undefined,
  };
}
