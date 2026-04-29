'use client'

import dynamic from 'next/dynamic'

import { MapSkeleton } from '~/components/map/map-skeleton'

const AccomodationMap = dynamic(() => import('~/components/map/accomodation-map').then((mod) => mod.AccomodationMap), {
  loading: () => <MapSkeleton height={400} />,
  ssr: false,
})

type Position = [number, number]

const AccommodationMap = ({ positions, withScroll = false }: { positions: Position[]; withScroll?: boolean }) => {
  return <AccomodationMap positions={positions} withScroll={withScroll} />
}

export default AccommodationMap
