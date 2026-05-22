import type { ReadingTextQuestion } from '../api'

interface Props {
  index: number
  question: ReadingTextQuestion
  answer: string
  onAnswer: (val: string) => void
  checked: boolean
  isMissing?: boolean
}

export default function QuestionCard({ index, question, answer, onAnswer, checked, isMissing }: Props) {
  const expected = (question.correctAnswer ?? '').trim().toLowerCase()
  const given = answer.trim().toLowerCase()
  const gradable = question.type !== 'FreeText'
  const isCorrect = checked && gradable && !!given && !!expected && given === expected
  const isWrong = checked && gradable && !!given && !isCorrect

  const typeLabel = question.type === 'MultipleChoice' ? 'Multiple choice'
    : question.type === 'TrueFalse' ? 'True / false'
    : question.type === 'ShortAnswer' ? 'Short answer'
    : 'Open response'

  return (
    <article className={`question-card${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}${checked ? ' is-checked' : ''}${isMissing ? ' is-missing' : ''}`}>
      <header className="question-card-head">
        <span className="question-card-num">{index + 1}</span>
        <div className="question-card-head-text">
          <span className="question-card-type">{typeLabel}</span>
          <p className="question-card-prompt">{question.prompt}</p>
        </div>
        {checked && gradable && (
          <span className={`question-card-status${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}`} aria-hidden>
            {isCorrect ? (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            )}
          </span>
        )}
        {isMissing && !checked && (
          <span className="question-card-missing" aria-hidden>Answer required</span>
        )}
      </header>

      {question.type === 'MultipleChoice' && question.options && (
        <div className="question-card-options">
          {question.options.map((opt, i) => {
            const selected = answer === opt
            const isAnswer = opt === question.correctAnswer
            const cls = [
              'question-option',
              selected ? 'is-selected' : '',
              checked && isAnswer ? 'is-answer' : '',
              checked && selected && !isAnswer ? 'is-miss' : '',
            ].filter(Boolean).join(' ')
            return (
              <label key={i} className={cls}>
                <input type="radio" name={question.id} checked={selected} onChange={() => onAnswer(opt)} disabled={checked} />
                <span className="question-option-marker" aria-hidden />
                <span className="question-option-text">{opt}</span>
              </label>
            )
          })}
        </div>
      )}

      {question.type === 'TrueFalse' && (
        <div className="question-card-tf">
          {['Richtig', 'Falsch'].map(opt => {
            const selected = answer === opt
            const isAnswer = opt === question.correctAnswer
            const cls = [
              'question-tf-pill',
              selected ? 'is-selected' : '',
              checked && isAnswer ? 'is-answer' : '',
              checked && selected && !isAnswer ? 'is-miss' : '',
            ].filter(Boolean).join(' ')
            return (
              <label key={opt} className={cls}>
                <input type="radio" name={question.id} checked={selected} onChange={() => onAnswer(opt)} disabled={checked} />
                <span>{opt}</span>
              </label>
            )
          })}
        </div>
      )}

      {question.type === 'ShortAnswer' && (
        <div className="question-input-wrap">
          <input
            type="text"
            className="question-input"
            value={answer}
            onChange={e => onAnswer(e.target.value)}
            disabled={checked}
            placeholder="Type your answer"
          />
        </div>
      )}

      {question.type === 'FreeText' && (
        <div className="question-input-wrap">
          <textarea
            className="question-textarea"
            value={answer}
            onChange={e => onAnswer(e.target.value)}
            rows={3}
            disabled={checked}
            placeholder="Write your response in German"
          />
          <span className="question-input-hint">Not auto-graded</span>
        </div>
      )}

      {checked && gradable && question.correctAnswer && !isCorrect && (
        <p className="question-card-reveal">
          <span>Correct answer</span>
          <strong>{question.correctAnswer}</strong>
        </p>
      )}
    </article>
  )
}
