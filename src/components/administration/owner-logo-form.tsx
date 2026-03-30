'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Image from 'next/image'
import { useRef, useState } from 'react'
import { useAdminUpdateOwnerLogo } from '~/hooks/use-admin-update-owner-logo'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface OwnerLogoFormProps {
  ownerId: number
  imageBase64: string | null
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export const OwnerLogoForm = ({ ownerId, imageBase64 }: OwnerLogoFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const updateLogo = useAdminUpdateOwnerLogo()

  const currentImage = preview ?? imageBase64

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setError(null)

    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Format non supporté. Formats acceptés : JPG, PNG, WebP')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Le fichier est trop volumineux. Taille maximale : 2 Mo')
      return
    }

    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!selectedFile) return

    const base64 = await fileToBase64(selectedFile)
    await updateLogo.mutateAsync({ id: ownerId, image: base64 })
    setSelectedFile(null)
    setPreview(null)
  }

  const handleDelete = async () => {
    await updateLogo.mutateAsync({ id: ownerId, image: null })
    setSelectedFile(null)
    setPreview(null)
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setPreview(null)
    setError(null)
  }

  return (
    <div className="fr-mb-3w">
      <h3 className="fr-h6 fr-mb-2w">Logo du gestionnaire</h3>

      {currentImage && (
        <div className="fr-mb-2w">
          <Image
            src={currentImage}
            alt="Logo du gestionnaire"
            width={120}
            height={120}
            style={{ objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border-default-grey)' }}
            unoptimized
          />
        </div>
      )}

      <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-1w">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <Button type="button" priority="tertiary" size="small" onClick={() => fileInputRef.current?.click()}>
          {currentImage ? 'Changer le logo' : 'Ajouter un logo'}
        </Button>
        {imageBase64 && !selectedFile && (
          <Button type="button" priority="tertiary" size="small" onClick={handleDelete} disabled={updateLogo.isPending}>
            Supprimer le logo
          </Button>
        )}
      </div>

      <span className="fr-text--xs fr-text-mention--grey">Formats acceptés : JPG, PNG, WebP. Taille maximale : 2 Mo</span>

      {error && <p className="fr-error-text fr-mt-1w">{error}</p>}

      {selectedFile && (
        <div className="fr-flex fr-flex-gap-2v fr-mt-2w">
          <Button type="button" size="small" onClick={handleSave} disabled={updateLogo.isPending}>
            {updateLogo.isPending ? 'Enregistrement...' : 'Enregistrer le logo'}
          </Button>
          <Button type="button" priority="tertiary" size="small" onClick={handleCancel} disabled={updateLogo.isPending}>
            Annuler
          </Button>
        </div>
      )}
    </div>
  )
}
