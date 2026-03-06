'use client'

import L from 'leaflet'
import { FC, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import 'leaflet-defaulticon-compatibility'
import clsx from 'clsx'
import styles from '../../administration.module.css'

type Accommodation = {
  id: number
  name: string
  city: string
  available: boolean
  nbTotalApartments: number | null
  nbAvailableApartments: number
  lat: number | null
  lng: number | null
}

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

export const OwnerMapTab: FC<{ accommodations: Accommodation[] }> = ({ accommodations }) => {
  const [filter, setFilter] = useState<'all' | 'available' | 'full'>('all')
  const [cityFilter, setCityFilter] = useState('')

  const cities = useMemo(() => {
    const set = new Set(accommodations.map((a) => a.city))
    return Array.from(set).sort()
  }, [accommodations])

  const geoAccommodations = useMemo(() => {
    return accommodations.filter((a) => a.lat != null && a.lng != null)
  }, [accommodations])

  const filtered = useMemo(() => {
    let result = geoAccommodations
    if (filter === 'available') result = result.filter((a) => a.nbAvailableApartments > 0)
    if (filter === 'full') result = result.filter((a) => a.nbAvailableApartments === 0)
    if (cityFilter) result = result.filter((a) => a.city === cityFilter)
    return result
  }, [geoAccommodations, filter, cityFilter])

  const center = useMemo<[number, number]>(() => {
    if (filtered.length === 0) return [46.5, 2.4]
    const avgLat = filtered.reduce((s, a) => s + a.lat!, 0) / filtered.length
    const avgLng = filtered.reduce((s, a) => s + a.lng!, 0) / filtered.length
    return [avgLat, avgLng]
  }, [filtered])

  return (
    <div>
      <div className="fr-flex fr-flex-gap-2v fr-mb-2w fr-align-items-end fr-flex-wrap">
        <div className="fr-flex fr-flex-gap-1v">
          <button
            type="button"
            className={clsx('fr-btn fr-btn--sm', filter === 'all' ? '' : 'fr-btn--tertiary')}
            onClick={() => setFilter('all')}
          >
            Toutes ({geoAccommodations.length})
          </button>
          <button
            type="button"
            className={clsx('fr-btn fr-btn--sm', filter === 'available' ? 'fr-btn--icon-left fr-icon-check-line' : 'fr-btn--tertiary')}
            onClick={() => setFilter(filter === 'available' ? 'all' : 'available')}
          >
            Disponible
          </button>
          <button
            type="button"
            className={clsx('fr-btn fr-btn--sm', filter === 'full' ? 'fr-btn--icon-left fr-icon-close-line' : 'fr-btn--tertiary')}
            onClick={() => setFilter(filter === 'full' ? 'all' : 'full')}
          >
            Complet
          </button>
        </div>
        <div>
          <select
            className="fr-select fr-select--sm"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            style={{ minWidth: 200 }}
          >
            <option value="">Toutes les villes</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
      </div>

      {geoAccommodations.length === 0 ? (
        <p className="fr-text--sm fr-text-mention--grey">Aucune résidence géolocalisée</p>
      ) : (
        <div className={styles.mapContainer} style={{ height: 500, borderRadius: '0.5rem', overflow: 'hidden' }}>
          <MapContainer
            key={`${center[0]}-${center[1]}`}
            center={center}
            zoom={filtered.length === 1 ? 13 : 6}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {filtered.map((acc) => (
              <Marker key={acc.id} position={[acc.lat!, acc.lng!]} icon={acc.nbAvailableApartments > 0 ? greenIcon : redIcon}>
                <Popup>
                  <strong>{acc.name}</strong>
                  <br />
                  {acc.city}
                  <br />
                  {acc.nbAvailableApartments} / {acc.nbTotalApartments ?? '?'} disponibles
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  )
}
