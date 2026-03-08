import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkout } from '../contexts/WorkoutContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useWakeLock } from '../hooks/useWakeLock';
import { Exercise, WorkoutExercise, ExerciseType, WorkoutStatus } from '@workout-tracker/shared';
import { useRestTimer } from '../hooks/useRestTimer';
import RestTimerBar from '../components/RestTimerBar';
import ExerciseSelector from '../components/ExerciseSelector';
import WorkoutExerciseCard from '../components/WorkoutExerciseCard';
import SaveAsTemplateModal from '../components/SaveAsTemplateModal';
import ConfirmModal from '../components/ConfirmModal';
import UserProfileModal from '../components/UserProfileModal';

export default function ActiveWorkout() {
  useWakeLock();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkout, getWorkout, completeWorkout, restartWorkout, deleteWorkout, saveWorkoutAsTemplate } = useWorkout();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const restTimer = useRestTimer();
  const [loading, setLoading] = useState(true);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [completedWorkoutData, setCompletedWorkoutData] = useState<{ id: string; name: string; templateId: string | null } | null>(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [restartModalOpen, setRestartModalOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadWorkout();
    }
  }, [id]);

  const loadWorkout = async () => {
    if (!id) return;

    setLoading(true);
    try {
      await getWorkout(id);
    } catch (error) {
      console.error('Failed to load workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteWorkout = async () => {
    if (!currentWorkout) return;
    setCompleteModalOpen(false);

    try {
      // Store workout data before completing
      const workoutData = {
        id: currentWorkout.id,
        name: currentWorkout.name,
        templateId: currentWorkout.templateId || null,
      };
      const hasExercises = currentWorkout.workoutExercises.length > 0;

      // Complete the workout
      await completeWorkout(currentWorkout.id);

      // Check if we should show the save as template modal
      // Only show for ad-hoc workouts (templateId === null) with exercises
      if (workoutData.templateId === null && hasExercises) {
        setCompletedWorkoutData(workoutData);
        setShowSaveAsTemplateModal(true);
      } else {
        // Navigate directly to history if template-based or empty workout
        navigate('/history');
      }
    } catch (error) {
      console.error('Failed to complete workout:', error);
    }
  };

  const handleRestartWorkout = async () => {
    if (!currentWorkout) return;
    setRestartModalOpen(false);

    try {
      await restartWorkout(currentWorkout.id);
    } catch (error) {
      console.error('Failed to restart workout:', error);
    }
  };

  const handleDeleteWorkout = async () => {
    if (!currentWorkout) return;
    setDeleteModalOpen(false);

    try {
      await deleteWorkout(currentWorkout.id);
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to delete workout:', error);
    }
  };

  const handleSaveAsTemplate = async (data: { name: string; description?: string; color?: string }) => {
    if (!completedWorkoutData) return;

    try {
      await saveWorkoutAsTemplate(completedWorkoutData.id, data);
      setShowSaveAsTemplateModal(false);
      setCompletedWorkoutData(null);
      navigate('/history');
    } catch (error) {
      console.error('Failed to save template:', error);
      throw error; // Re-throw so modal can handle error display
    }
  };

  const handleSkipSaveAsTemplate = () => {
    setShowSaveAsTemplateModal(false);
    setCompletedWorkoutData(null);
    navigate('/history');
  };

  // Calculate current calories burned (real-time estimate)
  const currentCalories = useMemo(() => {
    if (!currentWorkout || !currentWorkout.workoutExercises || !user?.weight) return null;

    // Convert weight to kg if needed
    const weightKg = user.weightUnit === 'KG' ? user.weight : user.weight / 2.20462;

    let totalCalories = 0;

    // RPE to MET mapping (same as backend)
    const getRPEtoMET = (rpe?: number): number => {
      if (!rpe) return 5.0;
      if (rpe >= 1 && rpe <= 5) return 3.5;
      if (rpe >= 6 && rpe <= 7) return 5.0;
      if (rpe >= 8 && rpe <= 9) return 6.5;
      if (rpe === 10) return 8.0;
      return 5.0;
    };

    // Calculate calories for each exercise
    currentWorkout.workoutExercises.forEach((workoutExercise) => {
      const completedSets = workoutExercise.sets.filter((set) => set.completed);
      if (completedSets.length === 0) return;

      if (workoutExercise.exercise?.type === 'CARDIO') {
        // Cardio calories - use user-entered value if available
        completedSets.forEach((set) => {
          if (set.caloriesBurned != null) {
            // User manually entered calories
            totalCalories += set.caloriesBurned;
          } else if (set.durationMinutes) {
            // Calculate based on duration and MET
            const metValue = workoutExercise.exercise?.metValue || 6.0;
            const durationHours = set.durationMinutes / 60;
            totalCalories += metValue * weightKg * durationHours;
          }
        });
      } else {
        // Strength training calories
        let activeCalories = 0;
        completedSets.forEach((set) => {
          if (set.reps) {
            const metValue = getRPEtoMET(set.rpe ?? undefined);
            const setDurationSeconds = set.reps * 5; // 5 seconds per rep
            const durationHours = setDurationSeconds / 3600;
            activeCalories += metValue * weightKg * durationHours;
          }
        });

        // Rest period calories
        const restBetweenSets = workoutExercise.restBetweenSets;
        if (restBetweenSets && completedSets.length > 1) {
          const REST_MET = 1.5;
          const numberOfRestPeriods = completedSets.length - 1;
          const totalRestSeconds = numberOfRestPeriods * restBetweenSets;
          const restDurationHours = totalRestSeconds / 3600;
          activeCalories += REST_MET * weightKg * restDurationHours;
        }

        totalCalories += activeCalories;
      }
    });

    return Math.round(totalCalories);
  }, [currentWorkout, user]);

  if (loading || (currentWorkout && !currentWorkout.workoutExercises)) {
    return <div>Loading workout...</div>;
  }

  // If showing save as template modal, render it even if currentWorkout is null
  if (showSaveAsTemplateModal && completedWorkoutData) {
    return (
      <SaveAsTemplateModal
        workoutName={completedWorkoutData.name}
        onSave={handleSaveAsTemplate}
        onSkip={handleSkipSaveAsTemplate}
        onClose={handleSkipSaveAsTemplate}
      />
    );
  }

  if (!currentWorkout) {
    return <div>Workout not found</div>;
  }

  const isCompleted = currentWorkout.status === WorkoutStatus.COMPLETED;
  const startTime = new Date(currentWorkout.startedAt);
  const elapsedMinutes = Math.floor((Date.now() - startTime.getTime()) / 1000 / 60);

  return (
    <div>
      <div className="workout-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
            {currentWorkout.name}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {isCompleted
              ? `Completed ${new Date(currentWorkout.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : `Started ${elapsedMinutes} minutes ago`
            }
          </p>
        </div>
        <div className="workout-header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
          {isCompleted ? (
            <button onClick={() => navigate(`/workouts/${currentWorkout.id}`)} className="btn btn-outline">
              Back to Details
            </button>
          ) : (
            <>
              <button onClick={() => setDeleteModalOpen(true)} className="btn btn-outline">
                Cancel
              </button>
              <button onClick={() => setRestartModalOpen(true)} className="btn btn-outline">
                Restart
              </button>
              <button onClick={() => setCompleteModalOpen(true)} className="btn btn-success">
                Complete Workout
              </button>
            </>
          )}
        </div>
      </div>

      {!isCompleted && (restTimer.isRunning || restTimer.isComplete) && (
        <div style={{ position: isMobile ? 'sticky' : 'relative', top: 0, zIndex: 100, backgroundColor: 'var(--background)', paddingBottom: '0.5rem' }}>
          <RestTimerBar timer={restTimer} />
        </div>
      )}

      <div className="workout-layout" style={{ display: 'grid', gap: '2rem', gridTemplateColumns: isMobile ? '1fr' : '1fr 350px' }}>
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>
              Exercises
            </h2>
            <button
              onClick={() => setShowExerciseSelector(true)}
              className="btn btn-primary"
            >
              + Add Exercise
            </button>
          </div>

          {currentWorkout.workoutExercises.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                No exercises added yet
              </p>
              <button
                onClick={() => setShowExerciseSelector(true)}
                className="btn btn-primary"
              >
                Add Your First Exercise
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {currentWorkout.workoutExercises
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((workoutExercise, index, sorted) => {
                  const activeIndex = sorted.findIndex((ex) => !ex.completed);
                  return (
                    <WorkoutExerciseCard
                      key={workoutExercise.id}
                      workoutExercise={workoutExercise}
                      workoutId={currentWorkout.id}
                      isActive={index === activeIndex}
                      onRestTimerStart={restTimer.startTimer}
                    />
                  );
                })}
            </div>
          )}

          {isMobile && (
            <div style={{ marginTop: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
                Calories Burned
              </h2>
              <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                {user?.weight ? (
                  <>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                      {currentCalories !== null ? currentCalories : 0}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      kcal (estimate)
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      Set your weight to track calories
                    </div>
                    <button
                      onClick={() => setShowProfileModal(true)}
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                    >
                      Set Up Profile
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {!isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '1rem', alignSelf: 'start' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
                Calories Burned
              </h2>
              <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                {user?.weight ? (
                  <>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                      {currentCalories !== null ? currentCalories : 0}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      kcal (estimate)
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      Set your weight to track calories
                    </div>
                    <button
                      onClick={() => setShowProfileModal(true)}
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                    >
                      Set Up Profile
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showExerciseSelector && (
        <ExerciseSelector
          workoutId={currentWorkout.id}
          onClose={() => setShowExerciseSelector(false)}
        />
      )}

      {/* Complete Workout Confirmation Modal */}
      <ConfirmModal
        isOpen={completeModalOpen}
        title="Complete Workout"
        message="Are you sure you want to complete this workout?"
        confirmText="Complete"
        cancelText="Cancel"
        onConfirm={handleCompleteWorkout}
        onCancel={() => setCompleteModalOpen(false)}
        danger={false}
      />

      {/* Restart Workout Confirmation Modal */}
      <ConfirmModal
        isOpen={restartModalOpen}
        title="Restart Workout"
        message="Are you sure you want to restart this workout? The timer will reset to 0."
        confirmText="Restart"
        cancelText="Cancel"
        onConfirm={handleRestartWorkout}
        onCancel={() => setRestartModalOpen(false)}
        danger={false}
      />

      {/* Delete Workout Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Cancel Workout"
        message="Are you sure you want to cancel and delete this workout? This cannot be undone."
        confirmText="Delete"
        cancelText="Keep Workout"
        onConfirm={handleDeleteWorkout}
        onCancel={() => setDeleteModalOpen(false)}
        danger={true}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </div>
  );
}
