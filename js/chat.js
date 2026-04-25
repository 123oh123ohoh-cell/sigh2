
// OwnsHub Real-Time Chat Client
// Assumes user is logged in and localStorage has 'loggedInUser' and 'token'

const socket = io('https://ownshub.onrender.com', { transports: ['websocket'] });
const myUsername = localStorage.getItem('loggedInUser');
const token = localStorage.getItem('token');

// Parse ?user=username from URL
function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

let currentChatUser = null;

// Join your own room for private messages
if (myUsername) socket.emit('join', myUsername);





let allUsers = [];
let onlineUsers = new Set();
let userSearch = '';
let userStatus = {};
// Unread message count per user (username: count)
let unreadCounts = JSON.parse(localStorage.getItem('chatUnreadCounts') || '{}');

function getStatusDot(status) {
  if (status === 'online') return '#4caf50';
  if (status === 'dnd') return '#ff416c';
  if (status === 'away') return '#ffc107';
  return '#888';
}

function renderUserList() {
  const userList = document.getElementById('userList');
  userList.innerHTML = '';
  let filtered = allUsers.filter(u => u.username !== myUsername);
  if (userSearch.startsWith('@')) {
    const searchTerm = userSearch.slice(1).toLowerCase();
    filtered = filtered.filter(u =>
      u.username.toLowerCase().includes(searchTerm) ||
      (u.displayName && u.displayName.toLowerCase().includes(searchTerm))
    );
  } else if (userSearch.length === 0) {
    // Show all users if nothing is typed
  } else {
    filtered = [];
  }
  filtered.forEach(u => {
    const li = document.createElement('li');
    // Avatar
    const avatar = document.createElement('img');
    avatar.src = u.avatar;
    avatar.alt = u.username + ' avatar';
    avatar.className = 'avatar';
    li.appendChild(avatar);
    // User info block
    const infoDiv = document.createElement('div');
    infoDiv.style.display = 'flex';
    infoDiv.style.flexDirection = 'column';
    // Display name
    const displayNameSpan = document.createElement('span');
    displayNameSpan.textContent = u.displayName;
    displayNameSpan.style.fontWeight = 'bold';
    infoDiv.appendChild(displayNameSpan);
    // Username (smaller)
    const usernameSpan = document.createElement('span');
    usernameSpan.textContent = '@' + u.username;
    usernameSpan.style.fontSize = '0.92em';
    usernameSpan.style.color = '#aaa';
    infoDiv.appendChild(usernameSpan);
    li.appendChild(infoDiv);
    // Unread badge
    if (unreadCounts[u.username] && unreadCounts[u.username] > 0) {
      const badge = document.createElement('span');
      badge.textContent = unreadCounts[u.username];
      badge.style.background = '#ff416c';
      badge.style.color = '#fff';
      badge.style.fontSize = '0.85em';
      badge.style.fontWeight = 'bold';
      badge.style.borderRadius = '12px';
      badge.style.padding = '2px 8px';
      badge.style.marginLeft = '8px';
      badge.style.alignSelf = 'flex-start';
      li.appendChild(badge);
    }
    // Status dot
    const dot = document.createElement('span');
    dot.style.display = 'inline-block';
    dot.style.width = '10px';
    dot.style.height = '10px';
    dot.style.borderRadius = '50%';
    dot.style.marginLeft = 'auto';
    dot.style.background = getStatusDot(userStatus[u.username] || (onlineUsers.has(u.username) ? 'online' : 'offline'));
    li.appendChild(dot);
    li.onclick = () => selectUser(u.username, li);
    userList.appendChild(li);
  });
}

// Real-time search
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('userSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      userSearch = searchInput.value;
      renderUserList();
    });
  }
});




fetch('https://ownshub.onrender.com/api/users')
  .then(res => res.json())
  .then(users => {
    allUsers = users;
    renderUserList();
    // Auto-select user if ?user=username is present
    const preselectUser = getQueryParam('user');
    if (preselectUser && preselectUser !== myUsername) {
      userSearch = '';
      renderUserList();
      function trySelect() {
        const userList = document.getElementById('userList');
        const lis = Array.from(userList.children);
        // Find the correct li by username (not displayName, which may not be unique)
        const li = lis.find(li => {
          const usernameSpan = li.querySelector('span:nth-child(2)');
          return usernameSpan && usernameSpan.textContent === '@' + preselectUser;
        });
        if (li) {
          selectUser(preselectUser, li);
          li.scrollIntoView({ block: 'center' });
          setTimeout(() => {
            const input = document.getElementById('chatInput');
            if (input) input.focus();
          }, 100);
        } else {
          // If user is not in the list (e.g. not followed), still allow direct chat
          // Fallback: create a dummy li for direct chat
          const userObj = allUsers.find(u => u.username === preselectUser) || { username: preselectUser, displayName: preselectUser };
          const dummyLi = document.createElement('li');
          dummyLi.style.display = 'none';
          selectUser(preselectUser, dummyLi);
          setTimeout(() => {
            const input = document.getElementById('chatInput');
            if (input) input.focus();
          }, 100);
        }
      }
      trySelect();
    }
  });


