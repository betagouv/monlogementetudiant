'use client'

import Button, { type ButtonProps } from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import clsx from 'clsx'
import React, { type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject, useId, useRef } from 'react'
import { useOnClickOutside } from 'usehooks-ts'

export const Dropdown = ({
  id,
  control,
  children,
  alignRight = false,
  title,
  priority,
  modalPriority,
  modalControlClassName,
  dropdownControlClassName,
  size,
  displayDropdownArrow = true,
  'data-testid': dataTestId,
}: {
  id: string
  control: ReactNode
  children: ReactNode
  alignRight?: boolean
  title?: string
  priority?: ButtonProps['priority']
  modalPriority?: ButtonProps['priority']
  modalControlClassName?: string
  dropdownControlClassName?: string
  size?: ButtonProps['size']
  displayDropdownArrow?: boolean
  'data-testid'?: string
}) => {
  // Le composant Header du DSFR rend deux fois quickAccessItems (barre d'outils et menu
  // mobile) : un identifiant fixe se retrouverait donc en double dans la page, ce qui invalide
  // le document et rend aria-controls ambigu (RGAA 8.2). useId le rend unique par instance.
  const instanceId = useId().replace(/[^\w-]/g, '')
  const formattedId = `${id.replace('-', '_')}_${instanceId}`
  const [isOpen, setIsOpen] = React.useState(false)

  // La variante mobile (modale) et la variante desktop (panneau) coexistent dans le DOM :
  // elles doivent porter des identifiants distincts, sinon aria-controls devient ambigu.
  const modal = createModal({
    id: `${formattedId}_modal`,
    isOpenedByDefault: false,
  })

  // Le titre de la modale est son nom accessible, et le DSFR le rend dans un <h1>. Sans lui,
  // ce <h1> reste vide : les lecteurs d'écran annoncent un titre muet, et le plan de la page
  // gagne un titre de niveau 1 concurrent du vrai (RGAA 9.1). À défaut de titre explicite,
  // l'intitulé du bouton déclencheur fait office — c'est ce que la modale ouvre.
  const modalTitle = title ?? (typeof control === 'string' ? control : undefined)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const collapseRef = useRef<HTMLDivElement>(null)

  const handleButtonClick = React.useCallback(() => {
    setIsOpen((previous) => !previous)
  }, [])

  /**
   * Le panneau ne contient que des liens et des boutons : leur activation au clavier est
   * native (simuler un `.click()` sur Entrée/Espace la doublerait). Il ne reste qu'à refermer
   * le panneau après une navigation.
   */
  const closeAfterActivation = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest('a, button')) {
      setIsOpen(false)
    }
  }

  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  useOnClickOutside(collapseRef as RefObject<HTMLElement>, (event) => {
    if (event.target instanceof HTMLElement && buttonRef.current?.contains(event.target)) {
      return
    }

    setIsOpen(false)
  })

  return (
    <>
      <div className="fr-hidden-md">
        <Button
          className={clsx(displayDropdownArrow ? 'fr-dropdown__btn' : '', modalControlClassName)}
          priority={modalPriority || priority}
          title={title}
          type="button"
          size={size}
          data-testid={dataTestId}
          {...modal.buttonProps}
        >
          {control}
        </Button>
        <modal.Component title={modalTitle}>
          <div className="fr-dropdown__modal" style={{ [alignRight ? 'right' : 'left']: 0 }}>
            {children}
          </div>
        </modal.Component>
      </div>
      <div className="fr-dropdown fr-hidden fr-unhidden-md" onKeyDown={closeOnEscape}>
        <Button
          className={clsx(displayDropdownArrow ? 'fr-dropdown__btn' : '', dropdownControlClassName)}
          priority={priority}
          title={title}
          type="button"
          size={size}
          aria-expanded={isOpen}
          // Le panneau n'existe qu'ouvert : référencer son identifiant en permanence
          // ferait pointer aria-controls dans le vide.
          aria-controls={isOpen ? formattedId : undefined}
          ref={buttonRef}
          data-testid={dataTestId}
          onClick={handleButtonClick}
        >
          {control}
        </Button>
        {isOpen && (
          <div
            className="fr-collapse fr-dropdown__pane fr-mr-1v"
            style={{ [alignRight ? 'right' : 'left']: 0 }}
            id={formattedId}
            ref={collapseRef}
            onClick={closeAfterActivation}
          >
            {children}
          </div>
        )}
      </div>
    </>
  )
}
