'use client'

import clsx from 'clsx'
import { type FocusEvent, type MouseEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import styles from './toggletip.module.css'

interface ToggletipProps {
  label: string
  children: ReactNode
}

export const Toggletip = ({ label, children }: ToggletipProps) => {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const hovered = useRef(false)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      if (rootRef.current?.contains(document.activeElement)) buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const onMouseEnter = () => {
    hovered.current = true
    setOpen(true)
  }

  const onMouseLeave = () => {
    hovered.current = false
    const focused = document.activeElement
    const keyboardFocusInside = !!focused && rootRef.current?.contains(focused) && focused.matches(':focus-visible')
    if (!keyboardFocusInside) setOpen(false)
  }

  const onBlur = (event: FocusEvent) => {
    if (hovered.current || rootRef.current?.contains(event.relatedTarget as Node | null)) return
    setOpen(false)
  }

  const onClick = (event: MouseEvent) => {
    if (event.detail === 0) setOpen((value) => !value)
    else setOpen(true)
  }

  return (
    <div ref={rootRef} className={styles.root} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        className={clsx('fr-icon-question-line fr-icon--sm', styles.trigger)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onClick}
      />
      <div id={panelId} className={clsx('fr-text--sm fr-mb-0', styles.panel)} hidden={!open}>
        {children}
      </div>
    </div>
  )
}
