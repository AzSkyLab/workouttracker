import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { templateAPI } from '../services/api';
import {
  WorkoutTemplate,
  TemplateExercise,
  Exercise,
  ExerciseType,
} from '@workout-tracker/shared';
import ExerciseSelector from '../components/ExerciseSelector';

export default function TemplateForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([]);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    targetSets?: number;
    targetReps?: number;
    restBetweenSets?: number;
    restAfterExercise?: number;
    targetDurationMinutes?: number;
    targetDistanceMiles?: number;
    tempo?: string;
    notes?: string;
  }>({});

  useEffect(() => {
    if (id) {
      fetchTemplate();
    }
  }, [id]);

  const fetchTemplate = async () => {
    if (!id) return;
    try {
      const response = await templateAPI.getById(id);
      const template: WorkoutTemplate = response.data;
      setName(template.name);
      setDescription(template.description || '');
      setColor(template.color || '#3b82f6');
      setTemplateExercises(template.templateExercises || []);
    } catch (error) {
      console.error('Failed to fetch template:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (id) {
        await templateAPI.update(id, { name, description, color });
        navigate('/templates');
      } else {
        const response = await templateAPI.create({ name, description, color });
        navigate(`/templates/${response.data.id}/edit`);
      }
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handleRestPeriodChange = async (templateExerciseId: string, field: 'restBetweenSets' | 'restAfterExercise', restSeconds: number) => {
    if (!id) return;
    try {
      const response = await templateAPI.updateExercise(id, templateExerciseId, { [field]: restSeconds });
      setTemplateExercises(templateExercises.map((te) =>
        te.id === templateExerciseId ? response.data : te
      ));
    } catch (error) {
      console.error('Failed to update rest period:', error);
    }
  };

  const handleAddExercise = async (exercise: Exercise, data: {
    targetSets?: number;
    targetReps?: number;
    restBetweenSets?: number;
    restAfterExercise?: number;
    targetDurationMinutes?: number;
    targetDistanceMiles?: number;
  }) => {
    if (!id) {
      alert('Please save the template first before adding exercises');
      return;
    }

    try {
      const response = await templateAPI.addExercise(id, {
        exerciseId: exercise.id,
        ...data,
      });
      setTemplateExercises([...templateExercises, response.data]);
    } catch (error) {
      console.error('Failed to add exercise:', error);
      alert('Failed to add exercise');
    }
  };

  const handleRemoveExercise = async (exerciseId: string) => {
    if (!id) return;

    try {
      await templateAPI.removeExercise(id, exerciseId);
      setTemplateExercises(templateExercises.filter((e) => e.id !== exerciseId));
    } catch (error) {
      console.error('Failed to remove exercise:', error);
      alert('Failed to remove exercise');
    }
  };

  const handleEditExercise = (te: TemplateExercise) => {
    setEditingExerciseId(te.id);
    setEditValues({
      targetSets: te.targetSets ?? undefined,
      targetReps: te.targetReps ?? undefined,
      restBetweenSets: te.restBetweenSets ?? undefined,
      restAfterExercise: te.restAfterExercise ?? undefined,
      targetDurationMinutes: te.targetDurationMinutes ?? undefined,
      targetDistanceMiles: te.targetDistanceMiles ?? undefined,
      tempo: te.tempo ?? undefined,
      notes: te.notes ?? undefined,
    });
  };

  const handleSaveExercise = async (templateExerciseId: string) => {
    if (!id) return;
    try {
      const response = await templateAPI.updateExercise(id, templateExerciseId, editValues);
      setTemplateExercises(templateExercises.map((te) =>
        te.id === templateExerciseId ? response.data : te
      ));
      setEditingExerciseId(null);
    } catch (error) {
      console.error('Failed to update exercise:', error);
      alert('Failed to update exercise');
    }
  };

  const handleCancelEdit = () => {
    setEditingExerciseId(null);
    setEditValues({});
  };

  const handleMoveExercise = async (index: number, direction: 'up' | 'down') => {
    if (!id) return;
    const newExercises = [...templateExercises];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newExercises.length) return;

    [newExercises[index], newExercises[swapIndex]] = [newExercises[swapIndex], newExercises[index]];
    setTemplateExercises(newExercises);

    try {
      await templateAPI.reorderExercises(id, newExercises.map((te) => te.id));
    } catch (error) {
      console.error('Failed to reorder exercises:', error);
      setTemplateExercises(templateExercises);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {id ? 'Edit Template' : 'Create Template'}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {id ? 'Update your workout template' : 'Create a new reusable workout template'}
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: id ? '1fr 1fr' : '1fr' }}>
        {/* Template Details Card */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
            Template Details
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Template Name *
              </label>
              <input
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Push Day, Leg Day, Upper Body"
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Description
              </label>
              <textarea
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of this workout"
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    width: '60px',
                    height: '40px',
                    border: '1px solid var(--border)',
                    borderRadius: '0.375rem',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  This color will be used in your calendar and schedule
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {loading ? 'Saving...' : id ? 'Save & Close' : 'Create Template'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/templates')}
                className="btn btn-outline"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Exercises Card (only shown when editing) */}
        {id && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                Exercises ({templateExercises.length})
              </h2>
              <button
                onClick={() => setShowExerciseSelector(true)}
                className="btn btn-primary"
              >
                + Add Exercise
              </button>
            </div>

            {templateExercises.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                backgroundColor: 'var(--background)',
                borderRadius: '0.375rem',
                border: '2px dashed var(--border)'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💪</div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  No exercises added yet
                </p>
                <button
                  onClick={() => setShowExerciseSelector(true)}
                  className="btn btn-outline"
                >
                  Add Your First Exercise
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {templateExercises.map((te, index) => (
                  <div
                    key={te.id}
                    style={{
                      padding: '1rem',
                      border: editingExerciseId === te.id ? `2px solid ${color}` : '1px solid var(--border)',
                      borderRadius: '0.375rem',
                      backgroundColor: 'var(--background)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: color,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '0.875rem',
                          flexShrink: 0,
                        }}>
                          {index + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                            {te.exercise?.name}
                          </div>
                          {editingExerciseId !== te.id && (
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                              {te.exercise?.type === ExerciseType.CARDIO ? (
                                <>
                                  {te.targetDurationMinutes || 0} min
                                  {te.targetDistanceMiles ? ` • ${te.targetDistanceMiles} mi` : ''}
                                </>
                              ) : (
                                <>
                                  {te.targetSets} sets × {te.targetReps} reps
                                  {te.tempo && <span style={{ color: 'var(--primary)' }}> • {te.tempo}</span>}
                                </>
                              )}
                            </div>
                          )}
                          {te.notes && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                              {te.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        {editingExerciseId !== te.id && (
                          <>
                            <button
                              onClick={() => handleMoveExercise(index, 'up')}
                              disabled={index === 0}
                              style={{
                                padding: '0.25rem 0.5rem',
                                color: index === 0 ? 'var(--border)' : 'var(--text-secondary)',
                                background: 'none',
                                border: 'none',
                                cursor: index === 0 ? 'default' : 'pointer',
                                fontSize: '1rem',
                                lineHeight: 1
                              }}
                              title="Move up"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => handleMoveExercise(index, 'down')}
                              disabled={index === templateExercises.length - 1}
                              style={{
                                padding: '0.25rem 0.5rem',
                                color: index === templateExercises.length - 1 ? 'var(--border)' : 'var(--text-secondary)',
                                background: 'none',
                                border: 'none',
                                cursor: index === templateExercises.length - 1 ? 'default' : 'pointer',
                                fontSize: '1rem',
                                lineHeight: 1
                              }}
                              title="Move down"
                            >
                              ▼
                            </button>
                            <button
                              onClick={() => handleEditExercise(te)}
                              style={{
                                padding: '0.5rem',
                                color: 'var(--text-secondary)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                lineHeight: 1
                              }}
                              title="Edit exercise"
                            >
                              ✎
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleRemoveExercise(te.id)}
                          style={{
                            padding: '0.5rem',
                            color: 'var(--danger)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.25rem',
                            lineHeight: 1
                          }}
                          title="Remove exercise"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    {editingExerciseId !== te.id && te.exercise?.type !== ExerciseType.CARDIO && (
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, minWidth: '75px' }}>
                            Set rest:
                          </span>
                          {[
                            { label: '30s', value: 30 },
                            { label: '1min', value: 60 },
                            { label: '2min', value: 120 },
                            { label: '3min', value: 180 },
                          ].map(({ label, value }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => handleRestPeriodChange(te.id, 'restBetweenSets', value)}
                              style={{
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.75rem',
                                border: '1px solid var(--border)',
                                borderRadius: '0.25rem',
                                cursor: 'pointer',
                                backgroundColor: te.restBetweenSets === value ? 'var(--primary)' : 'var(--surface)',
                                color: te.restBetweenSets === value ? 'white' : 'var(--text-secondary)',
                                fontWeight: te.restBetweenSets === value ? 600 : 400,
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, minWidth: '75px' }}>
                            Exercise rest:
                          </span>
                          {[
                            { label: '1min', value: 60 },
                            { label: '2min', value: 120 },
                            { label: '3min', value: 180 },
                            { label: '5min', value: 300 },
                          ].map(({ label, value }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => handleRestPeriodChange(te.id, 'restAfterExercise', value)}
                              style={{
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.75rem',
                                border: '1px solid var(--border)',
                                borderRadius: '0.25rem',
                                cursor: 'pointer',
                                backgroundColor: te.restAfterExercise === value ? 'var(--success)' : 'var(--surface)',
                                color: te.restAfterExercise === value ? 'white' : 'var(--text-secondary)',
                                fontWeight: te.restAfterExercise === value ? 600 : 400,
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {editingExerciseId === te.id && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                        {te.exercise?.type === ExerciseType.CARDIO ? (
                          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                Duration (min)
                              </label>
                              <input
                                type="number"
                                className="input"
                                value={editValues.targetDurationMinutes ?? ''}
                                onChange={(e) => setEditValues({ ...editValues, targetDurationMinutes: e.target.value ? Number(e.target.value) : undefined })}
                                min={0}
                                style={{ padding: '0.5rem' }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                Distance (mi)
                              </label>
                              <input
                                type="number"
                                className="input"
                                value={editValues.targetDistanceMiles ?? ''}
                                onChange={(e) => setEditValues({ ...editValues, targetDistanceMiles: e.target.value ? Number(e.target.value) : undefined })}
                                min={0}
                                step={0.1}
                                style={{ padding: '0.5rem' }}
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                Sets
                              </label>
                              <input
                                type="number"
                                className="input"
                                value={editValues.targetSets ?? ''}
                                onChange={(e) => {
                                  const sets = e.target.value ? Number(e.target.value) : undefined;
                                  const restDefault = sets !== undefined ? (sets >= 3 ? 180 : sets === 2 ? 120 : 60) : undefined;
                                  setEditValues({ ...editValues, targetSets: sets, restBetweenSets: restDefault });
                                }}
                                min={1}
                                max={10}
                                style={{ padding: '0.5rem' }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                Reps
                              </label>
                              <input
                                type="number"
                                className="input"
                                value={editValues.targetReps ?? ''}
                                onChange={(e) => setEditValues({ ...editValues, targetReps: e.target.value ? Number(e.target.value) : undefined })}
                                min={1}
                                max={50}
                                style={{ padding: '0.5rem' }}
                              />
                            </div>
                          </div>
                          <div style={{ marginBottom: '0.75rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                              Rest Between Sets
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {[
                                { label: '30s', value: 30 },
                                { label: '45s', value: 45 },
                                { label: '60s', value: 60 },
                                { label: '75s', value: 75 },
                                { label: '90s', value: 90 },
                                { label: '2min', value: 120 },
                                { label: '3min', value: 180 },
                              ].map(({ label, value }) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setEditValues({ ...editValues, restBetweenSets: value })}
                                  style={{
                                    padding: '0.375rem 0.75rem',
                                    fontSize: '0.8rem',
                                    border: '1px solid var(--border)',
                                    borderRadius: '0.375rem',
                                    cursor: 'pointer',
                                    backgroundColor: editValues.restBetweenSets === value ? 'var(--primary)' : 'var(--background)',
                                    color: editValues.restBetweenSets === value ? 'white' : 'var(--text)',
                                  }}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div style={{ marginBottom: '0.75rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                              Rest After Exercise
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {[
                                { label: '60s', value: 60 },
                                { label: '90s', value: 90 },
                                { label: '2min', value: 120 },
                                { label: '3min', value: 180 },
                                { label: '5min', value: 300 },
                              ].map(({ label, value }) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setEditValues({ ...editValues, restAfterExercise: value })}
                                  style={{
                                    padding: '0.375rem 0.75rem',
                                    fontSize: '0.8rem',
                                    border: '1px solid var(--border)',
                                    borderRadius: '0.375rem',
                                    cursor: 'pointer',
                                    backgroundColor: editValues.restAfterExercise === value ? 'var(--success)' : 'var(--background)',
                                    color: editValues.restAfterExercise === value ? 'white' : 'var(--text)',
                                  }}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div style={{ marginBottom: '0.75rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                              Tempo (e.g. 3-1-2-0)
                            </label>
                            <input
                              type="text"
                              className="input"
                              value={editValues.tempo || ''}
                              onChange={(e) => setEditValues({ ...editValues, tempo: e.target.value || undefined })}
                              placeholder="eccentric-pause-concentric-pause"
                              style={{ padding: '0.375rem', fontSize: '0.875rem', width: '100%' }}
                            />
                          </div>
                          <div style={{ marginBottom: '0.75rem' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                              Notes
                            </label>
                            <input
                              type="text"
                              className="input"
                              value={editValues.notes || ''}
                              onChange={(e) => setEditValues({ ...editValues, notes: e.target.value || undefined })}
                              placeholder="Exercise notes..."
                              style={{ padding: '0.375rem', fontSize: '0.875rem', width: '100%' }}
                            />
                          </div>
                          </>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={handleCancelEdit}
                            className="btn btn-outline"
                            style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveExercise(te.id)}
                            className="btn btn-primary"
                            style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showExerciseSelector && (
        <ExerciseSelector
          onClose={() => setShowExerciseSelector(false)}
          onAddExercise={handleAddExercise}
        />
      )}
    </div>
  );
}
