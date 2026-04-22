'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useReducer, useRef } from 'react'
import type { TImportJobSummary } from '~/schemas/import-jobs'
import type { CsvPreviewResult, ProgressLine } from '~/server/lib/import/csv-importer'
import { useTRPC } from '~/server/trpc/client'
import { ImportPreviewTable } from './import-preview-table'
import { ImportProgress } from './import-progress'

type State =
  | { step: 'form'; source: string; file: File | null; error: string | null }
  | { step: 'previewing'; source: string; file: File }
  | { step: 'preview'; source: string; file: File; preview: CsvPreviewResult }
  | { step: 'importing'; source: string; file: File; lines: ProgressLine[]; current: number; total: number }
  | { step: 'done'; summary: TImportJobSummary; jobId: number; lines: ProgressLine[]; total: number }

type Action =
  | { type: 'SET_FIELD'; source?: string; file?: File | null }
  | { type: 'START_PREVIEW' }
  | { type: 'PREVIEW_ERROR'; error: string }
  | { type: 'PREVIEW_DONE'; preview: CsvPreviewResult }
  | { type: 'START_IMPORT' }
  | { type: 'IMPORT_PROGRESS'; row: number; total: number; name: string; action: ProgressLine['action'] }
  | { type: 'IMPORT_ERROR'; row: number; name: string; message: string }
  | { type: 'IMPORT_DONE'; summary: TImportJobSummary; jobId: number }
  | { type: 'IMPORT_FAILED'; error: string }
  | { type: 'RESET' }

const initialState: State = { step: 'form', source: '', file: null, error: null }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_FIELD':
      if (state.step !== 'form') return state
      return {
        ...state,
        ...(action.source !== undefined && { source: action.source }),
        ...(action.file !== undefined && { file: action.file }),
        error: null,
      }

    case 'START_PREVIEW':
      if (state.step !== 'form' || !state.file) return state
      return { step: 'previewing', source: state.source, file: state.file }

    case 'PREVIEW_ERROR':
      if (state.step !== 'previewing') return state
      return { step: 'form', source: state.source, file: state.file, error: action.error }

    case 'PREVIEW_DONE':
      if (state.step !== 'previewing') return state
      return { step: 'preview', source: state.source, file: state.file, preview: action.preview }

    case 'START_IMPORT':
      if (state.step !== 'preview') return state
      return { step: 'importing', source: state.source, file: state.file, lines: [], current: 0, total: 0 }

    case 'IMPORT_PROGRESS':
      if (state.step !== 'importing') return state
      return {
        ...state,
        current: action.row,
        total: action.total,
        lines: [...state.lines, { row: action.row, name: action.name, action: action.action }],
      }

    case 'IMPORT_ERROR':
      if (state.step !== 'importing') return state
      return {
        ...state,
        lines: [...state.lines, { row: action.row, name: action.name, action: 'error', message: action.message }],
      }

    case 'IMPORT_DONE':
      if (state.step !== 'importing') {
        return { step: 'done', summary: action.summary, jobId: action.jobId, lines: [], total: 0 }
      }
      return { step: 'done', summary: action.summary, jobId: action.jobId, lines: state.lines, total: state.total }

    case 'IMPORT_FAILED':
      if (state.step !== 'importing') return state
      return { step: 'form', source: state.source, file: state.file, error: action.error }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

