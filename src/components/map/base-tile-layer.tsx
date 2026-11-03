import { TileLayer } from 'react-leaflet'

const PLAN_IGN_URL =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'

export const BaseTileLayer = () => (
  <TileLayer
    url={PLAN_IGN_URL}
    maxZoom={19}
    attribution='&copy; <a href="https://geoservices.ign.fr/" target="_blank" rel="noopener noreferrer">IGN</a> – Plan IGN'
  />
)
