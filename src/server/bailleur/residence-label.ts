/** Libellé d'une résidence dans les e-mails : « Nom – Ville » quand la ville est connue. */
export const residenceLabel = (name: string, cityName: string | null | undefined) => (cityName ? `${name} – ${cityName}` : name)
