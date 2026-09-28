'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import type { TagProps } from '@codegouvfr/react-dsfr/Tag'
import TagsGroup from '@codegouvfr/react-dsfr/TagsGroup'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { LiveRegion } from '~/components/ui/live-region'
import { useCombobox } from '~/hooks/use-combobox'
import type { TReceptionManager } from '~/schemas/contacts/contact-reception-settings'
import { useTRPC } from '~/server/trpc/client'
import styles from './manager-combobox.module.css'

type Props = {
  id: string
  ownerId: number
  value: TReceptionManager[]
  onChange: (managers: TReceptionManager[]) => void
  error?: string
}

export const ManagerCombobox = ({ id, ownerId, value, onChange, error }: Props) => {
  const t = useTranslations('bailleur.contacts.receptionSettings')
  const trpc = useTRPC()
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [debouncedQuery] = useDebounce(query.trim(), 300)

  const { data } = useQuery({
    ...trpc.bailleur.users.list.queryOptions({
      ownerId,
      bailleurRole: 'gestionnaire',
      search: debouncedQuery.length >= 2 ? debouncedQuery : undefined,
    }),
    placeholderData: (previous) => previous,
  })

  const options: TReceptionManager[] = (data?.items ?? []).map((u) => ({
    id: u.id,
    name: `${u.firstname} ${u.lastname}`.trim() || u.email,
  }))
  const selectedIds = new Set(value.map((m) => m.id))

  const toggle = (manager: TReceptionManager) => {
    onChange(selectedIds.has(manager.id) ? value.filter((m) => m.id !== manager.id) : [...value, manager])
  }

  const { inputProps, listboxProps, getOptionProps, activeIndex, announcement } = useCombobox<TReceptionManager>({
    id,
    items: options,
    isOpen,
    onSelect: toggle,
    onClose: () => setIsOpen(false),
  })

  const tags = value.map<TagProps>((manager) => ({
    dismissible: true,
    children: manager.name,
    nativeButtonProps: {
      type: 'button',
      onClick: () => toggle(manager),
      'aria-label': t('removeManager', { name: manager.name }),
    },
  }))

  return (
    <div>
      <div
        ref={containerRef}
        className={styles.container}
        onBlur={(event) => {
          if (!containerRef.current?.contains(event.relatedTarget)) setIsOpen(false)
        }}
      >
        <Input
          label={t('managersLabel')}
          hintText={t('managersHint')}
          iconId="ri-search-line"
          classes={{ root: 'fr-mb-0' }}
          state={error ? 'error' : 'default'}
          stateRelatedMessage={error}
          nativeInputProps={{
            value: query,
            placeholder: t('managersPlaceholder', { count: value.length }),
            autoComplete: 'off',
            onChange: (event) => {
              setQuery(event.target.value)
              setIsOpen(true)
            },
            onFocus: () => setIsOpen(true),
            onClick: () => setIsOpen(true),
            ...inputProps,
          }}
        />

        <LiveRegion message={announcement} />

        {isOpen && (
          <div className={styles.results}>
            {options.length === 0 ? (
              <p className="fr-p-3v fr-mb-0 fr-text-mention--grey">{t('noManagerFound')}</p>
            ) : (
              <ul className={styles.list} {...listboxProps} aria-multiselectable="true" aria-label={t('managersLabel')}>
                {options.map((manager, index) => {
                  const selected = selectedIds.has(manager.id)
                  return (
                    <li
                      key={manager.id}
                      className={clsx(styles.option, index === activeIndex && styles.optionActive)}
                      {...getOptionProps(index)}
                      aria-selected={selected}
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      <span className={clsx(selected ? 'ri-checkbox-fill' : 'ri-checkbox-blank-line', styles.check)} aria-hidden="true" />
                      {manager.name}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {tags.length > 0 && (
        <div className="fr-mt-3w">
          <p className="fr-text--sm fr-text-mention--grey fr-mb-1w">{t('selectedManagers')}</p>
          <TagsGroup tags={tags as [TagProps, ...TagProps[]]} />
        </div>
      )}
    </div>
  )
}
