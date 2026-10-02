'use client'

import { Alert } from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox'
import Input from '@codegouvfr/react-dsfr/Input'
import { useEffect, useState } from 'react'
import { useAdminEmailSettings, useUpdateAdminEmailSettings } from '~/hooks/use-admin-email-settings'

export const EmailSettingsForm = () => {
  const { data, isLoading } = useAdminEmailSettings()
  const updateSettings = useUpdateAdminEmailSettings()

  const [redirectEmail, setRedirectEmail] = useState('')
  const [bypassRedirect, setBypassRedirect] = useState(false)

  // Synchronise le formulaire une fois les réglages chargés.
  useEffect(() => {
    if (!data) return
    setRedirectEmail(data.redirectEmail ?? '')
    setBypassRedirect(data.bypassRedirect)
  }, [data])

  if (isLoading) return <p>Chargement…</p>

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    updateSettings.mutate({ redirectEmail: redirectEmail.trim() || null, bypassRedirect })
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="fr-text--sm fr-mb-3w">
        Hors production, tous les emails (sauf les emails de connexion) sont redirigés vers l’adresse ci-dessous au lieu de partir à leurs
        vrais destinataires. Si aucune adresse n’est renseignée, le repli est la variable d’environnement{' '}
        <code>STAGING_EMAIL_REDIRECT</code>
        {data?.envFallback ? (
          <>
            {' '}
            (actuellement <strong>{data.envFallback}</strong>)
          </>
        ) : (
          <> (non définie — les emails seraient alors ignorés)</>
        )}
        .
      </p>

      {bypassRedirect && (
        <Alert
          className="fr-mb-3w"
          severity="warning"
          title="Redirection désactivée"
          description="Les emails non-auth partent actuellement vers leurs vrais destinataires."
        />
      )}

      <Input
        label="Adresse de redirection (catch-all)"
        hintText="Laisser vide pour retomber sur STAGING_EMAIL_REDIRECT, ou drop si celle-ci est absente."
        nativeInputProps={{
          type: 'email',
          value: redirectEmail,
          placeholder: 'recette@exemple.fr',
          onChange: (event) => setRedirectEmail(event.target.value),
        }}
      />

      <Checkbox
        className="fr-mt-2w"
        options={[
          {
            label: 'Désactiver la redirection (bypass) — les emails repartent aux destinataires réels',
            nativeInputProps: {
              checked: bypassRedirect,
              onChange: (event) => setBypassRedirect(event.target.checked),
            },
          },
        ]}
      />

      <Button type="submit" disabled={updateSettings.isPending} className="fr-mt-2w">
        {updateSettings.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  )
}
