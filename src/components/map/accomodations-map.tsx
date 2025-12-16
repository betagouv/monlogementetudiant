'use client'

import { FC, useEffect, useMemo } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { tss } from 'tss-react'
import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import 'leaflet-defaulticon-compatibility'
import { parseAsString, useQueryStates } from 'nuqs'
import { useAccomodations } from '~/hooks/use-accomodations'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'

interface AccomodationsMapProps {
  data: TGetAccomodationsResponse
}

const BoundsHandler: FC = () => {
  const map = useMap()
  const [queryStates, setQueryStates] = useQueryStates({
    bbox: parseAsString,
    academie: parseAsString,
    ['recherche-par-carte']: parseAsString,
  })

  useEffect(() => {
    if (queryStates.bbox) {
      const [west, south, east, north] = queryStates.bbox.split(',').map(Number)
      map.fitBounds([
        [south, west],
        [north, east],
      ])
    } else {
      map.setView([46.5, 2.4], 6)
    }
  }, [queryStates.bbox, map])

  useMapEvents({
    dragend: (e) => {
      const bounds = e.target.getBounds()
      setQueryStates({
        bbox: `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,
        academie: null,
        ['recherche-par-carte']: 'true',
      })
    },
    zoomend: (e) => {
      const bounds = e.target.getBounds()
      setQueryStates({
        bbox: `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,
        academie: null,
        ['recherche-par-carte']: 'true',
      })
    },
  })

  return null
}

export const AccomodationsMap: FC<AccomodationsMapProps> = ({ data }) => {
  const { classes } = useStyles()
  const [queryStates, setQueryStates] = useQueryStates({
    bbox: parseAsString,
    id: parseAsString,
  })

  const { data: accommodations } = useAccomodations({ initialData: data })
  const markers = useMemo(() => {
    const accommodationsData = accommodations?.results.features || []
    return accommodationsData.map((accommodation) => (
      <Marker
        eventHandlers={{
          click: () => {
            const element = document.getElementById(`accomodation-${accommodation.id}`)
            if (element) {
              setQueryStates({ id: accommodation.id.toString() })
              element.scrollIntoView({ behavior: 'smooth' })
            }
          },
        }}
        key={accommodation.id}
        position={[accommodation.geometry.coordinates[1], accommodation.geometry.coordinates[0]]}
      />
    ))
  }, [accommodations, queryStates.bbox, setQueryStates])

  const memoizedMap = useMemo(() => {
    return (
      <MapContainer center={[46.5, 2.4]} zoom={6} className={classes.mapContainer} scrollWheelZoom={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <BoundsHandler />
        {markers}
      </MapContainer>
    )
  }, [markers, queryStates.bbox])

  return memoizedMap
}

const useStyles = tss.create({
  mapContainer: {
    '[href]': {
      backgroundImage: 'unset !important',
    },
    width: '100%',
  },
})
