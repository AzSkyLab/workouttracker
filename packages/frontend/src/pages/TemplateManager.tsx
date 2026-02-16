import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { templateAPI } from '../services/api';
import { WorkoutTemplate, ExerciseType } from '@workout-tracker/shared';
import ConfirmModal from '../components/ConfirmModal';

export default function TemplateManager() {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await templateAPI.getAll();
      setTemplates(response.data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setTemplateToDelete({ id, name });
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;

    try {
      await templateAPI.delete(templateToDelete.id);
      setTemplates(templates.filter((t) => t.id !== templateToDelete.id));
      setDeleteModalOpen(false);
      setTemplateToDelete(null);
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setTemplateToDelete(null);
  };

  const getTemplateIcon = (template: WorkoutTemplate): string => {
    if (!template.templateExercises || template.templateExercises.length === 0) {
      return '💪'; // Default to strength if no exercises
    }

    const exerciseTypes = template.templateExercises
      .map(te => te.exercise?.type)
      .filter(Boolean);

    const hasStrength = exerciseTypes.some(type => type === ExerciseType.STRENGTH);
    const hasCardio = exerciseTypes.some(type => type === ExerciseType.CARDIO);

    if (hasCardio && !hasStrength) {
      return '🏃'; // Cardio only
    } else if (hasStrength && !hasCardio) {
      return '💪'; // Strength only
    } else {
      return '🏋️'; // Mixed
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px'
      }}>
        <div style={{ fontSize: '1.125rem', color: 'var(--text-secondary)' }}>
          Loading templates...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Workout Templates
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Create reusable workout plans to use in your schedule
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/ai-plan')}
            className="btn btn-outline"
            style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}
          >
            AI Generate Plan
          </button>
          <button
            onClick={() => navigate('/templates/new')}
            className="btn btn-primary"
            style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}
          >
            + Create Template
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="card" style={{
          textAlign: 'center',
          padding: '4rem 2rem'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            No Templates Yet
          </h2>
          <p style={{
            color: 'var(--text-secondary)',
            marginBottom: '2rem',
            maxWidth: '500px',
            margin: '0 auto 2rem'
          }}>
            Templates are reusable workout plans you can schedule throughout your week.
            Create your first template to get started!
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/templates/new')}
              className="btn btn-primary"
              style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
            >
              Create Your First Template
            </button>
            <button
              onClick={() => navigate('/ai-plan')}
              className="btn btn-outline"
              style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
            >
              AI Generate Plan
            </button>
          </div>
        </div>
      ) : (
        <div className="template-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          {templates.map((template) => (
            <div
              key={template.id}
              className="card"
              style={{
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '';
              }}
              onClick={() => navigate(`/templates/${template.id}/edit`)}
            >
              {/* Color Bar */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '6px',
                  backgroundColor: template.color || '#3b82f6',
                }}
              />

              {/* Content */}
              <div style={{ paddingTop: '0.5rem' }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  color: 'var(--text)'
                }}>
                  {template.name}
                </h3>

                {template.description && (
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1rem',
                    lineHeight: 1.5
                  }}>
                    {template.description}
                  </p>
                )}

                {/* Stats */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--background)',
                  borderRadius: '0.375rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{getTemplateIcon(template)}</span>
                    <span style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text)'
                    }}>
                      {template.templateExercises?.length || 0}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      exercises
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--border)'
                }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/templates/${template.id}/edit`);
                    }}
                    className="btn btn-outline"
                    style={{ flex: 1, fontSize: '0.875rem' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(template.id, template.name);
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid var(--danger)',
                      borderRadius: '0.375rem',
                      backgroundColor: 'transparent',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--danger)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--danger)';
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Template"
        message={`Are you sure you want to delete "${templateToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        danger={true}
      />
    </div>
  );
}
