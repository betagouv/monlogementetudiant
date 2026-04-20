'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryStates } from 'nuqs'
import { useDebounce } from 'use-debounce'
import { UserCard } from '~/components/bailleur/users/user-card'
import { useBailleurUsers } from '~/hooks/use-bailleur-users'
import styles from './users-list.module.css'

type Props = {
  currentUserId: string
  ownerId: number
}

export function UsersList({ currentUserId, ownerId }: Props) {
  const t = useTranslations('bailleur.users')
  const [{ recherche }, setQueryStates] = useQueryStates({
    recherche: parseAsString.withDefault(''),
  })
  const [debouncedSearch] = useDebounce(recherche, 300)

  const { data, isLoading } = useBailleurUsers({
    search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
    ownerId,
  })

  const items = data?.items ?? []

  return (
    <>
      <div className="fr-flex fr-justify-content-space-between fr-align-items-end fr-mb-3w">
        <p className="fr-text--lg fr-mb-0">
          <strong>{t(items.length === 1 ? 'countOne' : 'countOther', { count: items.length })}</strong>
        </p>
        <div className={styles.search}>
          <Input
            label=""
            hideLabel
            nativeInputProps={{
              placeholder: t('searchPlaceholder'),
              value: recherche,
              onChange: (e) => setQueryStates({ recherche: e.target.value }),
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <p>{t('loading')}</p>
      ) : items.length === 0 ? (
        <p className="fr-text-mention--grey">{t('noUsers')}</p>
      ) : (
        <div className={styles.grid}>
          {items.map((u) => (
            <UserCard key={u.id} user={u} canDelete={u.id !== currentUserId} />
          ))}
        </div>
      )}
    </>
  )
}
