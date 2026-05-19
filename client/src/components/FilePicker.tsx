import { useRef } from 'react'

interface Props {
  accept?: string
  file?: File | null
  disabled?: boolean
  label?: string
  hint?: string
  onChange: (file: File | null) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FilePicker({ accept, file, disabled, label, hint, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const open = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    onChange(f)
  }

  return (
    <div className={`file-picker ${disabled ? 'disabled' : ''} ${file ? 'has-file' : ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={onFileChange}
        className="file-picker-input"
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={open}
        disabled={disabled}
        className="file-picker-trigger"
      >
        <span className="file-picker-icon" aria-hidden="true">
          {file ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <polyline points="9 15 11 17 15 13" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
        </span>
        <span className="file-picker-body">
          <span className="file-picker-label">
            {file ? file.name : (label ?? 'Choose file')}
          </span>
          <span className="file-picker-sub">
            {file ? formatSize(file.size) : (hint ?? (accept ? `Accepts ${accept}` : 'No file selected'))}
          </span>
        </span>
        {file && !disabled && (
          <span
            role="button"
            tabIndex={0}
            className="file-picker-clear"
            aria-label="Clear file"
            onClick={clear}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clear(e as unknown as React.MouseEvent) } }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </span>
        )}
      </button>
    </div>
  )
}
