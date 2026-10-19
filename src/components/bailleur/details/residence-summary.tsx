'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import { useTranslations } from 'next-intl'
import { Controller, useFormContext } from 'react-hook-form'
import { RichTextEditor } from '~/components/ui/rich-text-editor'
import { TCreateResidence } from '~/schemas/accommodations/create-residence'
import { DESCRIPTION_SECTION_KEYS, TUpdateResidence } from '~/schemas/accommodations/update-residence'

export const ResidenceSummary = () => {
  const t = useTranslations('bailleur.residences.details.summary')
  const { control, register } = useFormContext<TUpdateResidence | TCreateResidence>()
  return (
    <div className="fr-border-bottom">
      <div className="fr-p-2w fr-p-md-6w">
        <h3>{t('title')}</h3>

        <Input
          label={t('sections.tagline.label')}
          textArea
          nativeTextAreaProps={{ rows: 2, placeholder: t('sections.tagline.placeholder'), ...register('tagline') }}
        />

        {DESCRIPTION_SECTION_KEYS.map((key) => (
          <div key={key} className="fr-input-group">
            <span id={`residence-section-${key}`} className="fr-label">
              {t(`sections.${key}.label`)}
            </span>
            <div className="fr-mt-1w">
              <Controller
                name={key}
                control={control}
                render={({ field }) => (
                  <RichTextEditor
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder={t(`sections.${key}.placeholder`)}
                    labelledBy={`residence-section-${key}`}
                    compact
                  />
                )}
              />
            </div>
          </div>
        ))}

        <Input
          className="fr-mt-4w"
          label={t('rentalChargesLabel')}
          hintText={
            <>
              <span className="fr-mb-0">{t('rentalChargesHint')}</span>
              <br />
              <span className="fr-mb-0 fr-text--xs fr-text-mention--grey">{t('rentalChargesExample')}</span>
            </>
          }
          textArea
          nativeTextAreaProps={{ rows: 2, ...register('rentalChargesDetails') }}
        />
      </div>
    </div>
  )
}
