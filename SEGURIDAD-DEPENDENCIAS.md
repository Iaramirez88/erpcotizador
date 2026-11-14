# Seguridad de dependencias (npm audit)

Última revisión: **13/11/2026** · Resultado: **0 vulnerabilidades** (`npm audit`).

Este documento explica cómo se llegó a 0 vulnerabilidades, qué `overrides` son
intencionales y cómo actualizar dependencias sin romper el sistema.

## Comandos de verificación

```bash
npm audit                # debe reportar: found 0 vulnerabilities
npm run typecheck        # tsc --noEmit --incremental false
npm run lint             # eslint (flat config, eslint-config-next)
npm run build            # next build
```

## Cambios de versión aplicados

| Paquete | Antes | Ahora | Motivo |
| --- | --- | --- | --- |
| `next` | 16.2.1 | **16.4.6** | 4 avisos críticos + RCE/DoS/cache poisoning (minor dentro de 16.x). |
| `next-auth` | 5.0.0-beta.30 | **5.0.0-beta.32** | Arrastra `@auth/core 0.41.3` (homoglyph en email, getToken, cookies OAuth). |
| `@auth/core` | 0.41.0/0.41.1 | **0.41.3** | Avisos de severidad crítica de Auth.js. |
| `@auth/prisma-adapter` | 2.11.1 | **2.11.3** | Dependía de `@auth/core` vulnerable. |
| `zod` | 4.1.13 | **4.6.7** | DoS por memoria en colecciones con restricciones. |
| `prisma` / `@prisma/client` | 7.6.0 | **7.10.1** | Cadena `@prisma/dev` → `hono`, `@hono/node-server`, `valibot`, `deepmerge-ts`. |

El resto de avisos transitivos (postcss, sharp, fast-uri, undici, js-yaml,
nanoid, qs, tmp, brace-expansion, browserslist, fast-xml-parser, prosemirror-view,
source-map-js, @babel/core, etc.) se resolvió con actualizaciones compatibles
(`npm audit fix`) o con los `overrides` de abajo.

## Overrides intencionales (NO eliminar sin probar)

```jsonc
"overrides": {
  "qs": "6.15.0",                  // fijado previamente por el equipo
  "uuid": "11.1.1",                // exceljs usa require('uuid').v4 → compatible
  "happy-dom": "21.0.4",           // @puckeditor/core y @tiptap/html (SSR)
  "@tiptap/*": "3.34.0",           // familia tiptap SIEMPRE en la misma versión
  "@typescript-eslint/typescript-estree": { "minimatch": "11.0.8" },
  "eslint-plugin-react-hooks": "7.0.1"
}
```

Notas:

- **`uuid`**: solo lo usa `exceljs` (`const { v4: uuidv4 } = require("uuid")`).
  Verificado generando un `.xlsx` real.
- **`happy-dom` + `@tiptap/*`**: los usa el editor Puck (`@puckeditor/core`)
  del constructor de sitios web. Tiptap exige que **todos** sus paquetes
  compartan versión; por eso se fijan todos juntos. Verificado con
  `generateHTML()` de `@tiptap/html/server`.
- **`@typescript-eslint/typescript-estree` → `minimatch 11.0.8`**: el override
  está *scoped* para no alterar `minimatch@3` ni `minimatch@5` que usan otros
  paquetes. Minimatch 11 mantiene export CommonJS (`require("minimatch")`).
- **`eslint-plugin-react-hooks` 7.0.1**: se fija a propósito. La 7.1.x activa
  `react-hooks/set-state-in-effect`, que marca patrones preexistentes
  (restaurar preferencias de UI desde `localStorage` en un `useEffect`).
  Actualizar a 7.1.x requiere refactorizar esos efectos primero.

## Pendiente recomendado (no bloqueante)

- Subir `@puckeditor/core` 0.23.0 → 0.24.0 (hoy `npm audit` ya está en 0 gracias
  al override de `happy-dom`). Es un salto 0.x: requiere prueba manual del
  constructor de páginas y del render público.
- Subir `eslint-config-next` a 16.4.6 y resolver los avisos
  `react-hooks/set-state-in-effect` del código (inicialización de estado desde
  `localStorage`, sincronización de `dueAt` con la fecha seleccionada).

## Cómo actualizar dependencias con seguridad

1. `git status` limpio y rama de trabajo.
2. `npm audit` → anotar el estado inicial.
3. `npm audit fix` (sin `--force`): solo cambios semver-compatibles.
4. Revisar `git diff package.json` y `git status`.
5. `npm run typecheck` y `npm run lint`.
6. `npm run build` y smoke test de rutas críticas.
7. Solo entonces commit del `package.json` + `package-lock.json`.

> Tras un upgrade de `next` o `prisma` hay que **reiniciar** el dev server
> (`npm run dev`): el proceso mantiene en memoria la versión anterior.
