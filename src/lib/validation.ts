import { z } from "zod";

export const emailSchema = z
  .email({ message: "Enter a valid email address." })
  .trim()
  .toLowerCase()
  .max(254);

export const passwordSchema = z.string().min(10, "Use at least 10 characters.").max(128);

export const nameSchema = z.string().trim().max(80).optional();

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
  next: z.string().max(500).optional(),
});

export const tokenSchema = z.string().min(20).max(200);

/** Only allow same site relative paths for post sign in redirects. */
export function safeNext(next: string | undefined | null, fallback = "/advisors"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) return fallback;
  return next;
}
