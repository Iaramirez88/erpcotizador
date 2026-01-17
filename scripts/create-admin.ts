/**
 * Script para crear un usuario administrador
 * Ejecutar con: npx tsx scripts/create-admin.ts
 */

import { PrismaClient } from '.prisma/client/default'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config()

// Configurar pool de conexiones
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🔄 Creando usuario administrador...')
  
  const email = 'admin@sgdigital.com'
  const password = 'admin123'
  
  // Verificar si ya existe
  const existingUser = await prisma.user.findUnique({
    where: { email }
  })
  
  if (existingUser) {
    console.log('⚠️  El usuario admin ya existe')
    console.log('📧 Email:', email)
    return
  }
  
  // Encriptar contraseña
  const hashedPassword = await bcrypt.hash(password, 12)
  
  // Crear usuario
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador SGDigital',
      email: email,
      password: hashedPassword,
      role: 'ADMIN',
      emailVerified: new Date()
    }
  })
  
  console.log('✅ Usuario administrador creado exitosamente!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📧 Email:', email)
  console.log('🔑 Contraseña:', password)
  console.log('👤 Rol:', admin.role)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⚠️  IMPORTANTE: Cambia esta contraseña después del primer login')
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
