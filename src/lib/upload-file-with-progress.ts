type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

type UploadFileWithProgressArgs = {
  url: string
  file: File
  onProgress?: (progress: number) => void
}

export function uploadFileWithProgress<T>(args: UploadFileWithProgressArgs): Promise<JsonResponse<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', args.file)

    xhr.open('POST', args.url)
    xhr.responseType = 'json'

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return
      const progress = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)))
      args.onProgress?.(progress)
    })

    xhr.addEventListener('load', () => {
      const body = (xhr.response ?? (() => {
        try {
          return JSON.parse(xhr.responseText || '{}')
        } catch {
          return {}
        }
      })()) as JsonResponse<T>

      if (xhr.status >= 200 && xhr.status < 300) {
        args.onProgress?.(100)
        resolve(body)
        return
      }

      reject(new Error(body.error || 'No se pudo subir el archivo.'))
    })

    xhr.addEventListener('error', () => {
      reject(new Error('No se pudo subir el archivo.'))
    })

    xhr.addEventListener('abort', () => {
      reject(new Error('La subida fue cancelada.'))
    })

    xhr.send(formData)
  })
}