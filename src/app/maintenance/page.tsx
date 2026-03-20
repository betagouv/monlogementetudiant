import { notFound } from 'next/navigation'

export default function MaintenancePage() {
  // Cette page n'est accessible que via le middleware de maintenance
  notFound()

  // return (
  //   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
  //     <div className="fr-container" style={{ textAlign: 'center' }}>
  //       <div className="fr-grid-row fr-grid-row--center">
  //         <div className="fr-col-12 fr-col-md-8">
  //           <h1 className="fr-h3">Maintenance en cours</h1>
  //           <div className="fr-callout">
  //             <p className="fr-callout__text">
  //               La plateforme est actuellement en maintenance. Elle sera de nouveau accessible très prochainement.
  //               <br />
  //               Merci de votre compréhension.
  //             </p>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   </div>
  // )
}
