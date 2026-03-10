import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'gra',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
})

const bucket = process.env.S3_BUCKET!

export async function uploadFile(input: { key: string; body: Buffer; contentType: string }): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      ACL: 'public-read',
    }),
  )

  const endpoint = process.env.S3_ENDPOINT!.replace(/\/$/, '')
  return `${endpoint.replace('://', `://${bucket}.`)}/${input.key}`
}

export function generateAccommodationKey(ext: string): string {
  const suffixDir = process.env.S3_SUFFIX_DIR ?? ''
  const uuidHex = randomUUID().replace(/-/g, '')
  return `accommodations${suffixDir}/${uuidHex}.${ext}`
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  )
}
