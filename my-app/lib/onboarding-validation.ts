/** Returns an error message when DOB fails the 16+ policy, otherwise null. */
export function validateDateOfBirth16(dob: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return "Enter a valid date of birth.";
  }
  const birth = new Date(`${dob}T12:00:00`);
  if (Number.isNaN(birth.getTime())) {
    return "Enter a valid date of birth.";
  }
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 16);
  if (birth > cutoff) {
    return "You must be at least 16 years old to use 7eats.";
  }
  return null;
}

export function isAtLeast16(dob: string): boolean {
  return validateDateOfBirth16(dob) === null;
}
