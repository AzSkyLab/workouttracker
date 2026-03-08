import { RestTimerReturn } from '../hooks/useRestTimer';

interface RestTimerBarProps {
  timer: RestTimerReturn;
}

export default function RestTimerBar({ timer }: RestTimerBarProps) {
  const { remainingSeconds, isRunning, isComplete, isLastSeconds, progress, formatTime, cancelTimer } = timer;

  if (!isRunning && !isComplete) return null;

  const bgColor = isComplete ? '#d1fae5' : isLastSeconds ? '#fee2e2' : 'var(--surface)';
  const textColor = isComplete ? '#065f46' : isLastSeconds ? '#991b1b' : 'var(--text)';
  const barColor = isComplete ? '#10b981' : isLastSeconds ? '#ef4444' : 'var(--primary)';

  return (
    <div style={{
      padding: '0.5rem 1rem',
      backgroundColor: bgColor,
      borderRadius: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      transition: 'background-color 0.3s',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        whiteSpace: 'nowrap',
      }}>
        {isComplete ? 'REST DONE' : 'REST'}
      </div>
      <div style={{
        fontSize: '1.25rem',
        fontWeight: 'bold',
        fontVariantNumeric: 'tabular-nums',
        color: textColor,
        minWidth: '2.5rem',
      }}>
        {isComplete ? 'Go!' : formatTime(remainingSeconds)}
      </div>
      <div style={{
        flex: 1,
        height: '4px',
        backgroundColor: 'var(--border)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          backgroundColor: barColor,
          width: `${progress}%`,
          transition: 'width 0.25s linear',
        }} />
      </div>
      {!isComplete && (
        <button
          onClick={cancelTimer}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            lineHeight: 1,
          }}
          aria-label="Cancel rest timer"
        >
          ✕
        </button>
      )}
    </div>
  );
}
