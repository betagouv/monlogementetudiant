'use client'

import { fr } from '@codegouvfr/react-dsfr'
import L from 'leaflet'
import { useTranslations } from 'next-intl'
import { FC, useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap, ZoomControl } from 'react-leaflet'
import { tss } from 'tss-react'
import { MapAccessibleName } from '~/components/map/map-accessible-name'
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

export const AccomodationMap: FC<{ positions: Position[]; withScroll: boolean; label?: string }> = ({ positions, withScroll, label }) => {
  const t = useTranslations('map')
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
      // Sur mobile, le glisser à un doigt piégerait le défilement de la page : on n'y garde que le pincement.
      dragging={withScroll || !L.Browser.mobile}
      zoomControl={false}
    >
      <ZoomControl zoomInTitle={t('zoomIn')} zoomOutTitle={t('zoomOut')} />
      <MapAccessibleName label={label ?? t('accommodationLabel')} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {positions.map((p, i) => (
        // Sans alt explicite, Leaflet applique son alternative par défaut « Marker » : un mot
        // anglais qui nomme le composant technique au lieu de ce que le marqueur désigne.
        <Marker key={`${p[0]}-${p[1]}-${i}`} position={p} alt={t('markerLabel')} />
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
