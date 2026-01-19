'use client'

import { Tooltip, TooltipProps } from '@codegouvfr/react-dsfr/Tooltip'
import { FC } from 'react'

type TooltipHoverOnlyProps = Omit<TooltipProps.WithHoverAction, 'kind'>

export const TooltipHoverOnly: FC<TooltipHoverOnlyProps> = (props) => {
  return (
    <span onClickCapture={(e) => e.stopPropagation()}>
      <Tooltip kind="hover" {...props} />
    </span>
  )
}