export function CsvImportForm() {
  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(reducer, initialState)
  const abortRef = useRef<AbortController | null>(null)

  async function handlePreview() {
    if (state.step !== 'form' || !state.file) return
    dispatch({ type: 'START_PREVIEW' })

    try {
      const formData = new FormData()
      formData.append('file', state.file)
      formData.append('source', state.source.trim())

      const res = await fetch('/api/admin/import/csv/preview', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        dispatch({ type: 'PREVIEW_ERROR', error: data.error ?? 'Erreur lors de la prévisualisation' })
        return
      }

      dispatch({ type: 'PREVIEW_DONE', preview: data })
    } catch {
      dispatch({ type: 'PREVIEW_ERROR', error: 'Erreur réseau' })
    }
  }

  async function handleImport() {
    if (state.step !== 'preview') return
    dispatch({ type: 'START_IMPORT' })

    const { file, source } = state
    const formData = new FormData()
    formData.append('file', file)
    formData.append('source', source.trim())

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/admin/import/csv/execute', {
        method: 'POST',
        body: formData,
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        dispatch({ type: 'IMPORT_FAILED', error: "Erreur lors du lancement de l'import" })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.replace(/^data: /, '').trim()
          if (!line) continue
          try {
            const event = JSON.parse(line)
            if (event.type === 'ping') continue
            if (event.type === 'progress')
              dispatch({ type: 'IMPORT_PROGRESS', row: event.row, total: event.total, name: event.name, action: event.action })
            else if (event.type === 'error') dispatch({ type: 'IMPORT_ERROR', row: event.row, name: event.name, message: event.message })
            else if (event.type === 'done') {
              dispatch({ type: 'IMPORT_DONE', summary: event.summary, jobId: event.jobId })
              await queryClient.refetchQueries({ queryKey: trpc.admin.imports.pathKey() })
            }
          } catch {
            // malformed SSE line, skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        dispatch({ type: 'IMPORT_FAILED', error: 'Connexion interrompue' })
      }
    }
  }

  function handleReset() {
    dispatch({ type: 'RESET' })
    router.refresh()
  }

  return (
    <div>
      {state.step === 'form' && state.error && <Alert severity="error" small description={state.error} className="fr-mb-3w" />}

      {(state.step === 'form' || state.step === 'previewing') && (
        <div className="fr-flex fr-direction-column fr-flex-gap-3w" style={{ maxWidth: '480px' }}>
          <Input
            label="Identifiant source"
            hintText="Ex : arpej-2024, crous-bordeaux — sert à dédoublonner les imports"
            nativeInputProps={{
              value: state.step === 'form' ? state.source : '',
              onChange: (e) => dispatch({ type: 'SET_FIELD', source: e.target.value }),
              placeholder: 'arpej-2024',
              disabled: state.step === 'previewing',
            }}
          />
          <div className="fr-upload-group">
            <label className="fr-label" htmlFor="csv-file">
              Fichier CSV
              <span className="fr-hint-text">Format CSV avec séparateur ; ou , — encodage UTF-8</span>
            </label>
            <input
              className="fr-upload"
              type="file"
              id="csv-file"
              accept=".csv"
              disabled={state.step === 'previewing'}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', file: e.target.files?.[0] ?? null })}
            />
          </div>
          <div className="fr-mt-2w">
            <Button
              onClick={handlePreview}
              disabled={state.step === 'previewing' || (state.step === 'form' && (!state.file || !state.source.trim()))}
              iconId="fr-icon-eye-line"
            >
              {state.step === 'previewing' ? 'Analyse en cours...' : 'Prévisualiser'}
            </Button>
          </div>
        </div>
      )}

      {state.step === 'preview' && (
        <ImportPreviewTable result={state.preview} onConfirm={handleImport} onCancel={() => dispatch({ type: 'RESET' })} />
      )}

      {(state.step === 'importing' || state.step === 'done') && (
        <div>
          <ImportProgress
            total={state.step === 'importing' || state.step === 'done' ? state.total : 0}
            current={state.step === 'importing' ? state.current : state.step === 'done' ? state.total : 0}
            lines={state.step === 'importing' || state.step === 'done' ? state.lines : []}
            done={state.step === 'done'}
            summary={state.step === 'done' ? state.summary : undefined}
          />
          {state.step === 'done' && (
            <div className="fr-mt-3w">
              <Button priority="secondary" onClick={handleReset} iconId="fr-icon-refresh-line">
                Nouvel import
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
