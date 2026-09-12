import React, { useState, useEffect, useRef } from 'react';
import { Lock, User, ShieldCheck, Eye, EyeOff, ArrowRight, MoreVertical, AlertTriangle } from 'lucide-react';

/* ===== Animated Background ===== */
function ParticleCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let particles = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.2 + 0.4,
        o: Math.random() * 0.4 + 0.08,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${p.o})`;
        ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.04 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="login-particles" />;
}

export function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showDots, setShowDots] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const parseJwt = (token) => {
    try {
      return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (e) {
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (username.trim() === '' || password.trim() === '') {
      setError('Please enter both Officer ID and password.');
      return;
    }
    
    if (isSignUp && fullName.trim() === '') {
      setError('Please enter your full name for registration.');
      return;
    }

    setIsLoading(true);
    
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
      
      if (isSignUp) {
        // Sign-up flow
        const response = await fetch(`${API_URL}/api/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, name: fullName }),
        });
        
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Registration failed');
        }
        
        // After successful sign-up, automatically log them in
      }

      // Login flow (runs for both Login, and automatically after a successful Sign-Up)
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const loginResponse = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (!loginResponse.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await loginResponse.json();
      const token = data.access_token;
      localStorage.setItem('token', token);
      
      const payload = parseJwt(token) || {};
      const userData = {
        username: payload.sub || username,
        name: payload.name || fullName || 'Officer',
        role: payload.role || 'Officer',
        avatar: 'https://i.pravatar.cc/150?u=' + (payload.sub || 'sharma'),
      };
      localStorage.setItem('user_data', JSON.stringify(userData));
      onLogin(userData);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`login-page login-centered ${mounted ? 'login-page--visible' : ''}`}>
      <ParticleCanvas />

      {/* Centered Login Card */}
      <div className="login-center-wrapper">
        <div className="login-card">
          {/* Top bar: Icon centered, 3 dots on right */}
          <div className="login-topbar">
            <div style={{ width: 32 }} /> {/* spacer for centering */}
            <div className="login-topbar-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="login-dots-wrapper">
              <button className="login-dots-btn" onClick={() => setShowDots(p => !p)} aria-label="More options">
                <MoreVertical size={18} />
              </button>
              {showDots && (
                <>
                  <div className="login-dots-backdrop" onClick={() => setShowDots(false)} />
                  <div className="login-dots-menu">
                    <button className="login-dots-item" onClick={() => { setShowDots(false); alert('Contact Admin: admin@sih26025.gov.in'); }}>
                      Contact Admin
                    </button>
                    <button className="login-dots-item" onClick={() => { setShowDots(false); alert('SWARN v1.0.0 — AI Powered Adaptive Mine Subsidence Monitoring Framework'); }}>
                      About
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Header */}
          <div className="login-card-header">
            <div className="login-shield">
              <svg viewBox="0 0 40 40" width="32" height="32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 3L5 10v10c0 9.5 6.4 18.4 15 20.5 8.6-2.1 15-11 15-20.5V10L20 3z" 
                  fill="url(#loginShieldGrad)" stroke="rgba(6,182,212,0.4)" strokeWidth="0.8"/>
                <path d="M10 22 L14 22 L16 16 L18 28 L20 14 L22 26 L24 18 L26 22 L30 22" 
                  stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M16 32 L20 28 L24 32" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeLinecap="round" fill="none"/>
                <path d="M17 11a4 4 0 016 0" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" fill="none"/>
                <path d="M15 9a7 7 0 0110 0" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" fill="none"/>
                <circle cx="20" cy="13" r="1.2" fill="white"/>
                <defs>
                  <linearGradient id="loginShieldGrad" x1="5" y1="3" x2="35" y2="40" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="rgba(59,130,246,0.3)"/>
                    <stop offset="100%" stopColor="rgba(6,182,212,0.2)"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h2>{isSignUp ? 'Officer Registration' : 'SWARN'}</h2>
            <p className="login-subtitle">AI Powered Adaptive Mine Subsidence Monitoring Framework</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="login-error">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            {isSignUp && (
              <div className="login-field">
                <label htmlFor="full-name">Full Name</label>
                <div className="login-input-wrap">
                  <User size={16} className="login-input-icon" />
                  <input
                    id="full-name"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); setError(''); }}
                    autoComplete="name"
                    autoFocus={isSignUp}
                  />
                </div>
              </div>
            )}

            <div className="login-field">
              <label htmlFor="officer-id">Officer ID</label>
              <div className="login-input-wrap">
                <User size={16} className="login-input-icon" />
                <input
                  id="officer-id"
                  type="text"
                  placeholder="Enter your officer ID"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className="login-input-wrap">
                <Lock size={16} className="login-input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword(p => !p)}
                  tabIndex={-1}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="login-forgot-row">
              <button type="button" className="login-forgot-btn" onClick={() => setShowForgot(true)}>
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              className={`login-submit ${isLoading ? 'loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="login-spinner" />
              ) : (
                <>
                  {isSignUp ? 'Register & Enter' : 'Authenticate & Enter'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            
            <div className="login-toggle-mode" style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button 
                type="button" 
                style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.85rem' }}
                onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              >
                {isSignUp ? "Already have an account? Log In" : "Don't have an account? Sign Up"}
              </button>
            </div>
          </form>

          <div className="login-card-footer">
            <div className="login-footer-line" />
            <span>Restricted Access · Authorized Personnel Only</span>
            <div className="login-footer-line" />
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="modal-overlay" onClick={() => setShowForgot(false)}>
          <div className="login-forgot-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reset Password</h3>
            <p>Contact your system administrator to reset your password.</p>
            <div className="login-forgot-contact">
              <span>📧 admin@sih26025.gov.in</span>
              <span>📞 +91-XXXX-XXXXXX</span>
            </div>
            <button className="login-submit" style={{ marginTop: 16 }} onClick={() => setShowForgot(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
