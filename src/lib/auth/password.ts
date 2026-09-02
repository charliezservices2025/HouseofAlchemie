import "server-only";
import { hash, verify } from "@node-rs/argon2";

// argon2id with parameters in line with current OWASP guidance.
const OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain, OPTIONS);
  } catch {
    return false;
  }
}

export const PASSWORD_MIN_LENGTH = 10;

export function passwordProblem(plain: string): string | null {
  if (plain.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (plain.length > 128) {
    return "That is longer than we can accept. Keep it under 128 characters.";
  }
  if (!/[a-zA-Z]/.test(plain) || !/[0-9]/.test(plain)) {
    return "Include at least one letter and one number.";
  }
  return null;
}
