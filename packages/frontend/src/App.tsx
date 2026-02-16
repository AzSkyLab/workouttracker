import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { WorkoutProvider } from './contexts/WorkoutContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import ActiveWorkout from './pages/ActiveWorkout'
import WorkoutHistory from './pages/WorkoutHistory'
import WorkoutDetail from './pages/WorkoutDetail'
import TemplateManager from './pages/TemplateManager'
import TemplateForm from './pages/TemplateForm'
import ExerciseManager from './pages/ExerciseManager'
import ExerciseForm from './pages/ExerciseForm'
import AdminPanel from './pages/AdminPanel'
import AdminExerciseForm from './pages/AdminExerciseForm'
import Schedule from './pages/Schedule'
import ProgressCharts from './pages/ProgressCharts'
import AiPlanGenerator from './pages/AiPlanGenerator'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

function App() {
  return (
    <AuthProvider>
      <WorkoutProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/workout/:id" element={<ActiveWorkout />} />
                <Route path="/workout/:id/details" element={<WorkoutDetail />} />
                <Route path="/workouts/:id" element={<WorkoutDetail />} />
                <Route path="/history" element={<WorkoutHistory />} />
                <Route path="/templates" element={<TemplateManager />} />
                <Route path="/templates/new" element={<TemplateForm />} />
                <Route path="/templates/:id/edit" element={<TemplateForm />} />
                <Route path="/ai-plan" element={<AiPlanGenerator />} />
                <Route path="/exercises" element={<ExerciseManager />} />
                <Route path="/exercises/new" element={<ExerciseForm />} />
                <Route path="/exercises/:id/edit" element={<ExerciseForm />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/admin/exercises/new" element={<AdminExerciseForm />} />
                <Route path="/admin/exercises/:id/edit" element={<AdminExerciseForm />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/progress" element={<ProgressCharts />} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </WorkoutProvider>
    </AuthProvider>
  )
}

export default App
