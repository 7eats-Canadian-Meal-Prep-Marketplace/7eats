// Shared password policy used by every place a password is created or reset
// (cook account setup, password reset, etc.) so client and server stay in sync.

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] =
  [
    {
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      test: (p) => p.length >= PASSWORD_MIN_LENGTH,
    },
    { label: "An uppercase letter", test: (p) => /[A-Z]/.test(p) },
    { label: "A lowercase letter", test: (p) => /[a-z]/.test(p) },
    { label: "A number", test: (p) => /\d/.test(p) },
    {
      label: "A special character",
      test: (p) => /[^A-Za-z0-9]/.test(p),
    },
  ];

/** Returns an error message if the password fails policy, otherwise null. */
export function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter.";
  }
  if (!/\d/.test(password)) {
    return "Password must include a number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include a special character.";
  }
  return null;
}

export function isPasswordValid(password: string): boolean {
  return validatePassword(password) === null;
}
