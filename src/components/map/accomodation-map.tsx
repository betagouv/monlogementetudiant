'use client'

import { fr } from '@codegouvfr/react-dsfr'
import L from 'leaflet'
import { FC, useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { tss } from 'tss-react'
import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import 'leaflet-defaulticon-compatibility'

type Position = [number, number]

const FitBounds: FC<{ positions: Position[] }> = ({ positions }) => {
  const map = useMap()
  useEffect(() => {
    if (positions.length < 2) return
    map.fitBounds(L.latLngBounds(positions), { padding: [32, 32] })
  }, [map, positions])
  return null
}

export const AccomodationMap: FC<{ positions: Position[]; withScroll: boolean }> = ({ positions, withScroll }) => {
  const { classes } = useStyles()

  if (positions.length === 0) return null

  const center = positions[0]
  const isSingle = positions.length === 1

  return (
    <MapContainer
      center={center}
      zoom={isSingle ? 16 : 13}
      className={classes.mapContainer}
      scrollWheelZoom={withScroll}
      dragging={withScroll}
      touchZoom={withScroll}
      doubleClickZoom={withScroll}
      zoomControl={withScroll}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {positions.map((p, i) => (
        <Marker key={`${p[0]}-${p[1]}-${i}`} position={p} />
      ))}
      {!isSingle && <FitBounds positions={positions} />}
    </MapContainer>
  )
}

const useStyles = tss.create({
  mapContainer: {
    '[href]': {
      backgroundImage: 'unset !important',
    },
    [fr.breakpoints.down('sm')]: {
      height: '300px',
    },
    height: '300px',
    width: '100%',
  },
})
