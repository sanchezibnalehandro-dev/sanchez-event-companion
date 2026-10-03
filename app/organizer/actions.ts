"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { safeOrganizerNext } from "@/lib/auth/organizer-next";
import {
  getPostgresOrganizerAuthService,
  ORGANIZER_SESSION_COOKIE,
} from "@/lib/auth/request-organizer";

function value(formData: FormData, name: string): string {
  const field = formData.get(name);
  return typeof field === "string" ? field : "";
}

function loginFailureUrl(next: string): string {
  return `/organizer/login?error=1&next=${encodeURIComponent(next)}`;
}

export async function loginOrganizerAction(formData: FormData): Promise<never> {
  const next = safeOrganizerNext(value(formData, "next"));
  const service = getPostgresOrganizerAuthService();
  if (!service) redirect(loginFailureUrl(next));

  const result = await service.login(value(formData, "email"), value(formData, "password"));
  if (!result) redirect(loginFailureUrl(next));

  const cookieStore = await cookies();
  cookieStore.set(ORGANIZER_SESSION_COOKIE, result.rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: result.expiresAt,
    maxAge: 7 * 24 * 60 * 60,
  });
  redirect(next);
}

export async function logoutOrganizerAction(): Promise<never> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ORGANIZER_SESSION_COOKIE)?.value ?? "";
  const service = getPostgresOrganizerAuthService();
  if (service && rawToken) await service.logout(rawToken);
  cookieStore.delete({
    name: ORGANIZER_SESSION_COOKIE,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  redirect("/organizer/login");
}
