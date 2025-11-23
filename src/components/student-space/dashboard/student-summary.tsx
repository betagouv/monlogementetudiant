import Tile from '@codegouvfr/react-dsfr/Tile'

export const StudentSummary = () => (
  <div className="fr-flex fr-direction-column fr-flex-gap-4v fr-pt-4w fr-px-6w fr-pb-6w">
    <span className="fr-h4">En résumé</span>
    <div className="fr-flex fr-direction-column fr-direction-md-row fr-flex-gap-4v fr-justify-content-space-between">
      <div className="fr-width-full">
        <Tile
          enlargeLinkOrButton
          imageSvg
          imageUrl="static/media/city-hall.27b3dc9b.svg"
          linkProps={{
            href: '#',
          }}
          orientation="vertical"
          title="3 favoris"
          titleAs="h3"
        />
      </div>
      <div className="fr-width-full">
        <Tile
          enlargeLinkOrButton
          imageSvg
          imageUrl="static/media/city-hall.27b3dc9b.svg"
          linkProps={{
            href: '#',
          }}
          orientation="vertical"
          title="1 candidature"
          titleAs="h3"
        />
      </div>
      <div className="fr-width-full">
        <Tile
          enlargeLinkOrButton
          imageSvg
          imageUrl="static/media/city-hall.27b3dc9b.svg"
          linkProps={{
            href: '#',
          }}
          orientation="vertical"
          title="5 alertes"
          titleAs="h3"
        />
      </div>
    </div>
  </div>
)
