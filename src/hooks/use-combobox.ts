'use client'

import { useTranslations } from 'next-intl'
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { sPluriel } from '~/utils/sPluriel'

type UseComboboxOptions<T> = {
  /** Identifiant racine, unique dans la page : sert à construire ceux de la liste et des options. */
  id: string
  items: T[]
  isOpen: boolean
  onSelect: (item: T) => void
  onClose: () => void
}

/**
 * Motif ARIA « combobox avec liste » (RGAA 7.1 et 7.3).
 *
 * Centralise le contrat attendu par les technologies d'assistance — rôles combobox/listbox/option,
 * option active désignée par aria-activedescendant, navigation aux flèches, validation par Entrée,
 * fermeture par Échap — pour que toutes les autocomplétions se comportent de la même façon.
 *
 * Le focus ne quitte jamais le champ de saisie : c'est aria-activedescendant qui désigne l'option
 * courante, conformément au motif. `announcement` alimente la région live qui annonce le nombre
 * de suggestions (RGAA 7.5).
 */
export function useCombobox<T>({ id, items, isOpen, onSelect, onClose }: UseComboboxOptions<T>) {
  const t = useTranslations('accessibility')
  const [activeIndex, setActiveIndex] = useState(-1)
  const listboxId = `${id}-listbox`
  const optionId = useCallback((index: number) => `${id}-option-${index}`, [id])

  // Toute nouvelle liste de suggestions repart sans option active : conserver l'index
  // désignerait une option qui n'existe plus.
  const itemsCount = items.length
  const previousCount = useRef(itemsCount)
  useEffect(() => {
    if (previousCount.current !== itemsCount) {
      previousCount.current = itemsCount
      setActiveIndex(-1)
    }
  }, [itemsCount])

  useEffect(() => {
    if (!isOpen) setActiveIndex(-1)
  }, [isOpen])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || itemsCount === 0) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((index) => (index + 1) % itemsCount)
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((index) => (index <= 0 ? itemsCount - 1 : index - 1))
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(itemsCount - 1)
        break
      case 'Enter':
        if (activeIndex >= 0) {
          event.preventDefault()
          onSelect(items[activeIndex])
        }
        break
      case 'Escape':
        event.preventDefault()
        onClose()
        break
      case 'Tab':
        onClose()
        break
    }
  }

  return {
    activeIndex,
    listboxId,
    /** À étaler sur le champ de saisie (nativeInputProps du DSFR compris). */
    inputProps: {
      role: 'combobox' as const,
      'aria-expanded': isOpen,
      'aria-controls': listboxId,
      'aria-autocomplete': 'list' as const,
      'aria-activedescendant': isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined,
      // autocomplete est laissé à l'appelant : la finalité du champ dépend de ce qu'il collecte
      // (RGAA 11.13), et « off » y ferait échouer le critère.
      onKeyDown,
    },
    /** À étaler sur la liste de suggestions (<ul>). */
    listboxProps: { role: 'listbox' as const, id: listboxId },
    /** À étaler sur chaque suggestion (<li>). */
    getOptionProps: (index: number) => ({
      id: optionId(index),
      role: 'option' as const,
      'aria-selected': index === activeIndex,
      onMouseEnter: () => setActiveIndex(index),
      onClick: () => onSelect(items[index]),
    }),
    /** Texte à placer dans une région live polie (RGAA 7.5). */
    announcement: isOpen && itemsCount > 0 ? t('suggestionsAvailable', { count: itemsCount, pluralize: sPluriel(itemsCount) }) : '',
  }
}
