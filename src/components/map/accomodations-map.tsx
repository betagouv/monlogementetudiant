'use client'

import { useQuery } from '@tanstack/react-query'
import type L from 'leaflet'
import { FC, useEffect, useMemo } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { tss } from 'tss-react'
import { MapAccessibleName } from '~/components/map/map-accessible-name'
import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import 'leaflet-defaulticon-compatibility'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { parseAsBoolean, parseAsString, useQueryState, useQueryStates } from 'nuqs'
import { useAccomodations } from '~/hooks/use-accomodations'
import { useTRPC } from '~/server/trpc/client'

const BoundsHandler: FC<{ markerPositions: L.LatLngTuple[]; territoryBounds?: L.LatLngBoundsExpression }> = ({
  markerPositions,
  territoryBounds,
}) => {
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
    } else if (markerPositions.length > 0) {
      map.fitBounds(markerPositions, { padding: [20, 20] })
    } else if (territoryBounds) {
      map.fitBounds(territoryBounds, { padding: [50, 50] })
    } else {
      map.setView([46.5, 2.4], 6)
    }
  }, [queryStates.bbox, markerPositions, territoryBounds, map])

  useMapEvents({
    dragend: (e) => {
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

const CustomZoomControls: FC = () => {
  const t = useTranslations('map')
  const map = useMap()
  const [, setQueryStates] = useQueryStates({
    bbox: parseAsString,
    academie: parseAsString,
    ['recherche-par-carte']: parseAsString,
  })

  const handleZoomIn = () => {
    map.zoomIn()
    const bounds = map.getBounds()
    setQueryStates({
      bbox: `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,
      academie: null,
      ['recherche-par-carte']: 'true',
    })
  }

  const handleZoomOut = () => {
    map.zoomOut()
    const bounds = map.getBounds()

    setQueryStates({
      bbox: `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,
      academie: null,
      ['recherche-par-carte']: 'true',
    })
  }

  return (
    <div
      className="leaflet-control-zoom leaflet-bar leaflet-control "
      style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        zIndex: 1000,
      }}
    >
      <button
        className="leaflet-control-zoom-in"
        type="button"
        title={t('zoomIn')}
        aria-label={t('zoomInLabel')}
        onClick={handleZoomIn}
        style={{
          width: '30px',
          height: '30px',
          display: 'block',
          border: 'none',
          backgroundColor: 'white',
          cursor: 'pointer',
        }}
      >
        +
      </button>
      <button
        className="leaflet-control-zoom-out"
        type="button"
        title={t('zoomOut')}
        aria-label={t('zoomOutLabel')}
        onClick={handleZoomOut}
        style={{
          width: '30px',
          height: '30px',
          display: 'block',
          border: 'none',
          backgroundColor: 'white',
          cursor: 'pointer',
        }}
      >
        −
      </button>
    </div>
  )
}

export const AccomodationsMap: FC = () => {
  const t = useTranslations('map')
  const { classes } = useStyles()
  const [queryStates, setQueryStates] = useQueryStates({
    bbox: parseAsString,
    id: parseAsString,
  })

  const pathname = usePathname()
  const [rechercheParCarte] = useQueryState('recherche-par-carte', parseAsBoolean)
  const isMapSearch = !!rechercheParCarte

  const pathSegments = pathname.split('/')
  const slugFromPath = (segment: string) => {
    const index = pathSegments.indexOf(segment)
    return index !== -1 ? decodeURIComponent(pathSegments[index + 1] ?? '') || undefined : undefined
  }
  const citySlugFromPath = slugFromPath('ville')
  const departmentSlugFromPath = slugFromPath('departement')
  const effectiveCitySlug = citySlugFromPath && !isMapSearch ? citySlugFromPath : undefined
  const effectiveDepartmentSlug = !effectiveCitySlug && departmentSlugFromPath && !isMapSearch ? departmentSlugFromPath : undefined

  const trpc = useTRPC()
  const { data: territory } = useQuery({
    ...trpc.territories.getBySlug.queryOptions({ type: 'ville', slug: effectiveCitySlug! }),
    enabled: !!effectiveCitySlug,
  })

  // Les pages département ne posent plus de bbox dans l'URL (le filtre se fait sur la frontière) :
  // on cadre quand même la carte sur le département quand aucun marqueur n'est disponible.
  const { data: departmentTerritory } = useQuery({
    ...trpc.territories.getBySlug.queryOptions({ type: 'departement', slug: effectiveDepartmentSlug! }),
    enabled: !!effectiveDepartmentSlug,
  })

  const territoryBbox = territory?.bbox ?? departmentTerritory?.bbox
  const territoryBounds: L.LatLngBoundsExpression | undefined = territoryBbox
    ? [
        [territoryBbox.ymin, territoryBbox.xmin],
        [territoryBbox.ymax, territoryBbox.xmax],
      ]
    : undefined

  const { data: accommodations } = useAccomodations()

  const accommodationsData = accommodations?.results || []

  const markerPositions = useMemo<L.LatLngTuple[]>(
    () => accommodationsData.map((a) => [a.latitude ?? 0, a.longitude ?? 0]),
    [accommodationsData],
  )

  const markers = useMemo(() => {
    return accommodationsData.map((accommodation, i) => (
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
        position={markerPositions[i]}
        title={accommodation.name}
        alt={accommodation.name}
      />
    ))
  }, [accommodationsData, markerPositions, setQueryStates])

  const memoizedMap = useMemo(() => {
    return (
      <MapContainer center={[46.5, 2.4]} zoom={6} className={classes.mapContainer} scrollWheelZoom={false} zoomControl={false}>
        <MapAccessibleName label={t('resultsLabel')} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <BoundsHandler markerPositions={markerPositions} territoryBounds={territoryBounds} />
        <CustomZoomControls />
        {markers}
      </MapContainer>
    )
  }, [markers, markerPositions, territoryBounds, queryStates.bbox])

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
