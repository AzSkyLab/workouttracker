import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiAPI, exerciseAPI } from '../services/api';
import {
  FitnessGoal,
  ExperienceLevel,
  AiPlanPreview,
  AiModelInfo,
  GenerateWorkoutPlanResponse,
} from '@workout-tracker/shared';

type Phase = 'form' | 'generating' | 'review' | 'results';

const GOALS = [
  { value: FitnessGoal.MUSCLE_GAIN, label: 'Muscle Gain' },
  { value: FitnessGoal.FAT_LOSS, label: 'Fat Loss' },
  { value: FitnessGoal.STRENGTH, label: 'Strength' },
  { value: FitnessGoal.GENERAL_FITNESS, label: 'General Fitness' },
  { value: FitnessGoal.ENDURANCE, label: 'Endurance' },
];

const LEVELS = [
  { value: ExperienceLevel.BEGINNER, label: 'Beginner' },
  { value: ExperienceLevel.INTERMEDIATE, label: 'Intermediate' },
  { value: ExperienceLevel.ADVANCED, label: 'Advanced' },
];

const DURATIONS = [30, 45, 60, 75, 90];

export default function AiPlanGenerator() {
  const navigate = useNavigate();

  // Form state
  const [goal, setGoal] = useState<FitnessGoal>(FitnessGoal.GENERAL_FITNESS);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(ExperienceLevel.INTERMEDIATE);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [sessionDuration, setSessionDuration] = useState(60);
  const [availableEquipment, setAvailableEquipment] = useState<string[]>([]);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [includeCardio, setIncludeCardio] = useState(true);

  // Data for selectors
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<{ id: string; name: string }[]>([]);
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  // UI state
  const [phase, setPhase] = useState<Phase>('form');
  const [preview, setPreview] = useState<AiPlanPreview | null>(null);
  const [saveResult, setSaveResult] = useState<GenerateWorkoutPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    Promise.all([
      exerciseAPI.getCategories(),
      exerciseAPI.getMuscleGroups(),
      aiAPI.getModels().catch(() => ({ data: [] })),
    ]).then(([catRes, mgRes, modelsRes]) => {
      setCategories(catRes.data);
      setMuscleGroups(mgRes.data);
      const modelList: AiModelInfo[] = modelsRes.data;
      setModels(modelList);
      if (modelList.length > 0 && !selectedModel) {
        setSelectedModel(modelList[0].name);
      }
    });
  }, []);

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const handleGenerate = async () => {
    setPhase('generating');
    setError(null);

    try {
      const response = await aiAPI.generatePlan({
        goal,
        experienceLevel,
        daysPerWeek,
        sessionDurationMinutes: sessionDuration,
        availableEquipment,
        focusAreas,
        includeCardio,
        ...(selectedModel && { model: selectedModel }),
      });
      setPreview(response.data);
      setPhase('review');
    } catch (err: any) {
      const msg =
        err.response?.data?.error || err.message || 'Failed to generate plan';
      setError(msg);
      setPhase('form');
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    setError(null);

    try {
      const response = await aiAPI.savePlan({
        planName: preview.planName,
        days: preview.days,
      });
      setSaveResult(response.data);
      setPhase('results');
    } catch (err: any) {
      const msg =
        err.response?.data?.error || err.message || 'Failed to save plan';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setPreview(null);
    setPhase('form');
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setPhase('form');
  };

  // ── Pill button helper ──
  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.5rem 1rem',
    borderRadius: '9999px',
    border: active ? '2px solid var(--primary)' : '2px solid var(--border)',
    backgroundColor: active ? 'var(--primary)' : 'transparent',
    color: active ? '#fff' : 'var(--text)',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '0.875rem',
    transition: 'all 0.15s',
  });

  // ── FORM PHASE ──
  if (phase === 'form') {
    return (
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => navigate('/templates')}
            className="btn btn-outline"
            style={{ marginBottom: '1rem', fontSize: '0.875rem' }}
          >
            &larr; Back to Templates
          </button>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            AI Workout Plan Generator
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Tell us about your goals and we'll generate a complete workout split for you.
          </p>
        </div>

        {error && (
          <div
            className="card"
            style={{
              marginBottom: '1.5rem',
              borderLeft: '4px solid var(--danger)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
            }}
          >
            <p style={{ color: 'var(--danger)', fontWeight: 500 }}>{error}</p>
          </div>
        )}

        {models.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
              AI Model
            </h2>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                borderRadius: '0.5rem',
                border: '2px solid var(--border)',
                backgroundColor: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}{m.parameterSize ? ` (${m.parameterSize})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
            Fitness Goal
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {GOALS.map((g) => (
              <button key={g.value} style={pillStyle(goal === g.value)} onClick={() => setGoal(g.value)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
            Experience Level
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {LEVELS.map((l) => (
              <button
                key={l.value}
                style={pillStyle(experienceLevel === l.value)}
                onClick={() => setExperienceLevel(l.value)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
            Days Per Week
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <button
                key={d}
                style={{
                  ...pillStyle(daysPerWeek === d),
                  width: '3rem',
                  textAlign: 'center' as const,
                }}
                onClick={() => setDaysPerWeek(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
            Session Duration
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {DURATIONS.map((d) => (
              <button
                key={d}
                style={pillStyle(sessionDuration === d)}
                onClick={() => setSessionDuration(d)}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
            Available Equipment
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            Select all equipment you have access to. Leave empty for all.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {categories.map((c) => (
              <button
                key={c.id}
                style={pillStyle(availableEquipment.includes(c.name))}
                onClick={() => toggleItem(availableEquipment, setAvailableEquipment, c.name)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
            Focus Areas
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            Select muscle groups you want to prioritize. Leave empty for balanced.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {muscleGroups.map((mg) => (
              <button
                key={mg.id}
                style={pillStyle(focusAreas.includes(mg.name))}
                onClick={() => toggleItem(focusAreas, setFocusAreas, mg.name)}
              >
                {mg.name}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '2rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Include Cardio
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Add cardio exercises to your plan
              </p>
            </div>
            <button
              onClick={() => setIncludeCardio(!includeCardio)}
              style={{
                width: '3rem',
                height: '1.75rem',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: includeCardio ? 'var(--primary)' : 'var(--border)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              <div
                style={{
                  width: '1.25rem',
                  height: '1.25rem',
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  position: 'absolute',
                  top: '0.25rem',
                  left: includeCardio ? '1.5rem' : '0.25rem',
                  transition: 'left 0.2s',
                }}
              />
            </button>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          className="btn btn-primary"
          style={{ width: '100%', padding: '1rem', fontSize: '1.125rem', fontWeight: 600 }}
        >
          Generate Plan
        </button>
      </div>
    );
  }

  // ── GENERATING PHASE ──
  if (phase === 'generating') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '4rem',
            height: '4rem',
            border: '4px solid var(--border)',
            borderTop: '4px solid var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '2rem',
          }}
        />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Generating your workout plan...
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          This may take 1-3 minutes depending on your model
        </p>
        <button onClick={handleCancel} className="btn btn-outline">
          Cancel
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── REVIEW PHASE ──
  if (phase === 'review' && preview) {
    return (
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={handleDiscard}
            className="btn btn-outline"
            style={{ marginBottom: '1rem', fontSize: '0.875rem' }}
          >
            &larr; Back to Form
          </button>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Review Your Plan
          </h1>
        </div>

        {/* Success banner with generation time */}
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            borderLeft: '4px solid var(--success, #10b981)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
          }}
        >
          <p style={{ fontWeight: 600, fontSize: '1.125rem' }}>{preview.planName}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Generated in {preview.generationTimeSeconds}s{preview.model ? ` with ${preview.model}` : ''} &middot; {preview.days.length} workout{preview.days.length !== 1 ? 's' : ''} &middot; Review below and save when ready
          </p>
        </div>

        {/* Error from save attempt */}
        {error && (
          <div
            className="card"
            style={{
              marginBottom: '1.5rem',
              borderLeft: '4px solid var(--danger)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
            }}
          >
            <p style={{ color: 'var(--danger)', fontWeight: 500 }}>{error}</p>
          </div>
        )}

        {/* Warnings */}
        {preview.warnings.length > 0 && (
          <div
            className="card"
            style={{
              marginBottom: '1.5rem',
              borderLeft: '4px solid var(--warning, #f59e0b)',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
            }}
          >
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Notes</p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
              {preview.warnings.map((w, i) => (
                <li key={i} style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Day cards with exercise details */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          {preview.days.map((day, dayIdx) => (
            <div
              key={dayIdx}
              className="card"
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '6px',
                  backgroundColor: day.color,
                }}
              />
              <div style={{ paddingTop: '0.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {day.dayName}
                </h3>
                {day.description && (
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.875rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    {day.description}
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {day.exercises.map((ex, exIdx) => (
                    <div
                      key={exIdx}
                      style={{
                        padding: '0.5rem 0.625rem',
                        backgroundColor: 'var(--background)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: ex.reason ? '0.25rem' : 0,
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{ex.name}</span>
                        <span
                          style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.8rem',
                            whiteSpace: 'nowrap',
                            marginLeft: '0.75rem',
                          }}
                        >
                          {ex.durationMinutes
                            ? `${ex.durationMinutes} min`
                            : `${ex.sets} x ${ex.reps}`}
                          {ex.restSeconds ? ` · ${ex.restSeconds}s rest` : ''}
                        </span>
                      </div>
                      {ex.reason && (
                        <p
                          style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.775rem',
                            fontStyle: 'italic',
                            margin: 0,
                            lineHeight: 1.3,
                          }}
                        >
                          {ex.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
            style={{ flex: 2, minWidth: '200px', padding: '0.875rem', fontSize: '1rem', fontWeight: 600 }}
          >
            {saving ? 'Saving...' : 'Save Plan'}
          </button>
          <button
            onClick={handleDiscard}
            disabled={saving}
            className="btn btn-outline"
            style={{ flex: 1, minWidth: '120px', padding: '0.875rem' }}
          >
            Discard
          </button>
        </div>
      </div>
    );
  }

  // ── RESULTS PHASE ──
  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Plan Saved!
        </h1>
      </div>

      {/* Success banner */}
      <div
        className="card"
        style={{
          marginBottom: '2rem',
          borderLeft: '4px solid var(--success, #10b981)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
        }}
      >
        <p style={{ fontWeight: 600, fontSize: '1.125rem' }}>{saveResult?.planName}</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {saveResult?.templates.length} template{saveResult?.templates.length !== 1 ? 's' : ''} created and saved to your library.
        </p>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/templates')}
          className="btn btn-primary"
          style={{ flex: 1, minWidth: '200px', padding: '0.75rem' }}
        >
          View All Templates
        </button>
        <button
          onClick={() => navigate('/schedule')}
          className="btn btn-outline"
          style={{ flex: 1, minWidth: '200px', padding: '0.75rem' }}
        >
          Set Up Schedule
        </button>
        <button
          onClick={() => {
            setPhase('form');
            setPreview(null);
            setSaveResult(null);
          }}
          className="btn btn-outline"
          style={{ flex: 1, minWidth: '200px', padding: '0.75rem' }}
        >
          Generate Another
        </button>
      </div>
    </div>
  );
}
