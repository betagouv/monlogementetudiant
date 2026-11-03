'use client'

import { FC, useEffect } from 'react'
import { MapContainer, useMap } from 'react-leaflet'
import { tss } from 'tss-react'
import { BaseTileLayer } from '~/components/map/base-tile-layer'
import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import 'leaflet-defaulticon-compatibility'

const BoundsHandler: FC<{ bbox: string }> = ({ bbox }) => {
  const map = useMap()

  useEffect(() => {
    if (bbox) {
      const [west, south, east, north] = bbox.split(',').map(Number)
      map.fitBounds([
        [south, west],
        [north, east],
      ])
    }
  }, [bbox, map])

  return null
}

export const CityMap: FC<{ bbox: string }> = ({ bbox }) => {
  const { classes } = useStyles()

  return (
    <MapContainer zoom={16} className={classes.mapContainer}>
      <BaseTileLayer />
      <BoundsHandler bbox={bbox} />
    </MapContainer>
  )
}

const useStyles = tss.create({
  mapContainer: {
    '[href]': {
      backgroundImage: 'unset !important',
    },
    height: '100%',
    width: '100%',
  },
})
