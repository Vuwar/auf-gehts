interface Props {
  showDay?: boolean
}

export default function WordHighlightLegend({ showDay = true }: Props) {
  return (
    <div className="word-legend" aria-label="Highlight legend">
      {showDay && (
        <span className="word-legend-item">
          <span className="word-legend-chip is-day" aria-hidden />
          <span>Today's word</span>
        </span>
      )}
      <span className="word-legend-item">
        <span className="word-legend-chip is-saved" aria-hidden />
        <span>Saved vocab</span>
      </span>
      {showDay && (
        <span className="word-legend-item">
          <span className="word-legend-chip is-both" aria-hidden />
          <span>Day + saved</span>
        </span>
      )}
      <span className="word-legend-item">
        <span className="word-legend-chip is-audio" aria-hidden />
        <span>Now playing</span>
      </span>
    </div>
  )
}
