import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChefHat, Lock, User } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await login(username, password);
      if (user.role === 'owner') {
        navigate('/owner');
      } else if (user.role === 'kitchen') {
        navigate('/kitchen');
      } else {
        navigate('/waiter');
      }
    } catch (err) {
      setError('Invalid username or password');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '16px', borderRadius: '50%' }}>
            <ChefHat size={48} color="#3b82f6" />
          </div>
        </div>
        
        <h2 style={{ marginBottom: '8px', fontSize: '24px', fontWeight: 'bold' }}>Staff Login</h2>
        <p style={{ color: '#94a3b8', marginBottom: '32px' }}>Enter your credentials to access the dashboard</p>

        {error && <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative' }}>
            <User size={20} style={{ position: 'absolute', left: '16px', top: '14px', color: '#64748b' }} />
            <input 
              type="text" 
              className="modern-input" 
              placeholder="Username" 
              style={{ paddingLeft: '48px' }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Lock size={20} style={{ position: 'absolute', left: '16px', top: '14px', color: '#64748b' }} />
            <input 
              type="password" 
              className="modern-input" 
              placeholder="Password" 
              style={{ paddingLeft: '48px' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="modern-button" style={{ marginTop: '16px' }}>
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
