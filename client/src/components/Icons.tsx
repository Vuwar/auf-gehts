import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 24, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function FlameIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 2c1 4 4 5 4 9a4 4 0 1 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 0-8z" />
    </Base>
  )
}

export function FlashcardIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="6" width="14" height="12" rx="2" />
      <path d="M7 3h14v12" />
    </Base>
  )
}

export function LibraryIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="4" height="16" rx="1" />
      <rect x="9" y="4" width="4" height="16" rx="1" />
      <path d="M16 5l4 1-3 14-4-1z" />
    </Base>
  )
}

export function ReaderBookIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 4h12a2 2 0 0 1 2 2v14H8a4 4 0 0 0-4-4V6a2 2 0 0 1 2-2z" />
      <path d="M8 8h8" />
      <path d="M8 12h6" />
    </Base>
  )
}

export function MapIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 6.5 9 4l6 2.5 5-2.5v13.5L15 20l-6-2.5L4 20z" />
      <path d="M9 4v13.5" />
      <path d="M15 6.5V20" />
    </Base>
  )
}

export function AlphabetIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 20l4-14 4 14" />
      <path d="M7.5 15h5" />
      <path d="M16 11h2a2.5 2.5 0 0 1 0 5h-2zm0 0V20h2a2.5 2.5 0 0 0 0-5h-2" />
    </Base>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Base>
  )
}

export function RotateIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 9 8 9" />
    </Base>
  )
}

export function SpeakerWaveIcon(props: IconProps) {
  return (
    <Base {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </Base>
  )
}

export function HeadphonesIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1v-7h3z" />
      <path d="M3 19a2 2 0 0 0 2 2h1v-7H3z" />
    </Base>
  )
}

export function PartyIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 21l4-12 7 7z" />
      <path d="M14 5l1 1" />
      <path d="M18 2l1 1" />
      <path d="M19 8l1 1" />
      <path d="M11 4l1 1" />
    </Base>
  )
}
