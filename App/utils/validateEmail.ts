/**
 * Validates whether a string is a valid email address.
 */
export function validateEmail(email: string): boolean {
  const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
  return regex.test(email.toLowerCase())
}
