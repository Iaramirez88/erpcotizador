export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir al menos 1 mayúscula'
  if (!/[a-z]/.test(password)) return 'La contraseña debe incluir al menos 1 minúscula'
  if (!/[0-9]/.test(password)) return 'La contraseña debe incluir al menos 1 número'
  // Caracteres permitidos: ASCII visibles sin espacios ("!" a "~")
  if (!/^[\x21-\x7E]+$/.test(password)) {
    return 'La contraseña solo puede contener caracteres visibles sin espacios'
  }
  return null
}
