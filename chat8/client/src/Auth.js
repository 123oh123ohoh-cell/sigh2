import React, { useState } from 'react';
import axios from 'axios';

export default function Auth({ setToken, setUser }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const url = `/api/auth/${mode}`;
      const { data } = await axios.post(url, { username, password });
      if (data.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('chat8_token', data.token);
        localStorage.setItem('chat8_user', JSON.stringify(data.user));
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Error');
    }
  };

  return (
    <div style={{ maxWidth: 340, margin: '60px auto', padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>
      <form onSubmit={handleSubmit}>
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" required style={{ width: '100%', marginBottom: 8, padding: 8 }} />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" required style={{ width: '100%', marginBottom: 8, padding: 8 }} />
        <button type="submit" style={{ width: '100%', padding: 8 }}>{mode === 'login' ? 'Login' : 'Register'}</button>
      </form>
      <div style={{ marginTop: 10 }}>
        <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer' }}>
          {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
        </button>
      </div>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  );
}
