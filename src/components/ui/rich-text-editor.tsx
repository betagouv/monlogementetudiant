'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import styles from './rich-text-editor.module.css'

const urlSchema = z.string().url()

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
  const t = useTranslations('shared.richTextEditor')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        link: {
          openOnClick: false,
          HTMLAttributes: {
            target: '_blank',
            rel: 'noopener noreferrer',
          },
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

    if (!urlSchema.safeParse(linkUrl).success) {
      setLinkError(t('invalidUrl'))
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
    setLinkError(null)
    linkModal.close()
  }, [editor, linkUrl, t])

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
          title={t('bold')}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          icon="ri-italic"
          title={t('italic')}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          icon="ri-underline"
          title={t('underline')}
        />
        <Separator />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          icon="ri-h-1"
          title={t('heading1')}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          icon="ri-h-2"
          title={t('heading2')}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          icon="ri-h-3"
          title={t('heading3')}
        />
        <Separator />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          icon="ri-list-unordered"
          title={t('bulletList')}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          icon="ri-list-ordered"
          title={t('orderedList')}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          icon="ri-double-quotes-l"
          title={t('blockquote')}
        />
        <Separator />
        <ToolbarButton onClick={openLinkModal} active={editor.isActive('link')} icon="ri-link" title={t('link')} />
      </div>
      <EditorContent editor={editor} />

      <linkModal.Component title={t('linkModalTitle')}>
        <Input
          label={t('linkUrlLabel')}
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
            {t('cancel')}
          </Button>
          <Button type="button" priority="primary" onClick={handleSaveLink}>
            {t('save')}
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
