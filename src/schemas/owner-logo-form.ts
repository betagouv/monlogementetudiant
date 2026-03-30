import { z } from 'zod'

export const ZOwnerLogoInput = z.object({
  id: z.number(),
  image: z.string().nullable(),
})

export type TOwnerLogoInput = z.infer<typeof ZOwnerLogoInput>
