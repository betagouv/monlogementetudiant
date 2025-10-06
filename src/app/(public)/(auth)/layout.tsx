import Image from 'next/image'
import background from '~/images/background.webp'
import styles from './layout.module.css'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className={styles.container}>
        <div className={styles.imageContainer}>
          <Image className={styles.image} src={background} alt="Se connecter" priority quality={100} />
        </div>
        {children}
      </div>
    </>
  )
}
