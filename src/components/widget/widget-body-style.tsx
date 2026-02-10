'use client'

import { useEffect } from 'react'
import { useWidgetResize } from '~/utils/widget-resize'

export const WidgetBodyStyle = () => {
  useEffect(() => {
    document.body.style.backgroundColor = 'transparent'
    document.body.style.margin = '0'
    document.body.style.padding = '0'
    document.body.style.overflow = 'hidden'
  }, [])

  useWidgetResize()

  return null
}
