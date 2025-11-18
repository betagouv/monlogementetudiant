export const expandBbox = (west: number, south: number, east: number, north: number, radiusKm = 5) => {
  // Convert radius from km to degrees (approximate)
  const radiusDeg = radiusKm / 111

  return {
    west: west - radiusDeg,
    south: south - radiusDeg,
    east: east + radiusDeg,
    north: north + radiusDeg,
  }
}
