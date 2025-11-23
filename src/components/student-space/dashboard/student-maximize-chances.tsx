import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'

export const StudentMaximizeChances = () => {
  const items = [
    { id: 1, label: 'Complétez votre to-do list', button: 'To-do list' },
    { id: 2, label: 'Estimez vos aides au logement', button: 'Mes aides' },
    { id: 3, label: 'Créez vous des alertes logements', button: 'Mes alertes' },
  ]
  return (
    <div className="fr-flex fr-direction-column fr-flex-gap-4v fr-pt-4w fr-px-6w fr-pb-6w">
      <span className="fr-h4">Mettez toutes les chances de votre côté</span>
      <div className="fr-background-default--grey">
        <div className="fr-flex fr-direction-column fr-justify-content-space-between fr-px-4w">
          {items.map((item, index) => (
            <div
              className={clsx(
                index !== items.length - 1 ? 'fr-border-bottom' : '',
                'fr-flex fr-direction-column fr-direction-md-row fr-justify-content-space-between fr-align-items-md-center fr-py-4w',
              )}
              key={item.id}
            >
              <div>
                <span className="ri-checkbox-circle-fill" />
                <span className="fr-h6 fr-text--normal">{item.label}</span>
              </div>
              <Button priority="tertiary no outline" iconPosition="left" iconId="ri-arrow-right-line">
                {item.button}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
