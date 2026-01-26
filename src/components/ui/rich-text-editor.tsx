'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import clsx from 'clsx'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import styles from './rich-text-editor.module.css'

const urlSchema = z.string().url('Veuillez entrer une URL valide')

const linkModal = createModal({
  id: 'rich-text-link-modal',
  isOpenedByDefault: false,
})

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export const RichTextEditor = ({ value, onChange }: RichTextEditorProps) => {
  const [linkUrl, setLinkUrl] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: clsx('fr-input', styles.editor),
      },
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value)
    }
  }, [editor, value])

  const openLinkModal = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href || ''
    setLinkUrl(previousUrl)
    setLinkError(null)
    linkModal.open()
  }, [editor])

  const handleSaveLink = useCallback(() => {
    if (!editor) return

    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      linkModal.close()
      return
    }

    const result = urlSchema.safeParse(linkUrl)
    if (!result.success) {
      setLinkError(result.error.issues[0].message)
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
    setLinkError(null)
    linkModal.close()
  }, [editor, linkUrl])

  const handleCancelLink = useCallback(() => {
    setLinkUrl('')
    setLinkError(null)
    linkModal.close()
  }, [])

  if (!editor) {
    return null
  }

  return (
    <>
      <div className={styles.toolbar}>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          icon="ri-bold"
          title="Gras"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          icon="ri-italic"
          title="Italique"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          icon="ri-underline"
          title="Souligné"
        />
        <Separator />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          icon="ri-h-1"
          title="Titre 1"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          icon="ri-h-2"
          title="Titre 2"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          icon="ri-h-3"
          title="Titre 3"
        />
        <Separator />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          icon="ri-list-unordered"
          title="Liste à puces"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          icon="ri-list-ordered"
          title="Liste numérotée"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          icon="ri-double-quotes-l"
          title="Citation"
        />
        <Separator />
        <ToolbarButton onClick={openLinkModal} active={editor.isActive('link')} icon="ri-link" title="Lien" />
      </div>
      <EditorContent editor={editor} />

      <linkModal.Component title="Insérer le lien">
        <Input
          label="URL du lien"
          state={linkError ? 'error' : 'default'}
          stateRelatedMessage={linkError ?? undefined}
          nativeInputProps={{
            value: linkUrl,
            onChange: (e) => {
              setLinkUrl(e.target.value)
              setLinkError(null)
            },
            placeholder: 'https://',
          }}
        />
        <div className="fr-flex fr-justify-content-end fr-flex-gap-2v fr-mt-2w">
          <Button type="button" priority="secondary" onClick={handleCancelLink}>
            Annuler
          </Button>
          <Button type="button" priority="primary" onClick={handleSaveLink}>
            Enregistrer
          </Button>
        </div>
      </linkModal.Component>
    </>
  )
}

const Separator = () => <div className={styles.separator} />

const ToolbarButton = ({ onClick, active, icon, title }: { onClick: () => void; active: boolean; icon: string; title: string }) => (
  <button type="button" onClick={onClick} title={title} className={clsx(styles.toolbarButton, active && styles.active)}>
    <span className={icon} aria-hidden="true" />
  </button>
)
