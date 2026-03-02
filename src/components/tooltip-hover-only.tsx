'use client'

import { fr } from '@codegouvfr/react-dsfr'
import clsx from 'clsx'
import { MouseEvent, ReactNode } from 'react'

interface TooltipHoverOnlyProps {
  id: string
  title: string
  children?: ReactNode
  className?: string
  style?: React.CSSProperties
}

const preventClick = (e: MouseEvent) => e.stopPropagation()

export const TooltipHoverOnly = ({ id, title, children, className, style }: TooltipHoverOnlyProps) => {
  return (
    <>
      {typeof children === 'undefined' ? (
        <i
          className={fr.cx('fr-icon--sm', 'fr-icon-question-line')}
          style={{ color: fr.colors.decisions.text.actionHigh.blueFrance.default }}
          aria-describedby={id}
          id={`tooltip-owner-${id}`}
          data-fr-js-tooltip-referent="true"
          onClickCapture={preventClick}
        />
      ) : (
        <span aria-describedby={id} id={`tooltip-owner-${id}`} data-fr-js-tooltip-referent="true" onClickCapture={preventClick}>
          {children}
        </span>
      )}
      <span className={clsx(fr.cx('fr-tooltip', 'fr-placement'), className)} id={id} style={style} role="tooltip" data-fr-js-tooltip="true">
        {title}
      </span>
    </>
  )
}
