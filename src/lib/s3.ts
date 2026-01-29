import { S3Client } from "@aws-sdk/client-s3"

function requiredEnv(name: string): string {
  const v = (process.env[name] || "").trim()
  if (!v) throw new Error(`Falta variable de entorno: ${name}`)
  return v
}

export function isS3Enabled(): boolean {
  return Boolean((process.env.S3_BUCKET || "").trim())
}

export function getS3Client(): S3Client {
  const endpoint = requiredEnv("S3_ENDPOINT")
  const region = (process.env.S3_REGION || "us-east-1").trim() || "us-east-1"
  const accessKeyId = requiredEnv("S3_ACCESS_KEY_ID")
  const secretAccessKey = requiredEnv("S3_SECRET_ACCESS_KEY")

  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  })
}

export function getS3Bucket(): string {
  return requiredEnv("S3_BUCKET")
}

export function getS3PublicBaseUrl(): string {
  // Ejemplos:
  // - https://<bucket>.nyc3.digitaloceanspaces.com
  // - https://cdn.tu-dominio.com
  const v = (process.env.S3_PUBLIC_BASE_URL || "").trim()
  if (v) return v.replace(/\/+$/, "")

  // Fallback (menos recomendado): construir desde endpoint.
  const endpoint = requiredEnv("S3_ENDPOINT").replace(/\/+$/, "")
  const bucket = getS3Bucket()

  // Si el endpoint ya incluye protocolo y host, intentamos formar https://bucket.host
  try {
    const u = new URL(endpoint)
    return `${u.protocol}//${bucket}.${u.host}`
  } catch {
    return endpoint
  }
}
