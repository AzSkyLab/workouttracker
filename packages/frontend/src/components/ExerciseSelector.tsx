import { useState, useEffect } from 'react';
import { useWorkout } from '../contexts/WorkoutContext';
import { Exercise, MuscleGroup, ExerciseCategory, ExerciseType, Difficulty } from '@workout-tracker/shared';
import api from '../services/api';

interface ExerciseSelectorProps {
  workoutId?: string;
  onClose: () => void;
  onAddExercise?: (exercise: Exercise, data: {
    targetSets?: number;
    targetReps?: number;
    restBetweenSets?: number;
    targetDurationMinutes?: number;
    targetDistanceMiles?: number;
  }) => void;
}

interface ProgressionData {
  exerciseId: string;
  exerciseName: string;
  lastWorkout?: {
    avgWeight: number;
    avgReps: number;
  };
  recommendation: string;
  recommendationDetails: string;
}

export default function ExerciseSelector({ workoutId, onClose, onAddExercise }: ExerciseSelectorProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [targetSets, setTargetSets] = useState(3);
  const [targetReps, setTargetReps] = useState(10);
  const [targetDurationMinutes, setTargetDurationMinutes] = useState(30);
  const [targetDistanceMiles, setTargetDistanceMiles] = useState(3);
  const [restBetweenSets, setRestBetweenSets] = useState(90); // in seconds, default 90s
  const [filterMuscleGroup, setFilterMuscleGroup] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('');
  const [search, setSearch] = useState('');
  const [progression, setProgression] = useState<ProgressionData | null>(null);
  const { getExercises, addExerciseToWorkout } = useWorkout();

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    try {
      const data = await getExercises();
      setExercises(data);
    } catch (error) {
      console.error('Failed to load exercises:', error);
    }
  };

  const filteredExercises = exercises.filter((ex) => {
    const matchesMuscle = !filterMuscleGroup || ex.muscleGroup?.name === filterMuscleGroup;
    const matchesType = !filterType || ex.type === filterType;
    const matchesDifficulty = !filterDifficulty || ex.difficulty === filterDifficulty;
    const matchesSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase());
    return matchesMuscle && matchesType && matchesDifficulty && matchesSearch;
  });

  useEffect(() => {
    if (selectedExercise && selectedExercise.type === ExerciseType.STRENGTH && workoutId) {
      loadProgression(selectedExercise.id);
    } else {
      setProgression(null);
    }
  }, [selectedExercise, workoutId]);

  const loadProgression = async (exerciseId: string) => {
    try {
      const response = await api.get(`/api/v1/progression/exercises/${exerciseId}`);
      setProgression(response.data);

      // Update suggested reps if we have progression data
      if (response.data?.lastWorkout?.avgReps) {
        const avgReps = Math.round(response.data.lastWorkout.avgReps);
        if (response.data.recommendation === 'INCREASE_WEIGHT') {
          setTargetReps(avgReps);
        } else if (response.data.recommendation === 'MORE_REPS') {
          setTargetReps(Math.min(avgReps + 2, 15));
        } else {
          setTargetReps(avgReps);
        }
      }
    } catch (error) {
      console.error('Failed to load progression:', error);
      setProgression(null);
    }
  };

  const handleAddExercise = async () => {
    if (!selectedExercise) return;

    try {
      if (onAddExercise) {
        // Template mode - use custom callback
        const data = selectedExercise.type === ExerciseType.CARDIO
          ? { targetSets: 1, targetDurationMinutes, targetDistanceMiles }
          : { targetSets, targetReps, restBetweenSets };
        onAddExercise(selectedExercise, data);
      } else if (workoutId) {
        // Workout mode - use workout context
        await addExerciseToWorkout(workoutId, {
          exerciseId: selectedExercise.id,
          targetSets,
          targetReps,
          restBetweenSets: selectedExercise.type === ExerciseType.STRENGTH ? restBetweenSets : undefined,
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to add exercise:', error);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
          Add Exercise
        </h2>

        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            className="input"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <select
            className="input"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value={ExerciseType.STRENGTH}>Strength</option>
            <option value={ExerciseType.CARDIO}>Cardio</option>
          </select>
          <select
            className="input"
            value={filterMuscleGroup}
            onChange={(e) => setFilterMuscleGroup(e.target.value)}
            disabled={filterType === ExerciseType.CARDIO}
          >
            <option value="">All Muscle Groups</option>
            {Object.values(MuscleGroup).map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
          >
            <option value="">All Difficulties</option>
            {Object.values(Difficulty).map((d) => (
              <option key={d} value={d}>
                {d.charAt(0) + d.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            maxHeight: '300px',
            overflow: 'auto',
            border: '1px solid var(--border)',
            borderRadius: '0.375rem',
            marginBottom: '1rem',
          }}
        >
          {filteredExercises.map((exercise) => (
            <div
              key={exercise.id}
              onClick={() => setSelectedExercise(exercise)}
              style={{
                padding: '0.75rem',
                cursor: 'pointer',
                backgroundColor:
                  selectedExercise?.id === exercise.id ? 'var(--background)' : 'transparent',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ fontWeight: 500 }}>{exercise.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {exercise.type === ExerciseType.CARDIO
                  ? 'Cardio'
                  : `${exercise.muscleGroup?.name || 'Unknown'} • ${exercise.category?.name || 'Unknown'}`
                }
              </div>
            </div>
          ))}
        </div>

        {selectedExercise && (
          <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--background)', borderRadius: '0.375rem' }}>
            <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
              {selectedExercise.name}
            </h3>
            {selectedExercise.description && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                {selectedExercise.description}
              </p>
            )}

            {progression && progression.lastWorkout && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--primary-bg)', borderRadius: '0.375rem', border: '1px solid var(--primary)' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--primary)' }}>
                  Progression Recommendation
                </div>
                <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  {progression.recommendationDetails}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Last workout: {Math.round(progression.lastWorkout.avgWeight)} lbs × {Math.round(progression.lastWorkout.avgReps)} reps
                  {progression.recommendation === 'INCREASE_WEIGHT' && ` → Try ${Math.round(progression.lastWorkout.avgWeight) + 5} lbs`}
                </div>
              </div>
            )}

            {selectedExercise.type === ExerciseType.CARDIO ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={targetDurationMinutes}
                    onChange={(e) => setTargetDurationMinutes(Number(e.target.value))}
                    min={1}
                    max={300}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                    Distance (miles)
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={targetDistanceMiles}
                    onChange={(e) => setTargetDistanceMiles(Number(e.target.value))}
                    min={0.1}
                    step={0.1}
                    max={100}
                  />
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                      Target Sets
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={targetSets}
                      onChange={(e) => {
                        const sets = Number(e.target.value);
                        setTargetSets(sets);
                        setRestBetweenSets(sets >= 3 ? 180 : sets === 2 ? 120 : 60);
                      }}
                      min={1}
                      max={10}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                      Target Reps
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={targetReps}
                      onChange={(e) => setTargetReps(Number(e.target.value))}
                      min={1}
                      max={50}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                    Rest Between Sets
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[30, 60, 90, 120, 180].map((seconds) => (
                      <button
                        key={seconds}
                        type="button"
                        onClick={() => setRestBetweenSets(seconds)}
                        className="btn"
                        style={{
                          padding: '0.5rem 1rem',
                          flex: '1 1 auto',
                          backgroundColor: restBetweenSets === seconds ? 'var(--primary)' : 'var(--background)',
                          color: restBetweenSets === seconds ? 'white' : 'var(--text)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {seconds < 60 ? `${seconds}s` : `${seconds / 60}min`}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>
            Cancel
          </button>
          <button
            onClick={handleAddExercise}
            className="btn btn-primary"
            disabled={!selectedExercise}
            style={{ flex: 1 }}
          >
            Add Exercise
          </button>
        </div>
      </div>
    </div>
  );
}
