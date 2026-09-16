'use client'

import { FC, useEffect, useState } from 'react'

type LiveRegionProps = {
  /** Message annoncé. Une chaîne vide n'émet rien : la région reste présente dans le DOM. */
  message: string
  /** `alert` interrompt la lecture en cours — réservé aux erreurs (RGAA 7.5). */
  severity?: 'status' | 'alert'
  /** Rend le message visible en plus de l'annoncer. */
  visible?: boolean
  /**
   * Délai avant annonce, pour les valeurs recalculées à chaque frappe : sans lui, le lecteur
   * d'écran énoncerait un total intermédiaire à chaque caractère saisi.
   */
  debounceMs?: number
}

/**
 * Région live partagée (RGAA 7.5). La région doit exister dans le DOM **avant** que le message
 * n'arrive, sinon les lecteurs d'écran ne l'annoncent pas — d'où le rendu inconditionnel du conteneur.
 */
export const LiveRegion: FC<LiveRegionProps> = ({ message, severity = 'status', visible = false, debounceMs = 0 }) => {
  const [announced, setAnnounced] = useState(debounceMs > 0 ? '' : message)

  useEffect(() => {
    if (debounceMs <= 0) {
      setAnnounced(message)
      return
    }
    const timer = setTimeout(() => setAnnounced(message), debounceMs)
    return () => clearTimeout(timer)
  }, [message, debounceMs])

  return (
    <p
      role={severity}
      aria-live={severity === 'alert' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={visible ? undefined : 'fr-sr-only'}
    >
      {announced}
    </p>
  )
}
