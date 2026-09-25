'use client'

import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import { FC, RefObject, useCallback, useEffect, useMemo, useRef } from 'react'
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

const MIN_FRAME_SIZE_METERS = 6000

const getMarkersBounds = (positions: L.LatLngTuple[]) => {
  const bounds = L.latLngBounds(positions)
  return bounds.extend(bounds.getCenter().toBounds(MIN_FRAME_SIZE_METERS))
}

const useCommitBboxOnMoveEnd = (appliedBbox: RefObject<string | null>) => {
  const map = useMap()
  const [, setQueryStates] = useQueryStates({
    bbox: parseAsString,
    academie: parseAsString,
    ['recherche-par-carte']: parseAsString,
  })

  return useCallback(() => {
    map.once('moveend', () => {
      const bounds = map.getBounds()
      const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`
      appliedBbox.current = bbox
      setQueryStates({ bbox, academie: null, ['recherche-par-carte']: 'true' })
    })
  }, [map, appliedBbox, setQueryStates])
}

const BoundsHandler: FC<{
  markerPositions: L.LatLngTuple[]
  territoryBounds?: L.LatLngBoundsExpression
  appliedBbox: RefObject<string | null>
}> = ({ markerPositions, territoryBounds, appliedBbox }) => {
  const map = useMap()
  const [bbox] = useQueryState('bbox', parseAsString)
  const commitBboxOnMoveEnd = useCommitBboxOnMoveEnd(appliedBbox)

  useEffect(() => {
    if (bbox) {
      if (bbox === appliedBbox.current) return
      appliedBbox.current = bbox
      const [west, south, east, north] = bbox.split(',').map(Number)
      map.fitBounds([
        [south, west],
        [north, east],
      ])
      return
    }
    appliedBbox.current = null
    if (markerPositions.length > 0) {
      map.fitBounds(getMarkersBounds(markerPositions), { padding: [20, 20] })
    } else if (territoryBounds) {
      map.fitBounds(territoryBounds, { padding: [50, 50] })
    } else {
      map.setView([46.5, 2.4], 6)
    }
  }, [bbox, markerPositions, territoryBounds, map, appliedBbox])

  useMapEvents({
    dragstart: commitBboxOnMoveEnd,
    dblclick: commitBboxOnMoveEnd,
  })

  return null
}

const CustomZoomControls: FC<{ appliedBbox: RefObject<string | null> }> = ({ appliedBbox }) => {
  const t = useTranslations('map')
  const map = useMap()
  const commitBboxOnMoveEnd = useCommitBboxOnMoveEnd(appliedBbox)

  const handleZoomIn = () => {
    if (map.getZoom() >= map.getMaxZoom()) return
    commitBboxOnMoveEnd()
    map.zoomIn()
  }

  const handleZoomOut = () => {
    if (map.getZoom() <= map.getMinZoom()) return
    commitBboxOnMoveEnd()
    map.zoomOut()
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

  // Les pages département ne posent pas de bbox dans l'URL (le filtre se fait sur la frontière) :
  // on cadre quand même la carte sur le département quand aucun marqueur n'est disponible.
  const { data: departmentTerritory } = useQuery({
    ...trpc.territories.getBySlug.queryOptions({ type: 'departement', slug: effectiveDepartmentSlug! }),
    enabled: !!effectiveDepartmentSlug,
  })

  const territoryBbox = territory?.bbox ?? departmentTerritory?.bbox
  const territoryBounds = useMemo<L.LatLngBoundsExpression | undefined>(
    () =>
      territoryBbox
        ? [
            [territoryBbox.ymin, territoryBbox.xmin],
            [territoryBbox.ymax, territoryBbox.xmax],
          ]
        : undefined,
    [territoryBbox],
  )

  const { data: accommodations } = useAccomodations()

  const accommodationsData = useMemo(() => accommodations?.results ?? [], [accommodations])

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

  const appliedBbox = useRef<string | null>(null)

  const memoizedMap = useMemo(() => {
    return (
      <MapContainer center={[46.5, 2.4]} zoom={6} className={classes.mapContainer} scrollWheelZoom={false} zoomControl={false}>
        <MapAccessibleName label={t('resultsLabel')} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <BoundsHandler markerPositions={markerPositions} territoryBounds={territoryBounds} appliedBbox={appliedBbox} />
        <CustomZoomControls appliedBbox={appliedBbox} />
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
