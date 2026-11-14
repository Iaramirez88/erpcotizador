export function parseWebFormOptionList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function serializeWebFormOptionList(options: string[]): string {
  return options.map((option) => option.trim()).join(', ')
}

export function webFormOptionsSignature(options: string[]): string {
  return options.map((option) => option.trim()).join('\u0000')
}

/**
 * Define el texto visible del input de opciones de un campo select/radio.
 * Mientras el borrador represente las mismas opciones guardadas se muestra tal cual
 * (conservando comas y espacios que el usuario está escribiendo). Si las opciones
 * cambian desde fuera (cambio de tipo, revertir, recargar) se descarta el borrador.
 */
export function resolveWebFormOptionsDraftValue(draft: string | null, options: string[]): string {
  if (draft === null) return serializeWebFormOptionList(options)

  return webFormOptionsSignature(parseWebFormOptionList(draft)) === webFormOptionsSignature(options)
    ? draft
    : serializeWebFormOptionList(options)
}
