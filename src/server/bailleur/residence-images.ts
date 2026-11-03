import { deleteFile, generateAccommodationKey, uploadFile } from '~/server/services/s3'
import { detectMimeType } from '~/utils/detect-mime-type'

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024
export const MAX_IMAGE_COUNT = 10
export const MAX_TOTAL_IMAGES_SIZE = 50 * 1024 * 1024

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export class ResidenceImagesError extends Error {}

const isAllowedType = (type: string | null): type is string => type !== null && type in MIME_TO_EXT

async function prepareFiles(files: File[]) {
  if (files.length === 0) throw new ResidenceImagesError('Aucune image valide fournie')
  if (files.length > MAX_IMAGE_COUNT) throw new ResidenceImagesError(`Trop de fichiers. Maximum : ${MAX_IMAGE_COUNT}`)
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_IMAGES_SIZE) {
    throw new ResidenceImagesError('Taille cumulée des fichiers trop importante. Maximum : 50 Mo')
  }

  const prepared = []
  for (const file of files) {
    if (!isAllowedType(file.type)) {
      throw new ResidenceImagesError(`Type de fichier non supporté : ${file.type}. Types acceptés : jpeg, png, webp`)
    }
    if (file.size > MAX_IMAGE_SIZE) throw new ResidenceImagesError(`Fichier trop volumineux : ${file.name}. Taille maximale : 10 Mo`)

    const body = Buffer.from(await file.arrayBuffer())
    const contentType = detectMimeType(body)
    if (!isAllowedType(contentType)) throw new ResidenceImagesError(`Contenu de fichier invalide : ${file.name}`)

    prepared.push({ key: generateAccommodationKey(MIME_TO_EXT[contentType]), body, contentType })
  }
  return prepared
}

export async function storeResidenceImages<T>(files: File[], persist: (urls: string[]) => Promise<T>): Promise<T> {
  const prepared = await prepareFiles(files)

  const uploadedKeys: string[] = []
  try {
    const urls: string[] = []
    for (const file of prepared) {
      urls.push(await uploadFile(file))
      uploadedKeys.push(file.key)
    }
    return await persist(urls)
  } catch (error) {
    await Promise.allSettled(uploadedKeys.map((key) => deleteFile(key)))
    throw error
  }
}
