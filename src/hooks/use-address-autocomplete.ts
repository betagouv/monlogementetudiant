'use client'

import { useCallback, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'

export interface AddressSuggestion {
  label: string
  address: string
  city: string
  postalCode: string
  longitude: number
  latitude: number
}

interface ApiAddressFeature {
  properties: {
    label: string
    name: string
    city: string
    postcode: string
  }
  geometry: {
    coordinates: [number, number]
  }
}

interface ApiAddressResponse {
  features: ApiAddressFeature[]
}

export const useAddressAutocomplete = () => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const searchAddress = useDebouncedCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`)
      const data: ApiAddressResponse = await response.json()

      const mappedSuggestions: AddressSuggestion[] = data.features.map((feature) => ({
        label: feature.properties.label,
        address: feature.properties.name,
        city: feature.properties.city,
        postalCode: feature.properties.postcode,
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
      }))

      setSuggestions(mappedSuggestions)
    } catch (error) {
      console.error('Error fetching address suggestions:', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, 300)

  const clearSuggestions = useCallback(() => {
    setSuggestions([])
  }, [])

  return {
    suggestions,
    isLoading,
    searchAddress,
    clearSuggestions,
  }
}
