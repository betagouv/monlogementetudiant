import { colors } from '@codegouvfr/react-dsfr'
import { getTranslations } from 'next-intl/server'
import { AlertSection } from '~/components/home/alert/alert-section'
import { CitiesSection } from '~/components/home/cities/cities'
import { FacilitateSection } from '~/components/home/facilitate/facilitate'
import { FAQSection } from '~/components/home/faq/faq'
import { FeaturesSection } from '~/components/home/features/features'
import { HeroSection } from '~/components/home/hero-section/hero-section'
import { NewsSection } from '~/components/home/news/news'
import { PartnersSection } from '~/components/home/partners/partners'
import { getCanonicalUrl } from '~/utils/canonical'

export const generateMetadata = async () => {
  const t = await getTranslations('metadata')
  return {
    description: t('home.description'),
    title: t('home.title'),
    robots: {
      index: process.env.NEXT_PUBLIC_APP_ENV === 'production',
      follow: process.env.NEXT_PUBLIC_APP_ENV === 'production',
    },
    alternates: { canonical: getCanonicalUrl() },
  }
}

export default async function Home() {
  return (
    <>
      <div
        style={{
          backgroundColor: colors.decisions.background.alt.blueFrance.default,
        }}
      >
        <HeroSection />
        <AlertSection />
        <FeaturesSection />
        <CitiesSection />
      </div>
      <FacilitateSection />
      <NewsSection />
      <PartnersSection />
      <FAQSection />
    </>
  )
}
