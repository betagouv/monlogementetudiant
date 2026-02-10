'use client'

import { Tooltip, TooltipProps } from '@codegouvfr/react-dsfr/Tooltip'
import { FC } from 'react'

type TooltipHoverOnlyProps = Omit<TooltipProps.WithClickAction, 'kind'>

export const TooltipHoverOnly: FC<TooltipHoverOnlyProps> = (props) => {
  return (
    <span onClickCapture={(e) => e.stopPropagation()}>
      <Tooltip kind="click" {...props} />
    </span>
  )
}
