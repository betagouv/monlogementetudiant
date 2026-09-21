'use client'

import { SearchBar } from '@codegouvfr/react-dsfr/SearchBar'
import clsx from 'clsx'
import styles from './search-input.module.css'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
}

export const SearchInput = ({ label, value, onChange, className }: Props) => (
  <SearchBar
    className={clsx(styles.search, className)}
    label={label}
    renderInput={({ className, id, type, placeholder }) => (
      <input className={className} id={id} type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    )}
  />
)
