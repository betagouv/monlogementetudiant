import { ZAccommodationSelection } from '~/schemas/accommodations/accommodation-selection'

export const ZBailleurAccommodationScope = ZAccommodationSelection

export type TBailleurAccommodationScope = ReturnType<typeof ZBailleurAccommodationScope.parse>
