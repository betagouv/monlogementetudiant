import { z } from 'zod'

const ZModerationManagerAssignment = z.object({
  userId: z.string().min(1),
  enabled: z.boolean(),
})

export const ZModerationSettingsForm = z.object({
  managers: z.array(ZModerationManagerAssignment),
})

export const ZSetApplicationsPermission = z.object({
  ownerId: z.number().optional(),
  managers: z.array(ZModerationManagerAssignment).min(1).max(200),
})

export type TModerationSettingsForm = z.infer<typeof ZModerationSettingsForm>
export type TSetApplicationsPermission = z.infer<typeof ZSetApplicationsPermission>
