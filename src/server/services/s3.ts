import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { env } from '~/server/env'

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
})

const bucket = env.S3_BUCKET

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

  const endpoint = env.S3_ENDPOINT.replace(/\/$/, '')
  return `${endpoint.replace('://', `://${bucket}.`)}/${input.key}`
}

export function generateAccommodationKey(ext: string): string {
  const uuidHex = randomUUID().replace(/-/g, '')
  return `accommodations${env.S3_SUFFIX_DIR}/${uuidHex}.${ext}`
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  )
}
