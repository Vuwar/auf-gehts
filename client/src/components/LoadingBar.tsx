import { useEffect, useState } from 'react'
import { onLoadingChange } from '../api'

export default function LoadingBar() {
  const [count, setCount] = useState(0)
  useEffect(() => onLoadingChange(setCount), [])
  const active = count > 0
  return (
    <div className={`loading-bar ${active ? 'active' : ''}`} aria-hidden="true">
      <div className="loading-bar-fill" />
    </div>
  )
}
