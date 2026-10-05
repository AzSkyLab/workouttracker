import { useState } from 'react';
import { WorkoutExercise, ExerciseType, Set as WorkoutSet, UpdateSetDto } from '@workout-tracker/shared';
import { useWorkout } from '../contexts/WorkoutContext';

interface EditDraft {
  reps: string;
  weight: string;
  rpe: string;
  durationMinutes: string;
  distanceMiles: string;
  caloriesBurned: string;
}

interface SetLoggerProps {
  workoutExercise: WorkoutExercise;
  onSetLogged?: (isLastSet: boolean) => void;
}

export default function SetLogger({ workoutExercise, onSetLogged }: SetLoggerProps) {
  const isCardio = workoutExercise.exercise?.type === ExerciseType.CARDIO;
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const getInitialWeight = () => {
    if (workoutExercise.sets.length > 0) {
      const lastSet = workoutExercise.sets[workoutExercise.sets.length - 1];
      return lastSet.weight || 0;
    }
    return workoutExercise.suggestedWeight || 0;
  };

  const getInitialReps = () => {
    if (workoutExercise.sets.length > 0) {
      const lastSet = workoutExercise.sets[workoutExercise.sets.length - 1];
      return lastSet.reps ?? workoutExercise.targetReps;
    }
    return workoutExercise.targetReps;
  };

  const getInitialDuration = () => {
    if (workoutExercise.sets.length > 0) {
      const lastSet = workoutExercise.sets[workoutExercise.sets.length - 1];
      return lastSet.durationMinutes || 30;
    }
    return 30;
  };

  const getInitialDistance = () => {
    if (workoutExercise.sets.length > 0) {
      const lastSet = workoutExercise.sets[workoutExercise.sets.length - 1];
      return lastSet.distanceMiles || 0;
    }
    return 0;
  };

  // Strength exercise state (string-based to allow clearing inputs)
  const [reps, setReps] = useState(String(getInitialReps()));
  const [weight, setWeight] = useState(getInitialWeight() ? String(getInitialWeight()) : '');
  const [rpe, setRpe] = useState<number | undefined>(undefined);

  // Cardio exercise state (string-based to allow clearing inputs)
  const [durationMinutes, setDurationMinutes] = useState(String(getInitialDuration()));
  const [distanceMiles, setDistanceMiles] = useState(getInitialDistance() ? String(getInitialDistance()) : '');
  const [caloriesBurned, setCaloriesBurned] = useState<string>('');

  // Notes state
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');

  const { logSet, updateSet } = useWorkout();

  const nextSetNumber = workoutExercise.sets.length + 1;

  // For cardio, only allow 1 set total
  const maxSets = isCardio ? 1 : workoutExercise.targetSets;

  const handleLogSet = async (failed = false) => {
    try {
      const trimmedNotes = notes.trim() || undefined;
      if (isCardio) {
        await logSet(workoutExercise.id, {
          setNumber: nextSetNumber,
          durationMinutes: Number(durationMinutes) || 0,
          distanceMiles: Number(distanceMiles) || 0,
          caloriesBurned: caloriesBurned ? Number(caloriesBurned) : undefined,
          completed: !failed,
          notes: trimmedNotes,
        });
      } else {
        await logSet(workoutExercise.id, {
          setNumber: nextSetNumber,
          reps: Number(reps) || 0,
          weight: Number(weight) || 0,
          rpe,
          completed: !failed,
          notes: trimmedNotes,
        });
        // Keep reps and weight for the next set so an override carries forward
        setRpe(undefined);
      }
      // Tell parent whether this was the last set
      onSetLogged?.(nextSetNumber >= maxSets);
      // Reset notes after logging
      setNotes('');
      setShowNotes(false);
    } catch (error) {
      console.error('Failed to log set:', error);
    }
  };

  const handleUpdateSet = async (setId: string, field: string, value: number | boolean) => {
    try {
      await updateSet(setId, { [field]: value });
    } catch (error) {
      console.error('Failed to update set:', error);
    }
  };

  // Edits go into a local draft and are saved once on Done. Saving per keystroke
  // raced (each one fired a PUT + refetch) and the input snapped back to server state.
  const startEditing = (set: WorkoutSet) => {
    setEditDraft({
      reps: set.reps != null ? String(set.reps) : '',
      weight: set.weight != null ? String(set.weight) : '',
      rpe: set.rpe != null ? String(set.rpe) : '',
      durationMinutes: set.durationMinutes != null ? String(set.durationMinutes) : '',
      distanceMiles: set.distanceMiles != null ? String(set.distanceMiles) : '',
      caloriesBurned: set.caloriesBurned != null ? String(set.caloriesBurned) : '',
    });
    setEditingSetId(set.id);
  };

  const updateDraft = (field: keyof EditDraft, value: string) => {
    setEditDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const saveEdit = async (set: WorkoutSet, extra: UpdateSetDto = {}) => {
    if (!editDraft) return;
    const changes: UpdateSetDto = { ...extra };
    if (isCardio) {
      const durationMinutes = Number(editDraft.durationMinutes) || 0;
      const distanceMiles = Number(editDraft.distanceMiles) || 0;
      const caloriesBurned = editDraft.caloriesBurned ? Number(editDraft.caloriesBurned) : null;
      if (durationMinutes !== (set.durationMinutes ?? 0)) changes.durationMinutes = durationMinutes;
      if (distanceMiles !== (set.distanceMiles ?? 0)) changes.distanceMiles = distanceMiles;
      if (caloriesBurned !== (set.caloriesBurned ?? null)) changes.caloriesBurned = caloriesBurned;
    } else {
      const reps = Number(editDraft.reps) || 0;
      const weight = Number(editDraft.weight) || 0;
      const rpe = editDraft.rpe ? Math.min(10, Math.max(1, Number(editDraft.rpe))) : null;
      if (reps !== (set.reps ?? 0)) changes.reps = reps;
      if (weight !== (set.weight ?? 0)) changes.weight = weight;
      if (rpe !== (set.rpe ?? null)) changes.rpe = rpe;
    }

    try {
      if (Object.keys(changes).length > 0) {
        await updateSet(set.id, changes);
      }
      setEditingSetId(null);
      setEditDraft(null);
    } catch (error) {
      console.error('Failed to update set:', error);
      alert('Could not save the set. Check your connection and try again.');
    }
  };

  return (
    <div>
      {workoutExercise.sets.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
            {isCardio ? 'Activity Logged' : 'Completed Sets'}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {workoutExercise.sets
              .sort((a, b) => a.setNumber - b.setNumber)
              .map((set) => {
                const isEditing = editingSetId === set.id;

                return (
                  <div key={set.id}>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'center',
                        padding: '0.5rem',
                        backgroundColor: 'var(--background)',
                        borderRadius: '0.375rem',
                        border: isEditing ? '2px solid var(--primary)' : '1px solid var(--border)',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', minWidth: '40px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {isCardio ? '✓' : `#${set.setNumber}`}
                        {!set.completed && !isCardio && (
                          <button
                            onClick={() => handleUpdateSet(set.id, 'completed', true)}
                            title="Undo failed — mark as completed"
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              color: '#dc2626',
                              backgroundColor: '#fef2f2',
                              padding: '0.125rem 0.375rem',
                              borderRadius: '0.25rem',
                              textTransform: 'uppercase',
                              border: '1px solid transparent',
                              cursor: 'pointer',
                            }}
                          >
                            Failed ✕
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        // Edit Mode
                        <>
                          {isCardio ? (
                            <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                              <div style={{ flex: 1 }}>
                                <input
                                  type="number"
                                  className="input"
                                  value={editDraft?.durationMinutes ?? ''}
                                  onChange={(e) => updateDraft('durationMinutes', e.target.value)}
                                  style={{ padding: '0.5rem', fontSize: '0.875rem', width: '100%' }}
                                  placeholder="Minutes"
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                                  minutes
                                </div>
                              </div>
                              <div style={{ flex: 1 }}>
                                <input
                                  type="number"
                                  className="input"
                                  value={editDraft?.distanceMiles ?? ''}
                                  onChange={(e) => updateDraft('distanceMiles', e.target.value)}
                                  step="0.1"
                                  style={{ padding: '0.5rem', fontSize: '0.875rem', width: '100%' }}
                                  placeholder="Miles"
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                                  miles
                                </div>
                              </div>
                              <div style={{ flex: 1 }}>
                                <input
                                  type="number"
                                  className="input"
                                  value={editDraft?.caloriesBurned ?? ''}
                                  onChange={(e) => updateDraft('caloriesBurned', e.target.value)}
                                  style={{ padding: '0.5rem', fontSize: '0.875rem', width: '100%' }}
                                  placeholder="Calories"
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                                  calories
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                              <div style={{ flex: 1 }}>
                                <input
                                  type="number"
                                  className="input"
                                  value={editDraft?.reps ?? ''}
                                  onChange={(e) => updateDraft('reps', e.target.value)}
                                  style={{ padding: '0.5rem', fontSize: '0.875rem', width: '100%' }}
                                  placeholder="Reps"
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                                  reps
                                </div>
                              </div>
                              <div style={{ flex: 1 }}>
                                <input
                                  type="number"
                                  className="input"
                                  value={editDraft?.weight ?? ''}
                                  onChange={(e) => updateDraft('weight', e.target.value)}
                                  step="0.5"
                                  style={{ padding: '0.5rem', fontSize: '0.875rem', width: '100%' }}
                                  placeholder="Weight"
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                                  lbs
                                </div>
                              </div>
                              <div style={{ flex: 1 }}>
                                <input
                                  type="number"
                                  className="input"
                                  value={editDraft?.rpe ?? ''}
                                  onChange={(e) => updateDraft('rpe', e.target.value)}
                                  min={1}
                                  max={10}
                                  style={{ padding: '0.5rem', fontSize: '0.875rem', width: '100%' }}
                                  placeholder="RPE"
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                                  RPE (1-10)
                                </div>
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <button
                              onClick={() => saveEdit(set)}
                              className="btn btn-primary"
                              style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
                            >
                              Done
                            </button>
                            {set.completed && !isCardio && (
                              <button
                                onClick={() => saveEdit(set, { completed: false })}
                                style={{
                                  fontSize: '0.625rem',
                                  fontWeight: 700,
                                  color: '#dc2626',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '0.125rem',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Mark Failed
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        // Display Mode
                        <>
                          {isCardio ? (
                            <div style={{ display: 'flex', gap: '1rem', flex: 1, fontSize: '0.875rem' }}>
                              <div>
                                <span style={{ fontWeight: 600 }}>{set.durationMinutes || 0}</span>
                                <span style={{ color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>min</span>
                              </div>
                              <div>
                                <span style={{ fontWeight: 600 }}>{set.distanceMiles || 0}</span>
                                <span style={{ color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>mi</span>
                              </div>
                              {set.caloriesBurned && (
                                <div>
                                  <span style={{ fontWeight: 600 }}>{set.caloriesBurned}</span>
                                  <span style={{ color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>cal</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '1rem', flex: 1, fontSize: '0.875rem' }}>
                              <div>
                                <span style={{ fontWeight: 600 }}>{set.reps || 0}</span>
                                <span style={{ color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>reps</span>
                              </div>
                              <div>
                                <span style={{ fontWeight: 600 }}>{set.weight || 0}</span>
                                <span style={{ color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>lbs</span>
                              </div>
                              {set.rpe && (
                                <div>
                                  <span style={{ fontWeight: 600 }}>RPE {set.rpe}</span>
                                </div>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => startEditing(set)}
                            className="btn btn-outline"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', whiteSpace: 'nowrap' }}
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                    {set.notes && (
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                        paddingLeft: '0.5rem',
                        marginTop: '0.25rem',
                      }}>
                        {set.notes}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {nextSetNumber <= maxSets && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'var(--background)',
          borderRadius: '0.375rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: '600' }}>
              {isCardio ? 'Log Activity' : `Log Set #${nextSetNumber}`}
            </h4>
            {workoutExercise.tempo && (
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>
                Tempo: {workoutExercise.tempo}
              </span>
            )}
          </div>

          {isCardio ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 500 }}>
                  Duration (min)
                </label>
                <input
                  type="number"
                  className="input"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  min={0}
                  style={{ padding: '0.5rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 500 }}>
                  Distance (mi)
                </label>
                <input
                  type="number"
                  className="input"
                  value={distanceMiles}
                  onChange={(e) => setDistanceMiles(e.target.value)}
                  min={0}
                  step="0.1"
                  style={{ padding: '0.5rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 500 }}>
                  Calories
                </label>
                <input
                  type="number"
                  className="input"
                  value={caloriesBurned}
                  onChange={(e) => setCaloriesBurned(e.target.value)}
                  min={0}
                  placeholder="Optional"
                  style={{ padding: '0.5rem' }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 500 }}>
                  Reps
                </label>
                <input
                  type="number"
                  className="input"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  min={0}
                  style={{ padding: '0.5rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 500 }}>
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  className="input"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  min={0}
                  step="0.5"
                  placeholder={workoutExercise.suggestedWeight ? String(Math.round(workoutExercise.suggestedWeight)) : '0'}
                  style={{ padding: '0.5rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 500 }}>
                  RPE (1-10)
                </label>
                <input
                  type="number"
                  className="input"
                  value={rpe || ''}
                  onChange={(e) => setRpe(e.target.value ? Number(e.target.value) : undefined)}
                  min={1}
                  max={10}
                  placeholder="Optional"
                  style={{ padding: '0.5rem' }}
                />
              </div>
            </div>
          )}

          {/* Notes toggle and input */}
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={() => setShowNotes(!showNotes)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                padding: '0.25rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              {showNotes ? '- Hide notes' : '+ Add notes'}
            </button>
            {showNotes && (
              <input
                type="text"
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., extra rest, form check, felt easy..."
                style={{ padding: '0.5rem', fontSize: '0.875rem', marginTop: '0.25rem' }}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => handleLogSet(false)}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {isCardio ? 'Log Activity' : 'Log Set'}
            </button>
            {!isCardio && (
              <button
                onClick={() => handleLogSet(true)}
                className="btn btn-outline"
                style={{
                  flex: 0,
                  whiteSpace: 'nowrap',
                  color: '#dc2626',
                  borderColor: '#dc2626',
                }}
              >
                Failed Set
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
