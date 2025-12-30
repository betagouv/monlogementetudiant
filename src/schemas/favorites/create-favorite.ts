import z from 'zod'

export const ZPostFavorite = z.object({
  accommodation_slug: z.string(),
})

export type TPostFavorite = z.infer<typeof ZPostFavorite>
