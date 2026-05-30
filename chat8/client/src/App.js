import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Auth from './Auth';
import axios from 'axios';

const socket = io('http://localhost:5000');

function App() {
  const [token, setToken] = useState(localStorage.getItem('chat8_token') || '');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('chat8_user')) || null;
    } catch {
      return null;
    }
  });
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!token) return;
    // Fetch message history
    axios.get('/api/chat/messages/global', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setMessages(res.data.map(m => ({ ...m, sender: m.sender?.username || 'anon' })))))
      .catch(() => setMessages([]));
  }, [token]);

  useEffect(() => {
    socket.on('chatMessage', (data) => {
      setMessages((prev) => [...prev, data]);
    });
    return () => socket.off('chatMessage');
  }, []);

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && token) {
      socket.emit('chatMessage', { room: 'global', text: message, token });
      setMessage('');
    }
  };

  if (!token || !user) return <Auth setToken={setToken} setUser={setUser} />;

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>chat8 - Global Room</h2>
      <div style={{ minHeight: 200, marginBottom: 16 }}>
        {messages.map((msg, idx) => (
          <div key={idx}><b>{msg.sender}:</b> {msg.text}</div>
        ))}
      </div>
      <form onSubmit={sendMessage}>
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Type a message..."
          style={{ width: '80%', padding: 8 }}
        />
        <button type="submit" style={{ padding: 8, marginLeft: 8 }}>Send</button>
      </form>
      <div style={{ marginTop: 16 }}>
        <button onClick={() => { setToken(''); setUser(null); localStorage.removeItem('chat8_token'); localStorage.removeItem('chat8_user'); }}>Logout</button>
      </div>
    </div>
  );
}

export default App;
