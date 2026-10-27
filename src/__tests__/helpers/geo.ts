/**
 * Polygone carré (MultiPolygon) centré sur un point, pour les colonnes `boundary`
 * (académies, départements, villes) et les filtres `ST_Within` qui s'appuient dessus.
 */
export const squareBoundary = (lng: number, lat: number, d = 0.05) => ({
  type: 'MultiPolygon' as const,
  coordinates: [
    [
      [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
      ],
    ],
  ],
})
