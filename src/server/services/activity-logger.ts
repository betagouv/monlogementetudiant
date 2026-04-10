import { db } from '~/server/db'
import { activityLog } from '~/server/db/schema/activity-log'

export async function logActivity(params: {
  userId?: string
  userName?: string
  action: string
  entityType: string
  entityId?: string
  entityName?: string
  ownerId?: number
  ownerName?: string
  metadata?: Record<string, unknown>
}) {
  await db.insert(activityLog).values(params)
}