// Listen for online users and status from Socket.io
socket.on('online_users', function(list) {
  onlineUsers = new Set(list);
  renderUserList();
});
socket.on('user_status', function(statusObj) {
  userStatus = statusObj;
  renderUserList();
});
socket.emit('get_online_users');
// Status selector logic
document.addEventListener('DOMContentLoaded', function() {
  const statusSelect = document.getElementById('statusSelect');
  if (statusSelect) {
    // Set initial value
    statusSelect.value = userStatus[myUsername] || 'online';
    statusSelect.onchange = function() {
      const status = statusSelect.value;
      socket.emit('set_status', { username: myUsername, status });
    };
  }
});

function selectUser(username, liElem) {
  currentChatUser = username;
  // Find user object
  const userObj = allUsers.find(u => u.username === username);
  let headerText = userObj ? `${userObj.displayName} (@${userObj.username})` : username;
  document.getElementById('chatHeader').textContent = headerText;
  // Highlight selected user
  document.querySelectorAll('.user-list li').forEach(li => li.classList.remove('active'));
  liElem.classList.add('active');
  // Reset unread count for this user
  if (unreadCounts[username]) {
    unreadCounts[username] = 0;
    localStorage.setItem('chatUnreadCounts', JSON.stringify(unreadCounts));
    renderUserList();
  }
  // Show chat input, hide welcome
  if (window.showChatInput) window.showChatInput();
  // Clear messages area
  document.getElementById('messagesArea').innerHTML = '';
  // Fetch chat history
  fetch(`https://ownshub.onrender.com/api/messages?user=${encodeURIComponent(username)}`, {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(res => res.json())
    .then(messages => {
      if (messages.length === 0) {
        document.getElementById('messagesArea').innerHTML = '<div style="color:var(--text-gray);text-align:center;margin-top:40px;">No messages yet. Say hi!</div>';
      } else {
        messages.forEach(msg => appendMessage(msg, msg.sender === myUsername));
        scrollMessagesToBottom();
      }
    });
}


// Send message
function sendMessage() {
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content || !currentChatUser) return;
  const msg = {
    sender: myUsername,
    receiver: currentChatUser,
    content,
    timestamp: new Date().toISOString()
  };
  socket.emit('private_message', msg);
  appendMessage(msg, true);
  input.value = '';
  scrollMessagesToBottom();
}

// If no user selected, show welcome
if (!currentChatUser && window.showChatWelcome) window.showChatWelcome();


document.getElementById('sendBtn').onclick = sendMessage;
// Typing indicator logic
let typingTimeout = null;
const chatInput = document.getElementById('chatInput');
chatInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') sendMessage();
  else {
    // Emit typing event
    if (currentChatUser) {
      socket.emit('typing', { to: currentChatUser, from: myUsername });
    }
  }
});

// Show typing indicator
let typingIndicatorTimeout = null;
function showTypingIndicator(user) {
  let indicator = document.getElementById('typingIndicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'typingIndicator';
    indicator.style.color = '#aaa';
    indicator.style.fontSize = '0.98em';
    indicator.style.margin = '8px 0 0 12px';
    document.getElementById('messagesArea').appendChild(indicator);
  }
  indicator.textContent = `${user} is typing...`;
  indicator.style.display = 'block';
  if (typingIndicatorTimeout) clearTimeout(typingIndicatorTimeout);
  typingIndicatorTimeout = setTimeout(() => {
    indicator.style.display = 'none';
  }, 2000);
}

// Typing event from socket
socket.on('typing', function(data) {
  // Only show if this is the current chat
  if (data.from === currentChatUser) {
    showTypingIndicator(data.from);
  }
});

// Receive real-time message

socket.on('private_message', function(msg) {
  // If chat is open with this user, show message
  if (msg.sender === currentChatUser || (msg.sender === myUsername && msg.receiver === currentChatUser)) {
    appendMessage(msg, msg.sender === myUsername);
    scrollMessagesToBottom();
  } else if (msg.receiver === myUsername) {
    // If message is for me and chat is not open, increment unread count
    unreadCounts[msg.sender] = (unreadCounts[msg.sender] || 0) + 1;
    localStorage.setItem('chatUnreadCounts', JSON.stringify(unreadCounts));
    renderUserList();
  }
});

function appendMessage(msg, isMine) {
  const div = document.createElement('div');
  div.className = 'message' + (isMine ? ' me' : '');
  div.innerHTML = `<div class="bubble">${msg.content}</div><div class="meta">${isMine ? 'You' : msg.sender} • ${new Date(msg.timestamp).toLocaleTimeString()}</div>`;
  document.getElementById('messagesArea').appendChild(div);
}

function scrollMessagesToBottom() {
  const area = document.getElementById('messagesArea');
  area.scrollTop = area.scrollHeight;
}
