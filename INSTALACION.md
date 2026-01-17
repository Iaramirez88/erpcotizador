# 🚀 Guía de Instalación y Configuración

## 📦 Paso 1: Instalar Dependencias

Abre la terminal en la carpeta del proyecto y ejecuta:

```bash
npm install
```

Esto instalará todas las dependencias necesarias:
- **next**: Framework React para producción
- **react & react-dom**: Biblioteca de UI
- **typescript**: Tipado estático
- **tailwindcss**: Estilos CSS utility-first
- **prisma & @prisma/client**: ORM para base de datos
- **next-auth**: Autenticación
- **bcryptjs**: Encriptación de contraseñas
- **zod**: Validación de esquemas
- **zustand**: Manejo de estado global
- **radix-ui**: Componentes UI accesibles
- Y más...

## 🗄️ Paso 2: Configurar Base de Datos PostgreSQL

### Opción A: PostgreSQL Local

1. **Instalar PostgreSQL** (si no lo tienes):
   - Windows: Descarga desde https://www.postgresql.org/download/windows/
   - Instala y recuerda la contraseña del usuario `postgres`

2. **Crear la base de datos**:
   ```sql
   CREATE DATABASE sgdigital_cotizador;
   ```

### Opción B: PostgreSQL en la Nube (Recomendado para empezar)

Usa **Supabase** (gratis):
1. Crea cuenta en https://supabase.com
2. Crea un nuevo proyecto
3. Copia la cadena de conexión (Connection String)

### Opción C: Docker (Alternativa rápida)

```bash
docker run --name postgres-sgdigital \
  -e POSTGRES_PASSWORD=tupassword \
  -e POSTGRES_DB=sgdigital_cotizador \
  -p 5432:5432 \
  -d postgres:15
```

## 🔐 Paso 3: Configurar Variables de Entorno

1. **Copia el archivo de ejemplo**:
   ```bash
   copy .env.example .env
   ```

2. **Edita el archivo `.env`** con tus datos:

   ```env
   # Base de datos
   DATABASE_URL="postgresql://usuario:password@localhost:5432/sgdigital_cotizador"
   
   # Para Supabase usa algo como:
   # DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
   
   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="genera-un-secreto-aqui-min-32-caracteres"
   ```

3. **Generar NEXTAUTH_SECRET**:
   ```bash
   # Ejecuta en terminal PowerShell:
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   Copia el resultado y pégalo en NEXTAUTH_SECRET

## 🔧 Paso 4: Configurar Prisma

1. **Generar el cliente de Prisma**:
   ```bash
   npx prisma generate
   ```

2. **Crear las tablas en la base de datos**:
   ```bash
   npx prisma db push
   ```

   O si prefieres usar migraciones (recomendado para producción):
   ```bash
   npx prisma migrate dev --name init
   ```

3. **Verificar con Prisma Studio** (opcional):
   ```bash
   npx prisma studio
   ```
   Esto abre una interfaz web en http://localhost:5555 para ver tus tablas

## 🏃 Paso 5: Ejecutar el Proyecto

### Modo Desarrollo

```bash
npm run dev
```

Abre http://localhost:3000 en tu navegador

### Modo Producción

```bash
npm run build
npm start
```

## 👤 Paso 6: Crear el Primer Usuario

### Opción A: Desde la Interfaz

1. Abre http://localhost:3000
2. Serás redirigido a `/auth/login`
3. Click en "Regístrate aquí"
4. Completa el formulario
5. Inicia sesión con tus credenciales

### Opción B: Con Prisma Studio

1. Ejecuta `npx prisma studio`
2. Ve a la tabla `users`
3. Haz click en "Add record"
4. Completa los campos (la contraseña debe estar hasheada)

### Opción C: Crear usuario ADMIN directamente (Recomendado)

Ya viene incluido el script `scripts/create-admin.ts`.

Ejecuta:
```bash
npx tsx scripts/create-admin.ts
```

Usuario: `admin@sgdigital.com`  
Contraseña: `admin123`

## 🎨 Estructura del Proyecto

```
cotizador-inteligente/
├── prisma/
│   └── schema.prisma         # Esquema de base de datos
├── src/
│   ├── app/                  # App Router de Next.js 16
│   │   ├── api/              # API Routes
│   │   │   └── auth/         # Endpoints de autenticación
│   │   ├── auth/             # Páginas de autenticación
│   │   │   ├── login/
│   │   │   └── register/
│   │   └── dashboard/        # Dashboard principal
│   ├── components/           # Componentes React
│   │   ├── ui/               # Componentes UI base
│   │   └── dashboard/        # Componentes del dashboard
│   ├── lib/                  # Utilidades y configuración
│   │   ├── auth.ts           # Configuración NextAuth
│   │   ├── prisma.ts         # Cliente Prisma
│   │   └── utils.ts          # Funciones utilitarias
│   └── types/                # TypeScript types
└── ROADMAP.md                # Plan completo del proyecto
```

## 🔍 Verificar que Todo Funciona

### Checklist:

- [ ] Base de datos conectada
- [ ] Tablas creadas en la BD
- [ ] Variables de entorno configuradas
- [ ] Proyecto ejecutándose en http://localhost:3000
- [ ] Puedes registrar un usuario
- [ ] Puedes iniciar sesión
- [ ] Ves el dashboard correctamente

## ❓ Solución de Problemas Comunes

### Error: "Environment variable not found: DATABASE_URL"
- Verifica que el archivo `.env` existe en la raíz del proyecto
- Verifica que la variable DATABASE_URL está correctamente escrita

### Error: "Can't reach database server"
- Verifica que PostgreSQL está corriendo
- Verifica que los datos de conexión son correctos
- Prueba la conexión con: `npx prisma db pull`

### Error: "Module not found"
- Ejecuta: `npm install`
- Ejecuta: `npx prisma generate`

### Error: "NEXTAUTH_SECRET must be provided"
- Genera un secreto como se indicó arriba
- Agrégalo al archivo `.env`
- Reinicia el servidor de desarrollo

## 📚 Próximos Pasos

Una vez que todo funciona, puedes:

1. **Personalizar el tema**: Edita `tailwind.config.ts`
2. **Crear el módulo de clientes**: Ver ROADMAP.md
3. **Desarrollar el cotizador**: Seguir el plan de fases
4. **Agregar más usuarios**: Usar el formulario de registro

## 🆘 Ayuda

Si tienes problemas:
1. Revisa los logs en la terminal
2. Revisa las DevTools del navegador (F12)
3. Verifica Prisma Studio para ver si los datos están guardándose
4. Consulta el ROADMAP.md para el plan completo

---

**¡Listo para empezar!** 🎉
