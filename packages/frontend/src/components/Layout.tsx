import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import UserProfileModal from './UserProfileModal';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const linkStyle = (path: string, exact = true) => ({
    color: (exact ? location.pathname === path : location.pathname.startsWith(path))
      ? 'var(--primary)' : 'var(--text)',
    textDecoration: 'none',
    fontWeight: 500,
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="nav-bar" style={{
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '1rem 0',
      }}>
        <div className="container nav-top" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0 : '2rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
              Workout Tracker<sup style={{ fontSize: '0.5rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>{__APP_VERSION__}</sup>
            </h1>
            {!isMobile && (
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <Link to="/dashboard" style={linkStyle('/dashboard')}>Dashboard</Link>
                <Link to="/templates" style={linkStyle('/templates', false)}>Templates</Link>
                <Link to="/exercises" style={linkStyle('/exercises', false)}>Exercises</Link>
                <Link to="/schedule" style={linkStyle('/schedule')}>Schedule</Link>
                <Link to="/progress" style={linkStyle('/progress')}>Progress</Link>
                <Link to="/history" style={linkStyle('/history')}>History</Link>
                {user?.role === 'ADMIN' && (
                  <Link to="/admin" style={linkStyle('/admin', false)}>Users</Link>
                )}
              </div>
            )}
          </div>

          {!isMobile && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {user?.firstName} {user?.lastName}
                {user?.role === 'ADMIN' && <span style={{ color: 'var(--primary)', marginLeft: '0.5rem' }}>(Admin)</span>}
              </span>
              <button
                onClick={() => setProfileModalOpen(true)}
                className="btn btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                Profile
              </button>
              <button onClick={handleLogout} className="btn btn-outline">
                Logout
              </button>
            </div>
          )}

          {isMobile && (
            <button
              className="hamburger-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? '\u2715' : '\u2630'}
            </button>
          )}
        </div>

        {/* Mobile dropdown */}
        {isMobile && (
          <div className="container">
            <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
              <Link to="/dashboard" style={linkStyle('/dashboard')}>Dashboard</Link>
              <Link to="/templates" style={linkStyle('/templates', false)}>Templates</Link>
              <Link to="/exercises" style={linkStyle('/exercises', false)}>Exercises</Link>
              <Link to="/schedule" style={linkStyle('/schedule')}>Schedule</Link>
              <Link to="/progress" style={linkStyle('/progress')}>Progress</Link>
              <Link to="/history" style={linkStyle('/history')}>History</Link>
              {user?.role === 'ADMIN' && (
                <Link to="/admin" style={linkStyle('/admin', false)}>Users</Link>
              )}
            </div>
            <div className={`nav-user ${menuOpen ? 'open' : ''}`}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {user?.firstName} {user?.lastName}
                {user?.role === 'ADMIN' && <span style={{ color: 'var(--primary)', marginLeft: '0.5rem' }}>(Admin)</span>}
              </span>
              <button
                onClick={() => setProfileModalOpen(true)}
                className="btn btn-outline"
              >
                Profile
              </button>
              <button onClick={handleLogout} className="btn btn-outline">
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      <main style={{ flex: 1, padding: isMobile ? '1rem 0' : '2rem 0' }}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  );
}
