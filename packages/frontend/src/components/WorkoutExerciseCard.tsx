import { useState, useEffect } from 'react';
import { WorkoutExercise, ExerciseType } from '@workout-tracker/shared';
import { useWorkout } from '../contexts/WorkoutContext';
import SetLogger from './SetLogger';

interface WorkoutExerciseCardProps {
  workoutExercise: WorkoutExercise;
  workoutId: string;
  isActive?: boolean;
  onRestTimerStart?: (seconds: number) => void;
}

export default function WorkoutExerciseCard({ workoutExercise, workoutId, isActive = true, onRestTimerStart }: WorkoutExerciseCardProps) {
  const [expanded, setExpanded] = useState(isActive);

  useEffect(() => {
    if (isActive) {
      setExpanded(true);
    }
  }, [isActive]);
  const { completeExercise } = useWorkout();

  const isCardio = workoutExercise.exercise?.type === ExerciseType.CARDIO;
  const completedSets = workoutExercise.sets.filter((s) => s.completed).length;
  const targetSets = isCardio ? 1 : workoutExercise.targetSets;
  const progressPercent = (completedSets / targetSets) * 100;

  const handleComplete = async () => {
    if (completedSets < targetSets) {
      const message = isCardio
        ? 'Activity not logged yet. Mark as complete anyway?'
        : `Only ${completedSets} of ${targetSets} sets completed. Mark as complete anyway?`;
      if (!confirm(message)) {
        return;
      }
    }

    try {
      await completeExercise(workoutId, workoutExercise.id);
      onRestTimerStart?.(workoutExercise.restAfterExercise || 180);
      // Auto-collapse after marking complete
      setExpanded(false);
    } catch (error) {
      console.error('Failed to complete exercise:', error);
    }
  };

  return (
    <div className="card" style={{
      borderLeft: workoutExercise.completed ? '4px solid var(--success)' : '4px solid var(--primary)',
    }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: expanded ? '1rem' : 0,
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.25rem' }}>
            {workoutExercise.exercise?.name}
            {workoutExercise.completed && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>✓</span>
            )}
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {isCardio ? (
              <>
                {completedSets > 0 ? 'Activity logged' : 'Target: '}
                {workoutExercise.targetDurationMinutes && `${workoutExercise.targetDurationMinutes} min`}
                {workoutExercise.targetDistanceMiles && ` • ${workoutExercise.targetDistanceMiles} mi`}
              </>
            ) : (
              <>
                {completedSets} / {workoutExercise.targetSets} sets • {workoutExercise.targetReps} reps target
                {workoutExercise.previousWeight && (
                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
                    • Last: {Math.round(workoutExercise.previousWeight)} lbs x {Math.round(workoutExercise.previousReps || 0)}
                  </span>
                )}
                {workoutExercise.suggestedWeight && (
                  <span style={{ marginLeft: '0.25rem', color: 'var(--primary)', fontWeight: 600 }}>
                    → {Math.round(workoutExercise.suggestedWeight)} lbs x {workoutExercise.targetReps}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <button
          className="btn btn-outline"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? '−' : '+'}
        </button>
      </div>

      {expanded && (
        <>
          <div
            style={{
              height: '4px',
              backgroundColor: 'var(--border)',
              borderRadius: '2px',
              overflow: 'hidden',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                height: '100%',
                backgroundColor: 'var(--success)',
                width: `${progressPercent}%`,
                transition: 'width 0.3s',
              }}
            />
          </div>

          <SetLogger workoutExercise={workoutExercise} onSetLogged={() => onRestTimerStart?.(workoutExercise.restBetweenSets || 60)} />

          {!workoutExercise.completed && (
            <button
              onClick={handleComplete}
              className="btn btn-success"
              style={{ width: '100%', marginTop: '1rem' }}
            >
              Mark Exercise Complete
            </button>
          )}
        </>
      )}
    </div>
  );
}
