// ─── GROUP MANAGEMENT ──────────────────────────────────────
let allGroups = [];
let currentGroup = null;

async function fetchGroupsUniversal() {
  // Try backend
  let groups = [];
  try {
    let res = await fetch(`${CHAT_SERVER_URL}/api/groups`, {
      headers: { 'Authorization': token ? 'Bearer ' + token : '' }
    });
    if (res.ok) groups = await res.json();
  } catch (e) {}
  // Merge with localStorage
  let localGroups = JSON.parse(localStorage.getItem(`chatGroups_${myUsername}`) || '[]');
  let all = [...groups, ...localGroups];
  let seen = new Set();
  let merged = all.filter(g => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });
  allGroups = merged;
  localStorage.setItem(`chatGroups_${myUsername}`, JSON.stringify(merged));
  renderGroupList();
}

function renderGroupList() {
  const groupList = document.getElementById('groupList');
  if (!groupList) return;
  groupList.innerHTML = '';
  allGroups.forEach(g => {
    const li = document.createElement('li');
    li.textContent = g.name;
    li.onclick = () => selectGroupUniversal(g.id);
    if (currentGroup && currentGroup.id === g.id) li.classList.add('active');
    groupList.appendChild(li);
  });
}

async function createGroupUniversal() {
  const name = document.getElementById('newGroupName').value.trim();
  if (!name) return;
  let group = { id: 'g_' + Date.now(), name, members: [myUsername] };
  // Save to localStorage
  let localGroups = JSON.parse(localStorage.getItem(`chatGroups_${myUsername}`) || '[]');
  localGroups.push(group);
  localStorage.setItem(`chatGroups_${myUsername}`, JSON.stringify(localGroups));
  // Try backend
  try {
    await fetch(`${CHAT_SERVER_URL}/api/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify(group)
    });
  } catch (e) {}
  // Emit via Socket.io
  if (socket && socket.connected) {
    socket.emit('group_create', group);
  }
  fetchGroupsUniversal();
}

async function selectGroupUniversal(groupId) {
  currentGroup = allGroups.find(g => g.id === groupId);
  currentChatUser = null;
  renderGroupList();
  // Show chat panels
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('chatHeader').style.display = 'flex';
  document.getElementById('messagesArea').style.display = 'flex';
  document.getElementById('chatInputArea').style.display = 'block';
  document.getElementById('chatHeaderName').textContent = currentGroup ? currentGroup.name : '—';
  document.getElementById('chatHeaderAvatar').style.display = 'none';
  document.getElementById('chatHeaderStatus').textContent = 'Group';
  // Load group messages
  const area = document.getElementById('messagesArea');
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(currentGroup.id, true);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
    scrollToBottom();
  }
}

// Group message send override
const origSendMessageGroup = sendMessage;
sendMessage = function() {
  if (currentGroup) {
    const input = document.getElementById('chatInput');
    const content = input ? input.value.trim() : '';
    if (!content && !pendingImageDataUrl && !pendingFileData) return;
    const msg = {
      sender: myUsername,
      group: currentGroup.id,
      content: content || '',
      image: pendingImageDataUrl || null,
      file: pendingFileData && pendingFileName ? { name: pendingFileName, data: pendingFileData } : undefined,
      timestamp: new Date().toISOString()
    };
    sendMessageUniversal(msg);
    appendMessage(msg, true);
    if (input) input.value = '';
    clearFilePreview && clearFilePreview();
    clearImagePreview && clearImagePreview();
    scrollToBottom();
    autoResizeTextarea && autoResizeTextarea();
  } else {
    origSendMessageGroup();
  }
};

// Group create button event
window.addEventListener('DOMContentLoaded', () => {
  const createBtn = document.getElementById('createGroupBtn');
  if (createBtn) createBtn.onclick = createGroupUniversal;
  fetchGroupsUniversal();
});
// Universal sync for message edits
async function editMessageUniversal(msg) {
  const newText = prompt('Edit your message:', msg.content);
  if (newText === null || newText === msg.content) return;
  msg.content = newText;
  msg.edited = true;
  // Save to localStorage
  let chatId = msg.receiver || msg.group;
  let localKey = `chatHistory_${myUsername}_${chatId}`;
  let msgs = JSON.parse(localStorage.getItem(localKey) || '[]');
  let idx = msgs.findIndex(m => m.timestamp === msg.timestamp && m.sender === msg.sender);
  if (idx !== -1) {
    msgs[idx] = msg;
    localStorage.setItem(localKey, JSON.stringify(msgs));
  }
  // Try backend
  try {
    await fetch(`${CHAT_SERVER_URL}/api/messages/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify({ chatId, timestamp: msg.timestamp, sender: msg.sender, content: newText })
    });
  } catch (e) {}
  // Emit via Socket.io
  if (socket && socket.connected) {
    socket.emit('message_edit', { chatId, timestamp: msg.timestamp, sender: msg.sender, content: newText });
  }
  // Update UI
  setTimeout(() => {
    const area = document.getElementById('messagesArea');
    if (!area) return;
    area.innerHTML = '';
    fetchMessagesUniversal(chatId, !!msg.group).then(msgs => {
      msgs.forEach(m => appendMessage(m, m.sender === myUsername));
      scrollToBottom();
    });
  }, 100);
}

// Universal sync for message deletions
async function deleteMessageUniversal(msg) {
  if (!confirm('Delete this message?')) return;
  let chatId = msg.receiver || msg.group;
  let localKey = `chatHistory_${myUsername}_${chatId}`;
  let msgs = JSON.parse(localStorage.getItem(localKey) || '[]');
  msgs = msgs.filter(m => !(m.timestamp === msg.timestamp && m.sender === msg.sender));
  localStorage.setItem(localKey, JSON.stringify(msgs));
  // Try backend
  try {
    await fetch(`${CHAT_SERVER_URL}/api/messages/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify({ chatId, timestamp: msg.timestamp, sender: msg.sender })
    });
  } catch (e) {}
  // Emit via Socket.io
  if (socket && socket.connected) {
    socket.emit('message_delete', { chatId, timestamp: msg.timestamp, sender: msg.sender });
  }
  // Update UI
  setTimeout(() => {
    const area = document.getElementById('messagesArea');
    if (!area) return;
    area.innerHTML = '';
    fetchMessagesUniversal(chatId, !!msg.group).then(msgs => {
      msgs.forEach(m => appendMessage(m, m.sender === myUsername));
      scrollToBottom();
    });
  }, 100);
}

// Socket.io handlers for real-time edits and deletions
if (socket) {
  socket.on('message_edit', data => {
    let chatId = data.chatId;
    let localKey = `chatHistory_${myUsername}_${chatId}`;
    let msgs = JSON.parse(localStorage.getItem(localKey) || '[]');
    let idx = msgs.findIndex(m => m.timestamp === data.timestamp && m.sender === data.sender);
    if (idx !== -1) {
      msgs[idx].content = data.content;
      msgs[idx].edited = true;
      localStorage.setItem(localKey, JSON.stringify(msgs));
      const area = document.getElementById('messagesArea');
      if (area) {
        area.innerHTML = '';
        fetchMessagesUniversal(chatId, !!msgs[idx].group).then(msgs2 => {
          msgs2.forEach(m => appendMessage(m, m.sender === myUsername));
          scrollToBottom();
        });
      }
    }
  });
  socket.on('message_delete', data => {
    let chatId = data.chatId;
    let localKey = `chatHistory_${myUsername}_${chatId}`;
    let msgs = JSON.parse(localStorage.getItem(localKey) || '[]');
    msgs = msgs.filter(m => !(m.timestamp === data.timestamp && m.sender === data.sender));
    localStorage.setItem(localKey, JSON.stringify(msgs));
    const area = document.getElementById('messagesArea');
    if (area) {
      area.innerHTML = '';
      fetchMessagesUniversal(chatId, false).then(msgs2 => {
        msgs2.forEach(m => appendMessage(m, m.sender === myUsername));
        scrollToBottom();
      });
    }
  });
}
// Block/mute button event handlers
window.addEventListener('DOMContentLoaded', () => {
  const blockBtn = document.getElementById('blockUserBtn');
  const muteBtn = document.getElementById('muteUserBtn');
  if (blockBtn) {
    blockBtn.onclick = async () => {
      if (currentChatUser) {
        await blockUserUniversal(currentChatUser);
        blockBtn.textContent = '🚫 Blocked';
        blockBtn.disabled = true;
      }
    };
  }
  if (muteBtn) {
    muteBtn.onclick = async () => {
      if (currentChatUser) {
        await muteUserUniversal(currentChatUser);
        muteBtn.textContent = '🔇 Muted';
        muteBtn.disabled = true;
      }
    };
  }
});
// --- Universal block/mute sync (backend + localStorage + Socket.io) ---
async function blockUserUniversal(username) {
  let localKey = `chatBlocks_${myUsername}`; // Ensure localKey is defined
  let blocks = JSON.parse(localStorage.getItem(localKey) || '[]');
  if (!blocks.includes(username)) blocks.push(username);
  localStorage.setItem(localKey, JSON.stringify(blocks));
  try {
    await fetch(`${CHAT_SERVER_URL}/api/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify({ user: myUsername, block: username })
    });
  } catch (e) {}
  if (socket && socket.connected) {
    socket.emit('block_user', { user: myUsername, block: username });
  }
}

async function muteUserUniversal(username) {
  let localKey = `chatMutes_${myUsername}`; // Ensure localKey is defined
  let mutes = JSON.parse(localStorage.getItem(localKey) || '[]');
  if (!mutes.includes(username)) mutes.push(username);
  localStorage.setItem(localKey, JSON.stringify(mutes));
  try {
    await fetch(`${CHAT_SERVER_URL}/api/mutes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify({ user: myUsername, mute: username })
    });
  } catch (e) {}
  if (socket && socket.connected) {
    socket.emit('mute_user', { user: myUsername, mute: username });
  }
}

async function fetchBlocksUniversal() {
  let localBlocks = JSON.parse(localStorage.getItem(`chatBlocks_${myUsername}`) || '[]');
  let backendBlocks = [];
  try {
    let res = await fetch(`${CHAT_SERVER_URL}/api/blocks?user=${encodeURIComponent(myUsername)}`, {
      headers: { 'Authorization': token ? 'Bearer ' + token : '' }
    });
    if (res.ok) backendBlocks = await res.json();
  } catch (e) {}
  let merged = Array.from(new Set([...localBlocks, ...backendBlocks]));
  localStorage.setItem(`chatBlocks_${myUsername}`, JSON.stringify(merged));
  return merged;
}

async function fetchMutesUniversal() {
  let localMutes = JSON.parse(localStorage.getItem(`chatMutes_${myUsername}`) || '[]');
  let backendMutes = [];
  try {
    let res = await fetch(`${CHAT_SERVER_URL}/api/mutes?user=${encodeURIComponent(myUsername)}`, {
      headers: { 'Authorization': token ? 'Bearer ' + token : '' }
    });
    if (res.ok) backendMutes = await res.json();
  } catch (e) {}
  let merged = Array.from(new Set([...localMutes, ...backendMutes]));
  localStorage.setItem(`chatMutes_${myUsername}`, JSON.stringify(merged));
  return merged;
}

if (typeof socket !== 'undefined' && socket) {
  socket.on('block_user', async ({ user, block }) => {
    if (user === myUsername) {
      let localKey = `chatBlocks_${myUsername}`;
      let blocks = JSON.parse(localStorage.getItem(localKey) || '[]');
      if (!blocks.includes(block)) {
        blocks.push(block);
        localStorage.setItem(localKey, JSON.stringify(blocks));
      }
    }
  });
  socket.on('mute_user', async ({ user, mute }) => {
    if (user === myUsername) {
      let localKey = `chatMutes_${myUsername}`;
      let mutes = JSON.parse(localStorage.getItem(localKey) || '[]');
      if (!mutes.includes(mute)) {
        mutes.push(mute);
        localStorage.setItem(localKey, JSON.stringify(mutes));
      }
    }
  });
}
// Render pins for a chat or group
async function renderPins(chatId, isGroup) {
  const pinsArea = document.getElementById('pinsArea');
  if (!pinsArea) return;
  let pins = await fetchPinsUniversal(chatId, isGroup);
  if (pins.length === 0) {
    pinsArea.style.display = 'none';
    pinsArea.innerHTML = '';
    return;
  }
  pinsArea.style.display = 'block';
  pinsArea.innerHTML = '<div class="pins-label">📌 Pinned</div>';
  pins.forEach(pin => {
    const div = document.createElement('div');
    div.className = 'pin-item';
    div.textContent = pin.content || '[Pinned message]';
    div.onclick = () => scrollToMessage(pin.messageId);
    pinsArea.appendChild(div);
  });
}

// Pin a message (UI handler)
async function handlePinMessage(messageObj, chatId, isGroup) {
  const pinObj = {
    messageId: messageObj.id || messageObj.timestamp,
    content: messageObj.content,
    sender: messageObj.sender,
    timestamp: new Date().toISOString()
  };
  await pinMessageUniversal(chatId, isGroup, pinObj);
  renderPins(chatId, isGroup);
}

// Scroll to pinned message
function scrollToMessage(messageId) {
  const msgElem = document.querySelector(`[data-message-id="${messageId}"]`);
  if (msgElem) {
    msgElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    msgElem.classList.add('highlight-pinned');
    setTimeout(() => msgElem.classList.remove('highlight-pinned'), 1500);
  }
}
// --- Universal pin sync (backend + localStorage + Socket.io) ---
async function pinMessageUniversal(chatId, isGroup, pinObj) {
  // Save to localStorage immediately for pinning messages
  let localKey = `chatPins_${myUsername}_${chatId}`;
  let pins = JSON.parse(localStorage.getItem(localKey) || '[]');
  pins.push(pinObj);
  localStorage.setItem(localKey, JSON.stringify(pins));

  // Try backend
  try {
    await fetch(`${CHAT_SERVER_URL}/api/pins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify({ chatId, isGroup, pin: pinObj })
    });
  } catch (e) {
    // If offline, keep in localStorage for later sync
  }
  // Emit via Socket.io for real-time update
  if (socket && socket.connected) {
    socket.emit('pin_message', { chatId, isGroup, pin: pinObj });
  }
}

async function fetchPinsUniversal(chatId, isGroup) {
  let localPins = JSON.parse(localStorage.getItem(`chatPins_${myUsername}_${chatId}`) || '[]');
  let backendPins = [];
  try {
    let res = await fetch(`${CHAT_SERVER_URL}/api/pins?chatId=${encodeURIComponent(chatId)}`, {
      headers: { 'Authorization': token ? 'Bearer ' + token : '' }
    });
    if (res.ok) backendPins = await res.json();
  } catch (e) {}
  // Merge and deduplicate by messageId
  let allPins = [...localPins, ...backendPins];
  let seen = new Set();
  let merged = allPins.filter(pin => {
    let key = pin.messageId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Sort by pin timestamp ascending
  merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  // Save merged pins back to localStorage
  localStorage.setItem(`chatPins_${myUsername}_${chatId}`, JSON.stringify(merged));
  return merged;
}

// Listen for pin events via Socket.io
if (typeof socket !== 'undefined' && socket) {
  socket.on('pin_message', async ({ chatId, isGroup, pin }) => {
    let localKey = `chatPins_${myUsername}_${chatId}`;
    let pins = JSON.parse(localStorage.getItem(localKey) || '[]');
    // Avoid duplicate pins
    if (!pins.some(p => p.messageId === pin.messageId)) {
      pins.push(pin);
      localStorage.setItem(localKey, JSON.stringify(pins));
    }
    // Optionally, update UI if viewing this chat
    if ((isGroup && currentGroup && currentGroup.id === chatId) || (!isGroup && currentChatUser === chatId)) {
      if (typeof renderPins === 'function') renderPins(chatId, isGroup);
    }
  });
}

// --- Universal message sync (backend + localStorage + Socket.io) ---
async function sendMessageUniversal(msg) {
  // Save to localStorage immediately for sending messages
  let localKey = `chatHistory_${myUsername}_${msg.receiver || msg.group}`;
  let msgs = JSON.parse(localStorage.getItem(localKey) || '[]');
  msgs.push(msg);
  localStorage.setItem(localKey, JSON.stringify(msgs));

  // Try backend
  try {
    await fetch(`${CHAT_SERVER_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify(msg)
    });
  } catch (e) {
    // If offline, keep in localStorage for later sync
  }
  // Emit via Socket.io for real-time update
  if (socket && socket.connected) {
    if (msg.group) socket.emit('group_message', msg);
    else socket.emit('private_message', msg);
  }
}

async function fetchMessagesUniversal(chatId, isGroup) {
  let localMsgs = JSON.parse(localStorage.getItem(`chatHistory_${myUsername}_${chatId}`) || '[]');
  let backendMsgs = [];
  try {
    let res = await fetch(`${CHAT_SERVER_URL}/api/messages?chatId=${encodeURIComponent(chatId)}`, {
      headers: { 'Authorization': token ? 'Bearer ' + token : '' }
    });
    if (res.ok) backendMsgs = await res.json();
  } catch (e) {}
  // Merge and deduplicate by timestamp+sender+content
  let allMsgs = [...localMsgs, ...backendMsgs];
  let seen = new Set();
  let merged = allMsgs.filter(msg => {
    let key = msg.timestamp + '|' + msg.sender + '|' + (msg.content || '') + '|' + (msg.image || '') + '|' + (msg.gif || '') + '|' + (msg.file ? msg.file.name : '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Sort by timestamp ascending
  merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  // Save merged history back to localStorage
  localStorage.setItem(`chatHistory_${myUsername}_${chatId}`, JSON.stringify(merged));
  return merged;
}

// Patch sendMessage to use universal sync
const origSendMessageUniversal = sendMessage;
sendMessage = function() {
  const input = document.getElementById('chatInput');
  const content = input ? input.value.trim() : '';
  if (!currentChatUser && !currentGroup) { showNotice('Select a user or group first.', 'var(--yellow)'); return; }
  if (!content && !pendingImageDataUrl && !pendingFileData) return;
  const msg = {
    sender: myUsername,
    receiver: currentChatUser,
    group: currentGroup ? currentGroup.id : undefined,
    content: content || '',
    image: pendingImageDataUrl || null,
    file: pendingFileData && pendingFileName ? { name: pendingFileName, data: pendingFileData } : undefined,
    timestamp: new Date().toISOString()
  };
  sendMessageUniversal(msg);
  appendMessage(msg, true);
  if (input) input.value = '';
  clearFilePreview && clearFilePreview();
  clearImagePreview && clearImagePreview();
  scrollToBottom();
  autoResizeTextarea && autoResizeTextarea();
};

// Patch selectUser/selectGroup to use universal fetch
const origSelectUserUniversal = selectUser;
selectUser = async function(username, liElem) {
  origSelectUserUniversal(username, liElem);
  const area = document.getElementById('messagesArea');
  if (!area) return;
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(username, false);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    // Show pins for this chat
    renderPins(username, false);
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
  }
};
const origSelectGroupUniversal = selectGroup;
selectGroup = async function(groupId) {
  origSelectGroupUniversal(groupId);
  const area = document.getElementById('messagesArea');
  if (!area || !currentGroup) return;
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(currentGroup.id, true);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    // Show pins for this group
    renderPins(currentGroup.id, true);
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
  }
};
// Patch appendMessage to add pin button and data-message-id
const origAppendMessage = typeof appendMessage === 'function' ? appendMessage : null;
function appendMessage(msg, isMine) {
  // Create message element
  const msgElem = document.createElement('div');
  msgElem.className = 'message' + (isMine ? ' mine' : '');
  msgElem.setAttribute('data-message-id', msg.id || msg.timestamp);
  // Message content

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  // Text content
  if (msg.content) {
    const text = document.createElement('span');
    text.textContent = msg.content;
    bubble.appendChild(text);
  }

  // Image attachment
  if (msg.image) {
    const img = document.createElement('img');
    img.className = 'msg-image';
    img.src = msg.image;
    img.alt = 'attachment';
    img.onclick = () => window.open(msg.image, '_blank');
    bubble.appendChild(img);
  }

  // GIF
  if (msg.gif) {
    const gif = document.createElement('img');
    gif.className = 'msg-gif';
    gif.src = msg.gif;
    gif.alt = 'GIF';
    bubble.appendChild(gif);
  }


  // Reaction button
  const reactBtn = document.createElement('button');
  reactBtn.className = 'react-btn';
  reactBtn.title = 'React';
  reactBtn.textContent = '😊';
  reactBtn.onclick = () => reactToMessageUniversal(msg);
  bubble.appendChild(reactBtn);

  // Edit button (only for own messages)
  if (isMine) {
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.title = 'Edit';
    editBtn.textContent = '✏️';
    editBtn.onclick = () => editMessageUniversal(msg);
    bubble.appendChild(editBtn);
    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.title = 'Delete';
    delBtn.textContent = '🗑️';
    delBtn.onclick = () => deleteMessageUniversal(msg);
    bubble.appendChild(delBtn);
  }

  // Reactions display
  const reactionsDiv = document.createElement('div');
  reactionsDiv.className = 'chat-message-reactions';
  if (msg.reactions && Array.isArray(msg.reactions) && msg.reactions.length > 0) {
    reactionsDiv.textContent = msg.reactions.map(r => `${r.emoji} ${r.user}`).join(' ');
  }
  bubble.appendChild(reactionsDiv);

  body.appendChild(bubble);
    groupList.appendChild(li);
    return;
  }
  allGroups.forEach(g => {
    const li = document.createElement('li');
    li.textContent = g.name;
    li.onclick = () => selectGroup(g.id);
    if (currentGroup && currentGroup.id === g.id) li.classList.add('active');
    groupList.appendChild(li);
  });
}

function selectGroup(groupId) {
  currentGroup = allGroups.find(g => g.id === groupId);
  currentChatUser = null;
  // Highlight
  document.querySelectorAll('#groupList li').forEach(li => li.classList.remove('active'));
  const idx = allGroups.findIndex(g => g.id === groupId);
  if (idx !== -1) document.querySelectorAll('#groupList li')[idx].classList.add('active');
  // Show chat panels
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('chatHeader').style.display = 'flex';
  document.getElementById('messagesArea').style.display = 'flex';
  document.getElementById('chatInputArea').style.display = 'block';
  // Update header
  document.getElementById('chatHeaderName').textContent = currentGroup ? currentGroup.name + ' (Group)' : '—';
  document.getElementById('chatHeaderAvatar').src = 'logos_and_profileicons/defaultpfp.webp';
  document.getElementById('chatHeaderAvatar').style.display = 'block';
  document.getElementById('chatHeaderStatus').textContent = currentGroup ? currentGroup.members.length + ' members' : '';
  document.getElementById('chatHeaderStatus').textContent = g.members.length + ' members';
  // TODO: Load and display group messages
  document.getElementById('messagesArea').innerHTML = '<div style="color:var(--text-muted);text-align:center;margin-top:40px;">Group chat coming soon…</div>';
}

document.getElementById('createGroupBtn').onclick = function() {
  const name = prompt('Group name?');
  if (!name) return;
  const id = 'group_' + Date.now();
  const group = { id, name, members: [myUsername] };
  allGroups.push(group);
  localStorage.setItem('allGroups_' + myUsername, JSON.stringify(allGroups));
  renderGroupList();
};

renderGroupList();
// --- Recent DMs tracking ---
async function getRecentDMs() {
  // Try backend, localhost, then localStorage, then merge all
  let local = JSON.parse(localStorage.getItem('recentDMs_' + myUsername) || '[]');
  let backend = [];
  let localhost = [];
  try {
    let res = await fetch(`${CHAT_SERVER_URL}/api/recent-dms?user=${encodeURIComponent(myUsername)}`, {
      headers: { 'Authorization': token ? 'Bearer ' + token : '' }
    });
    if (res.ok) backend = await res.json();
  } catch (e) {}
  if (!CHAT_SERVER_URL.includes('localhost')) {
    try {
      let res = await fetch(`http://localhost:3000/api/recent-dms?user=${encodeURIComponent(myUsername)}`, {
        headers: { 'Authorization': token ? 'Bearer ' + token : '' }
      });
      if (res.ok) localhost = await res.json();
    } catch (e) {}
  }
  // Merge and dedup
  let merged = [...new Set([...local, ...backend, ...localhost])];
  localStorage.setItem('recentDMs_' + myUsername, JSON.stringify(merged.slice(0, 30)));
  return merged.slice(0, 30);
}
async function saveRecentDMs(list) {
  localStorage.setItem('recentDMs_' + myUsername, JSON.stringify(list));
  // Save to backend
  try {
    await fetch(`${CHAT_SERVER_URL}/api/recent-dms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify({ user: myUsername, recents: list })
    });
  } catch (e) {}
  // Save to localhost if not already
  if (!CHAT_SERVER_URL.includes('localhost')) {
    try {
      await fetch(`http://localhost:3000/api/recent-dms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
        body: JSON.stringify({ user: myUsername, recents: list })
      });
    } catch (e) {}
  }
}
async function touchRecentDM(username) {
  if (!username || username === myUsername) return;
  let recents = await getRecentDMs();
  recents = recents.filter(u => u !== username);
  recents.unshift(username);
  recents = [...new Set(recents)];
  await saveRecentDMs(recents.slice(0, 30));
  if (typeof renderUserList === 'function') renderUserList();
  fetchAndCacheAvatar(username);
}

// Fetch avatar from localStorage, backend, localhost, and update allUsers/localStorage
async function fetchAndCacheAvatar(username) {
  if (!username) return;
  let avatar = null;
  // 1. Check localStorage
  avatar = localStorage.getItem('avatar_' + username);
  if (avatar) {
    updateUserAvatar(username, avatar);
    return;
  }
  // 2. Try backend API
  try {
    let res = await fetch(`${CHAT_SERVER_URL}/api/profile/avatar/${encodeURIComponent(username)}`);
    if (res.ok) {
      let data = await res.json();
      if (data && data.avatar) {
        avatar = data.avatar;
        localStorage.setItem('avatar_' + username, avatar);
        updateUserAvatar(username, avatar);
        return;
      }
    }
  } catch (e) {}
  // 3. Try localhost (if different from CHAT_SERVER_URL)
  if (!CHAT_SERVER_URL.includes('localhost')) {
    try {
      let res = await fetch(`http://localhost:3000/api/profile/avatar/${encodeURIComponent(username)}`);
      if (res.ok) {
        let data = await res.json();
        if (data && data.avatar) {
          avatar = data.avatar;
          localStorage.setItem('avatar_' + username, avatar);
          updateUserAvatar(username, avatar);
          return;
        }
      }
    } catch (e) {}
  }
  // 4. Fallback: do nothing (will use default)
}

function updateUserAvatar(username, avatar) {
  let idx = allUsers.findIndex(u => u.username === username);
  if (idx !== -1) {
    allUsers[idx].avatar = avatar;
  } else {
    allUsers.push({ username, avatar });
  }
  // Also update in DOM if needed
  if (typeof renderUserList === 'function') renderUserList();
}
// --- Listen for avatar/profile changes and update chat UI ---
window.addEventListener('storage', function (e) {
  if (e.key === 'profileAvatar' && e.newValue) {
    updateMyAvatar(e.newValue);
  }
});

function updateMyAvatar(newAvatar) {
  // Update in allUsers
  const idx = allUsers.findIndex(u => u.username === myUsername);
  if (idx !== -1) {
    allUsers[idx].avatar = newAvatar;
    renderUserList();
    // If current chat is self, update header
    if (currentChatUser === myUsername) {
      const headerAvatar = document.getElementById('chatHeaderAvatar');
      if (headerAvatar) headerAvatar.src = newAvatar || DEFAULT_AVATAR;
    }
  }
}
// OwnsHub Chat Client - Upgraded
// Requires: loggedInUser + token in localStorage, Socket.io backend

const DEFAULT_AVATAR = 'logos_and_profileicons/defaultpfp.webp';
const myUsername = localStorage.getItem('loggedInUser');
const token = localStorage.getItem('token');

const scheme = window.location.protocol === 'https:' ? 'https' : 'http';
const host = window.location.hostname || 'localhost';
const CHAT_SERVER_URL = localStorage.getItem('chatServerUrl') || 'https://sigh2.onrender.com';

// ─── AUTH GUARD ──────────────────────────────────────────────
if (!myUsername || !token) {
  const area = document.getElementById('messagesArea');
  if (area) area.innerHTML = '<div style="color:var(--text-muted);text-align:center;margin-top:40px;">Please log in to use chat.</div>';
  const header = document.getElementById('chatHeader');
  if (header) header.textContent = 'Login Required';
  throw new Error('Chat requires a logged-in user');
}

// ─── SOCKET ──────────────────────────────────────────────────
const socket = typeof window.io === 'function'
  ? io(CHAT_SERVER_URL, { transports: ['websocket'] })
  : null;

// On page load, sync recents from all sources
(async () => { await getRecentDMs(); if (typeof renderUserList === 'function') renderUserList(); })();

// ─── STATE ───────────────────────────────────────────────────
let currentChatUser = null;
let currentChatUserObj = null;
let allUsers = [];
let onlineUsers = new Set();
let userStatusMap = {};
let userSearch = '';
let unreadCounts = JSON.parse(localStorage.getItem('chatUnreadCounts') || '{}');
let pendingImageDataUrl = null;
let pendingFileData = null;
let pendingFileName = '';
let typingTimeout = null;
let typingIndicatorTimeout = null;

// ─── SOCKET EVENTS ───────────────────────────────────────────
if (socket) {
  socket.emit('join', myUsername);

  socket.on('connect', () => updateConnectionStatus('connected'));
  socket.on('disconnect', () => updateConnectionStatus('disconnected'));
  socket.on('connect_error', () => updateConnectionStatus('error'));

  socket.on('online_users', list => {
    onlineUsers = new Set(list);
    renderUserList();
    updateChatHeaderStatus();
  });

  socket.on('user_status', statusObj => {
    userStatusMap = statusObj;
    renderUserList();
    updateChatHeaderStatus();
  });

  socket.on('typing', data => {
    if (data.from === currentChatUser) showTypingIndicator(data.from);
  });

  socket.on('private_message', msg => {
    // Always touch recents for sender/receiver and update list
    const otherUser = msg.sender === myUsername ? msg.receiver : msg.sender;
    // Dynamically add new user to allUsers if not present
    if (!allUsers.some(u => u.username === otherUser)) {
      allUsers.push({ username: otherUser, displayName: otherUser });
    }
    touchRecentDM(otherUser);
    if (msg.sender === currentChatUser || (msg.sender === myUsername && msg.receiver === currentChatUser)) {
      appendMessage(msg, msg.sender === myUsername);
      scrollToBottom();
    } else if (msg.receiver === myUsername) {
      unreadCounts[msg.sender] = (unreadCounts[msg.sender] || 0) + 1;
      saveUnread();
    }
    renderUserList();
  });

  socket.emit('get_online_users');
} else {
  updateConnectionStatus('error');
}

// ─── CONNECTION STATUS ────────────────────────────────────────
function updateConnectionStatus(state) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (!dot || !text) return;
  const map = {
    connected:    { color: 'var(--green)',  label: 'Connected' },
    disconnected: { color: 'var(--red)',    label: 'Disconnected' },
    error:        { color: 'var(--yellow)', label: 'Reconnecting…' },
  };
  const s = map[state] || map.error;
  dot.style.background = s.color;
  text.textContent = s.label;
}

// ─── USER LIST ────────────────────────────────────────────────
function getStatusColor(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'var(--green)';
  if (st === 'dnd')    return 'var(--red)';
  if (st === 'away')   return 'var(--yellow)';
  return 'var(--text-dim)';
}

function getStatusLabel(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'Online';
  if (st === 'dnd')    return 'Do Not Disturb';
  if (st === 'away')   return 'Away';
  return 'Offline';
}

function renderUserList() {
  const userList = document.getElementById('userList');
  if (!userList) return;
  userList.innerHTML = '';

  let recents = getRecentDMs();
  let usersByName = Object.fromEntries(allUsers.map(u => [u.username, u]));
  let filtered = allUsers.filter(u => u.username !== myUsername);

  // If searching, show search results at top, else show recents at top
  if (userSearch.startsWith('@')) {
    const term = userSearch.slice(1).toLowerCase();
    filtered = filtered.filter(u =>
      u.username.toLowerCase().includes(term) ||
      (u.displayName && u.displayName.toLowerCase().includes(term))
    );
    // If not found, allow quick start
    if (filtered.length === 0) {
      const typed = userSearch.slice(1).trim();
      if (typed && typed !== myUsername) {
        const li = makeUserLi({ username: typed, displayName: typed }, true);
        userList.appendChild(li);
      }
      return;
    }
    filtered.forEach(u => userList.appendChild(makeUserLi(u)));
    return;
  }

  // Stack strictly by recency (no pinning current chat)
  let stacked = [];
  recents.forEach(username => {
    if (usersByName[username]) stacked.push(usersByName[username]);
  });
  // Add the rest (not in recents)
  filtered.forEach(u => {
    if (!recents.includes(u.username)) stacked.push(u);
  });

  if (stacked.length === 0) {
    const li = document.createElement('li');
    li.style.cssText = 'opacity:0.5;cursor:default;font-size:0.9em;';
    li.textContent = 'No users found. Type @username to start a chat.';
    userList.appendChild(li);
    return;
  }
  stacked.forEach(u => userList.appendChild(makeUserLi(u)));
}

function makeUserLi(u, isQuickStart = false) {
  const li = document.createElement('li');
  if (currentChatUser === u.username) li.classList.add('active');

  // Avatar wrap
  const wrap = document.createElement('div');
  wrap.className = 'user-avatar-wrap';

  const avatar = document.createElement('img');
  avatar.src = u.avatar || DEFAULT_AVATAR;
  avatar.onerror = () => { avatar.src = DEFAULT_AVATAR; };
  avatar.className = 'avatar';
  wrap.appendChild(avatar);

  const dot = document.createElement('span');
  dot.className = 'avatar-status-dot';
  dot.style.background = isQuickStart ? 'var(--text-dim)' : getStatusColor(u.username);
  wrap.appendChild(dot);
  li.appendChild(wrap);

  // Info
  const info = document.createElement('div');
  info.className = 'user-info';

  const nameSpan = document.createElement('div');
  nameSpan.className = 'user-display-name';
  nameSpan.textContent = u.displayName || u.username;
  info.appendChild(nameSpan);

  const usernameSpan = document.createElement('div');
  usernameSpan.className = 'user-username';
  usernameSpan.textContent = '@' + u.username;
  info.appendChild(usernameSpan);
  li.appendChild(info);

  // Unread badge
  if (unreadCounts[u.username] > 0) {
    const badge = document.createElement('span');
    badge.className = 'unread-badge';
    badge.textContent = unreadCounts[u.username];
    li.appendChild(badge);
  }

  li.onclick = () => selectUser(u.username, li);
  return li;
}

// ─── SELECT USER ──────────────────────────────────────────────
function selectUser(username, liElem) {
  touchRecentDM(username);
  fetchAndCacheAvatar(username);
  currentChatUser = username;
  currentChatUserObj = allUsers.find(u => u.username === username) || { username, displayName: username };

  // Highlight
  document.querySelectorAll('.user-list li').forEach(li => li.classList.remove('active'));
  liElem.classList.add('active');

  // Reset unread
  unreadCounts[username] = 0;
  saveUnread();
  renderUserList();

  // Show chat panels
  document.getElementById('emptyState').style.display = 'none';
  const chatHeader = document.getElementById('chatHeader');
  const messagesArea = document.getElementById('messagesArea');
  const inputArea = document.getElementById('chatInputArea');
  chatHeader.style.display = 'flex';
  messagesArea.style.display = 'flex';
  inputArea.style.display = 'block';

  // Update header
  document.getElementById('chatHeaderName').textContent =
    (currentChatUserObj.displayName || username) + ' (@' + username + ')';
  const headerAvatar = document.getElementById('chatHeaderAvatar');
  headerAvatar.src = currentChatUserObj.avatar || DEFAULT_AVATAR;
  headerAvatar.style.display = 'block';
  updateChatHeaderStatus();

  // Clear messages, fetch and merge history from all sources
  messagesArea.innerHTML = '';
  (async () => {
    let histories = [];
    // 1. Backend
    try {
      let res = await fetch(`${CHAT_SERVER_URL}/api/messages?user=${encodeURIComponent(username)}`, {
        headers: {
          'Authorization': token ? 'Bearer ' + token : '',
          'X-Chat-User': myUsername
        }
      });
      if (res.ok) histories.push(await res.json());
    } catch (e) {}
    // 2. Localhost
    if (!CHAT_SERVER_URL.includes('localhost')) {
      try {
        let res = await fetch(`http://localhost:3000/api/messages?user=${encodeURIComponent(username)}`, {
          headers: {
            'Authorization': token ? 'Bearer ' + token : '',
            'X-Chat-User': myUsername
          }
        });
        if (res.ok) histories.push(await res.json());
      } catch (e) {}
    }
    // 3. LocalStorage
    let localKey = `chatHistory_${myUsername}_${username}`;
    let localHistory = JSON.parse(localStorage.getItem(localKey) || '[]');
    if (localHistory.length) histories.push(localHistory);

    // Merge and deduplicate by timestamp+sender+content
    let allMsgs = histories.flat();
    let seen = new Set();
    let merged = allMsgs.filter(msg => {
      let key = msg.timestamp + '|' + msg.sender + '|' + (msg.content || '') + '|' + (msg.image || '') + '|' + (msg.gif || '') + '|' + (msg.file ? msg.file.name : '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Sort by timestamp ascending
    merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Save merged history back to localStorage and backend
    localStorage.setItem(localKey, JSON.stringify(merged));
    try {
      await fetch(`${CHAT_SERVER_URL}/api/messages/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
        body: JSON.stringify({ user: myUsername, other: username, messages: merged })
      });
    } catch (e) {}
    if (!CHAT_SERVER_URL.includes('localhost')) {
      try {
        await fetch(`http://localhost:3000/api/messages/merge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
          body: JSON.stringify({ user: myUsername, other: username, messages: merged })
        });
      } catch (e) {}
    }

    if (merged.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'transient-notice';
      empty.textContent = 'No messages yet. Say hi! 👋';
      messagesArea.appendChild(empty);
    } else {
      merged.forEach(msg => appendMessage(msg, msg.sender === myUsername));
      scrollToBottom();
    }
  })().catch(() => showNotice('Could not load message history.', 'var(--red)'));

  document.getElementById('chatInput').focus();
}

function updateChatHeaderStatus() {
  const el = document.getElementById('chatHeaderStatus');
  if (!el || !currentChatUser) return;
  el.textContent = getStatusLabel(currentChatUser);
}

// ─── SEND MESSAGE ─────────────────────────────────────────────
function sendMessage() {
  if (currentGroup || currentChatUser) {
    const input = document.getElementById('chatInput');
    const content = input ? input.value.trim() : '';
    if (!currentChatUser && !currentGroup) { showNotice('Select a user or group first.', 'var(--yellow)'); return; }
    if (!content && !pendingImageDataUrl && !pendingFileData) return;
    const msg = {
      sender: myUsername,
      receiver: currentChatUser,
      group: currentGroup ? currentGroup.id : undefined,
      content: content || '',
      image: pendingImageDataUrl || null,
      file: pendingFileData && pendingFileName ? { name: pendingFileName, data: pendingFileData } : undefined,
      timestamp: new Date().toISOString()
    };
    sendMessageUniversal(msg);
    appendMessage(msg, true);
    if (input) input.value = '';
    clearFilePreview && clearFilePreview();
    clearImagePreview && clearImagePreview();
    scrollToBottom();
    autoResizeTextarea && autoResizeTextarea();
  }
}

// --- Universal message sync (backend + localStorage + Socket.io) ---
async function sendMessageUniversal(msg) {
  // Save to localStorage immediately
  let localKey = `chatHistory_${myUsername}_${msg.receiver || msg.group}`;
  let msgs = JSON.parse(localStorage.getItem(localKey) || '[]');
  msgs.push(msg);
  localStorage.setItem(localKey, JSON.stringify(msgs));

  // Try backend
  try {
    await fetch(`${CHAT_SERVER_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify(msg)
    });
  } catch (e) {
    // If offline, keep in localStorage for later sync
  }
  // Emit via Socket.io for real-time update
  if (socket && socket.connected) {
    if (msg.group) socket.emit('group_message', msg);
    else socket.emit('private_message', msg);
  }
}

async function fetchMessagesUniversal(chatId, isGroup) {
  let localMsgs = JSON.parse(localStorage.getItem(`chatHistory_${myUsername}_${chatId}`) || '[]');
  let backendMsgs = [];
  try {
    let res = await fetch(`${CHAT_SERVER_URL}/api/messages?chatId=${encodeURIComponent(chatId)}`, {
      headers: { 'Authorization': token ? 'Bearer ' + token : '' }
    });
    if (res.ok) backendMsgs = await res.json();
  } catch (e) {}
  // Merge and deduplicate by timestamp+sender+content
  let allMsgs = [...localMsgs, ...backendMsgs];
  let seen = new Set();
  let merged = allMsgs.filter(msg => {
    let key = msg.timestamp + '|' + msg.sender + '|' + (msg.content || '') + '|' + (msg.image || '') + '|' + (msg.gif || '') + '|' + (msg.file ? msg.file.name : '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Sort by timestamp ascending
  merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  // Save merged history back to localStorage
  localStorage.setItem(`chatHistory_${myUsername}_${chatId}`, JSON.stringify(merged));
  return merged;
}

// Patch sendMessage to use universal sync
const origSendMessageUniversal = sendMessage;
sendMessage = function() {
  const input = document.getElementById('chatInput');
  const content = input ? input.value.trim() : '';
  if (!currentChatUser && !currentGroup) { showNotice('Select a user or group first.', 'var(--yellow)'); return; }
  if (!content && !pendingImageDataUrl && !pendingFileData) return;
  const msg = {
    sender: myUsername,
    receiver: currentChatUser,
    group: currentGroup ? currentGroup.id : undefined,
    content: content || '',
    image: pendingImageDataUrl || null,
    file: pendingFileData && pendingFileName ? { name: pendingFileName, data: pendingFileData } : undefined,
    timestamp: new Date().toISOString()
  };
  sendMessageUniversal(msg);
  appendMessage(msg, true);
  if (input) input.value = '';
  clearFilePreview && clearFilePreview();
  clearImagePreview && clearImagePreview();
  scrollToBottom();
  autoResizeTextarea && autoResizeTextarea();
};

// Patch selectUser/selectGroup to use universal fetch
const origSelectUserUniversal = selectUser;
selectUser = async function(username, liElem) {
  origSelectUserUniversal(username, liElem);
  const area = document.getElementById('messagesArea');
  if (!area) return;
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(username, false);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
  }
};
const origSelectGroupUniversal = selectGroup;
selectGroup = async function(groupId) {
  origSelectGroupUniversal(groupId);
  const area = document.getElementById('messagesArea');
  if (!area || !currentGroup) return;
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(currentGroup.id, true);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
  }
};

// ─── CONNECTION STATUS ────────────────────────────────────────
function updateConnectionStatus(state) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (!dot || !text) return;
  const map = {
    connected:    { color: 'var(--green)',  label: 'Connected' },
    disconnected: { color: 'var(--red)',    label: 'Disconnected' },
    error:        { color: 'var(--yellow)', label: 'Reconnecting…' },
  };
  const s = map[state] || map.error;
  dot.style.background = s.color;
  text.textContent = s.label;
}

// ─── USER LIST ────────────────────────────────────────────────
function getStatusColor(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'var(--green)';
  if (st === 'dnd')    return 'var(--red)';
  if (st === 'away')   return 'var(--yellow)';
  return 'var(--text-dim)';
}

function getStatusLabel(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'Online';
  if (st === 'dnd')    return 'Do Not Disturb';
  if (st === 'away')   return 'Away';
  return 'Offline';
}

function renderUserList() {
  const userList = document.getElementById('userList');
  if (!userList) return;
  userList.innerHTML = '';

  let recents = getRecentDMs();
  let usersByName = Object.fromEntries(allUsers.map(u => [u.username, u]));
  let filtered = allUsers.filter(u => u.username !== myUsername);

  // If searching, show search results at top, else show recents at top
  if (userSearch.startsWith('@')) {
    const term = userSearch.slice(1).toLowerCase();
    filtered = filtered.filter(u =>
      u.username.toLowerCase().includes(term) ||
      (u.displayName && u.displayName.toLowerCase().includes(term))
    );
    // If not found, allow quick start
    if (filtered.length === 0) {
      const typed = userSearch.slice(1).trim();
      if (typed && typed !== myUsername) {
        const li = makeUserLi({ username: typed, displayName: typed }, true);
        userList.appendChild(li);
      }
      return;
    }
    filtered.forEach(u => userList.appendChild(makeUserLi(u)));
    return;
  }

  // Stack strictly by recency (no pinning current chat)
  let stacked = [];
  recents.forEach(username => {
    if (usersByName[username]) stacked.push(usersByName[username]);
  });
  // Add the rest (not in recents)
  filtered.forEach(u => {
    if (!recents.includes(u.username)) stacked.push(u);
  });

  if (stacked.length === 0) {
    const li = document.createElement('li');
    li.style.cssText = 'opacity:0.5;cursor:default;font-size:0.9em;';
    li.textContent = 'No users found. Type @username to start a chat.';
    userList.appendChild(li);
    return;
  }
  stacked.forEach(u => userList.appendChild(makeUserLi(u)));
}

function makeUserLi(u, isQuickStart = false) {
  const li = document.createElement('li');
  if (currentChatUser === u.username) li.classList.add('active');

  // Avatar wrap
  const wrap = document.createElement('div');
  wrap.className = 'user-avatar-wrap';

  const avatar = document.createElement('img');
  avatar.src = u.avatar || DEFAULT_AVATAR;
  avatar.onerror = () => { avatar.src = DEFAULT_AVATAR; };
  avatar.className = 'avatar';
  wrap.appendChild(avatar);

  const dot = document.createElement('span');
  dot.className = 'avatar-status-dot';
  dot.style.background = isQuickStart ? 'var(--text-dim)' : getStatusColor(u.username);
  wrap.appendChild(dot);
  li.appendChild(wrap);

  // Info
  const info = document.createElement('div');
  info.className = 'user-info';

  const nameSpan = document.createElement('div');
  nameSpan.className = 'user-display-name';
  nameSpan.textContent = u.displayName || u.username;
  info.appendChild(nameSpan);

  const usernameSpan = document.createElement('div');
  usernameSpan.className = 'user-username';
  usernameSpan.textContent = '@' + u.username;
  info.appendChild(usernameSpan);
  li.appendChild(info);

  // Unread badge
  if (unreadCounts[u.username] > 0) {
    const badge = document.createElement('span');
    badge.className = 'unread-badge';
    badge.textContent = unreadCounts[u.username];
    li.appendChild(badge);
  }

  li.onclick = () => selectUser(u.username, li);
  return li;
}

// ─── SELECT USER ──────────────────────────────────────────────
function selectUser(username, liElem) {
  touchRecentDM(username);
  fetchAndCacheAvatar(username);
  currentChatUser = username;
  currentChatUserObj = allUsers.find(u => u.username === username) || { username, displayName: username };

  // Highlight
  document.querySelectorAll('.user-list li').forEach(li => li.classList.remove('active'));
  liElem.classList.add('active');

  // Reset unread
  unreadCounts[username] = 0;
  saveUnread();
  renderUserList();

  // Show chat panels
  document.getElementById('emptyState').style.display = 'none';
  const chatHeader = document.getElementById('chatHeader');
  const messagesArea = document.getElementById('messagesArea');
  const inputArea = document.getElementById('chatInputArea');
  chatHeader.style.display = 'flex';
  messagesArea.style.display = 'flex';
  inputArea.style.display = 'block';

  // Update header
  document.getElementById('chatHeaderName').textContent =
    (currentChatUserObj.displayName || username) + ' (@' + username + ')';
  const headerAvatar = document.getElementById('chatHeaderAvatar');
  headerAvatar.src = currentChatUserObj.avatar || DEFAULT_AVATAR;
  headerAvatar.style.display = 'block';
  updateChatHeaderStatus();

  // Clear messages, fetch and merge history from all sources
  messagesArea.innerHTML = '';
  (async () => {
    let histories = [];
    // 1. Backend
    try {
      let res = await fetch(`${CHAT_SERVER_URL}/api/messages?user=${encodeURIComponent(username)}`, {
        headers: {
          'Authorization': token ? 'Bearer ' + token : '',
          'X-Chat-User': myUsername
        }
      });
      if (res.ok) histories.push(await res.json());
    } catch (e) {}
    // 2. Localhost
    if (!CHAT_SERVER_URL.includes('localhost')) {
      try {
        let res = await fetch(`http://localhost:3000/api/messages?user=${encodeURIComponent(username)}`, {
          headers: {
            'Authorization': token ? 'Bearer ' + token : '',
            'X-Chat-User': myUsername
          }
        });
        if (res.ok) histories.push(await res.json());
      } catch (e) {}
    }
    // 3. LocalStorage
    let localKey = `chatHistory_${myUsername}_${username}`;
    let localHistory = JSON.parse(localStorage.getItem(localKey) || '[]');
    if (localHistory.length) histories.push(localHistory);

    // Merge and deduplicate by timestamp+sender+content
    let allMsgs = histories.flat();
    let seen = new Set();
    let merged = allMsgs.filter(msg => {
      let key = msg.timestamp + '|' + msg.sender + '|' + (msg.content || '') + '|' + (msg.image || '') + '|' + (msg.gif || '') + '|' + (msg.file ? msg.file.name : '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Sort by timestamp ascending
    merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Save merged history back to localStorage and backend
    localStorage.setItem(localKey, JSON.stringify(merged));
    try {
      await fetch(`${CHAT_SERVER_URL}/api/messages/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
        body: JSON.stringify({ user: myUsername, other: username, messages: merged })
      });
    } catch (e) {}
    if (!CHAT_SERVER_URL.includes('localhost')) {
      try {
        await fetch(`http://localhost:3000/api/messages/merge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
          body: JSON.stringify({ user: myUsername, other: username, messages: merged })
        });
      } catch (e) {}
    }

    if (merged.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'transient-notice';
      empty.textContent = 'No messages yet. Say hi! 👋';
      messagesArea.appendChild(empty);
    } else {
      merged.forEach(msg => appendMessage(msg, msg.sender === myUsername));
      scrollToBottom();
    }
  })().catch(() => showNotice('Could not load message history.', 'var(--red)'));

  document.getElementById('chatInput').focus();
}

function updateChatHeaderStatus() {
  const el = document.getElementById('chatHeaderStatus');
  if (!el || !currentChatUser) return;
  el.textContent = getStatusLabel(currentChatUser);
}

// ─── SEND MESSAGE ─────────────────────────────────────────────
function sendMessage() {
  if (currentGroup || currentChatUser) {
    const input = document.getElementById('chatInput');
    const content = input ? input.value.trim() : '';
    if (!currentChatUser && !currentGroup) { showNotice('Select a user or group first.', 'var(--yellow)'); return; }
    if (!content && !pendingImageDataUrl && !pendingFileData) return;
    const msg = {
      sender: myUsername,
      receiver: currentChatUser,
      group: currentGroup ? currentGroup.id : undefined,
      content: content || '',
      image: pendingImageDataUrl || null,
      file: pendingFileData && pendingFileName ? { name: pendingFileName, data: pendingFileData } : undefined,
      timestamp: new Date().toISOString()
    };
    sendMessageUniversal(msg);
    appendMessage(msg, true);
    if (input) input.value = '';
    clearFilePreview && clearFilePreview();
    clearImagePreview && clearImagePreview();
    scrollToBottom();
    autoResizeTextarea && autoResizeTextarea();
  }
}

// --- Universal message sync (backend + localStorage + Socket.io) ---
async function sendMessageUniversal(msg) {
  // Save to localStorage immediately
  let localKey = `chatHistory_${myUsername}_${msg.receiver || msg.group}`;
  let msgs = JSON.parse(localStorage.getItem(localKey) || '[]');
  msgs.push(msg);
  localStorage.setItem(localKey, JSON.stringify(msgs));

  // Try backend
  try {
    await fetch(`${CHAT_SERVER_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify(msg)
    });
  } catch (e) {
    // If offline, keep in localStorage for later sync
  }
  // Emit via Socket.io for real-time update
  if (socket && socket.connected) {
    if (msg.group) socket.emit('group_message', msg);
    else socket.emit('private_message', msg);
  }
}

async function fetchMessagesUniversal(chatId, isGroup) {
  let localMsgs = JSON.parse(localStorage.getItem(`chatHistory_${myUsername}_${chatId}`) || '[]');
  let backendMsgs = [];
  try {
    let res = await fetch(`${CHAT_SERVER_URL}/api/messages?chatId=${encodeURIComponent(chatId)}`, {
      headers: { 'Authorization': token ? 'Bearer ' + token : '' }
    });
    if (res.ok) backendMsgs = await res.json();
  } catch (e) {}
  // Merge and deduplicate by timestamp+sender+content
  let allMsgs = [...localMsgs, ...backendMsgs];
  let seen = new Set();
  let merged = allMsgs.filter(msg => {
    let key = msg.timestamp + '|' + msg.sender + '|' + (msg.content || '') + '|' + (msg.image || '') + '|' + (msg.gif || '') + '|' + (msg.file ? msg.file.name : '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Sort by timestamp ascending
  merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  // Save merged history back to localStorage
  localStorage.setItem(`chatHistory_${myUsername}_${chatId}`, JSON.stringify(merged));
  return merged;
}

// Patch sendMessage to use universal sync
const origSendMessageUniversal = sendMessage;
sendMessage = function() {
  const input = document.getElementById('chatInput');
  const content = input ? input.value.trim() : '';
  if (!currentChatUser && !currentGroup) { showNotice('Select a user or group first.', 'var(--yellow)'); return; }
  if (!content && !pendingImageDataUrl && !pendingFileData) return;
  const msg = {
    sender: myUsername,
    receiver: currentChatUser,
    group: currentGroup ? currentGroup.id : undefined,
    content: content || '',
    image: pendingImageDataUrl || null,
    file: pendingFileData && pendingFileName ? { name: pendingFileName, data: pendingFileData } : undefined,
    timestamp: new Date().toISOString()
  };
  sendMessageUniversal(msg);
  appendMessage(msg, true);
  if (input) input.value = '';
  clearFilePreview && clearFilePreview();
  clearImagePreview && clearImagePreview();
  scrollToBottom();
  autoResizeTextarea && autoResizeTextarea();
};

// Patch selectUser/selectGroup to use universal fetch
const origSelectUserUniversal = selectUser;
selectUser = async function(username, liElem) {
  origSelectUserUniversal(username, liElem);
  const area = document.getElementById('messagesArea');
  if (!area) return;
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(username, false);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
  }
};
const origSelectGroupUniversal = selectGroup;
selectGroup = async function(groupId) {
  origSelectGroupUniversal(groupId);
  const area = document.getElementById('messagesArea');
  if (!area || !currentGroup) return;
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(currentGroup.id, true);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
  }
};

// ─── CONNECTION STATUS ────────────────────────────────────────
function updateConnectionStatus(state) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (!dot || !text) return;
  const map = {
    connected:    { color: 'var(--green)',  label: 'Connected' },
    disconnected: { color: 'var(--red)',    label: 'Disconnected' },
    error:        { color: 'var(--yellow)', label: 'Reconnecting…' },
  };
  const s = map[state] || map.error;
  dot.style.background = s.color;
  text.textContent = s.label;
}

// ─── USER LIST ────────────────────────────────────────────────
function getStatusColor(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'var(--green)';
  if (st === 'dnd')    return 'var(--red)';
  if (st === 'away')   return 'var(--yellow)';
  return 'var(--text-dim)';
}

function getStatusLabel(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'Online';
  if (st === 'dnd')    return 'Do Not Disturb';
  if (st === 'away')   return 'Away';
  return 'Offline';
}

function renderUserList() {
  const userList = document.getElementById('userList');
  if (!userList) return;
  userList.innerHTML = '';

  let recents = getRecentDMs();
  let usersByName = Object.fromEntries(allUsers.map(u => [u.username, u]));
  let filtered = allUsers.filter(u => u.username !== myUsername);

  // If searching, show search results at top, else show recents at top
  if (userSearch.startsWith('@')) {
    const term = userSearch.slice(1).toLowerCase();
    filtered = filtered.filter(u =>
      u.username.toLowerCase().includes(term) ||
      (u.displayName && u.displayName.toLowerCase().includes(term))
    );
    // If not found, allow quick start
    if (filtered.length === 0) {
      const typed = userSearch.slice(1).trim();
      if (typed && typed !== myUsername) {
        const li = makeUserLi({ username: typed, displayName: typed }, true);
        userList.appendChild(li);
      }
      return;
    }
    filtered.forEach(u => userList.appendChild(makeUserLi(u)));
    return;
  }

  // Stack strictly by recency (no pinning current chat)
  let stacked = [];
  recents.forEach(username => {
    if (usersByName[username]) stacked.push(usersByName[username]);
  });
  // Add the rest (not in recents)
  filtered.forEach(u => {
    if (!recents.includes(u.username)) stacked.push(u);
  });

  if (stacked.length === 0) {
    const li = document.createElement('li');
    li.style.cssText = 'opacity:0.5;cursor:default;font-size:0.9em;';
    li.textContent = 'No users found. Type @username to start a chat.';
    userList.appendChild(li);
    return;
  }
  stacked.forEach(u => userList.appendChild(makeUserLi(u)));
}

function makeUserLi(u, isQuickStart = false) {
  const li = document.createElement('li');
  if (currentChatUser === u.username) li.classList.add('active');

  // Avatar wrap
  const wrap = document.createElement('div');
  wrap.className = 'user-avatar-wrap';

  const avatar = document.createElement('img');
  avatar.src = u.avatar || DEFAULT_AVATAR;
  avatar.onerror = () => { avatar.src = DEFAULT_AVATAR; };
  avatar.className = 'avatar';
  wrap.appendChild(avatar);

  const dot = document.createElement('span');
  dot.className = 'avatar-status-dot';
  dot.style.background = isQuickStart ? 'var(--text-dim)' : getStatusColor(u.username);
  wrap.appendChild(dot);
  li.appendChild(wrap);

  // Info
  const info = document.createElement('div');
  info.className = 'user-info';

  const nameSpan = document.createElement('div');
  nameSpan.className = 'user-display-name';
  nameSpan.textContent = u.displayName || u.username;
  info.appendChild(nameSpan);

  const usernameSpan = document.createElement('div');
  usernameSpan.className = 'user-username';
  usernameSpan.textContent = '@' + u.username;
  info.appendChild(usernameSpan);
  li.appendChild(info);

  // Unread badge
  if (unreadCounts[u.username] > 0) {
    const badge = document.createElement('span');
    badge.className = 'unread-badge';
    badge.textContent = unreadCounts[u.username];
    li.appendChild(badge);
  }

  li.onclick = () => selectUser(u.username, li);
  return li;
}

// ─── SELECT USER ──────────────────────────────────────────────
function selectUser(username, liElem) {
  touchRecentDM(username);
  fetchAndCacheAvatar(username);
  currentChatUser = username;
  currentChatUserObj = allUsers.find(u => u.username === username) || { username, displayName: username };

  // Highlight
  document.querySelectorAll('.user-list li').forEach(li => li.classList.remove('active'));
  liElem.classList.add('active');

  // Reset unread
  unreadCounts[username] = 0;
  saveUnread();
  renderUserList();

  // Show chat panels
  document.getElementById('emptyState').style.display = 'none';
  const chatHeader = document.getElementById('chatHeader');
  const messagesArea = document.getElementById('messagesArea');
  const inputArea = document.getElementById('chatInputArea');
  chatHeader.style.display = 'flex';
  messagesArea.style.display = 'flex';
  inputArea.style.display = 'block';

  // Update header
  document.getElementById('chatHeaderName').textContent =
    (currentChatUserObj.displayName || username) + ' (@' + username + ')';
  const headerAvatar = document.getElementById('chatHeaderAvatar');
  headerAvatar.src = currentChatUserObj.avatar || DEFAULT_AVATAR;
  headerAvatar.style.display = 'block';
  updateChatHeaderStatus();

  // Clear messages, fetch and merge history from all sources
  messagesArea.innerHTML = '';
  (async () => {
    let histories = [];
    // 1. Backend
    try {
      let res = await fetch(`${CHAT_SERVER_URL}/api/messages?user=${encodeURIComponent(username)}`, {
        headers: {
          'Authorization': token ? 'Bearer ' + token : '',
          'X-Chat-User': myUsername
        }
      });
      if (res.ok) histories.push(await res.json());
    } catch (e) {}
    // 2. Localhost
    if (!CHAT_SERVER_URL.includes('localhost')) {
      try {
        let res = await fetch(`http://localhost:3000/api/messages?user=${encodeURIComponent(username)}`, {
          headers: {
            'Authorization': token ? 'Bearer ' + token : '',
            'X-Chat-User': myUsername
          }
        });
        if (res.ok) histories.push(await res.json());
      } catch (e) {}
    }
    // 3. LocalStorage
    let localKey = `chatHistory_${myUsername}_${username}`;
    let localHistory = JSON.parse(localStorage.getItem(localKey) || '[]');
    if (localHistory.length) histories.push(localHistory);

    // Merge and deduplicate by timestamp+sender+content
    let allMsgs = histories.flat();
    let seen = new Set();
    let merged = allMsgs.filter(msg => {
      let key = msg.timestamp + '|' + msg.sender + '|' + (msg.content || '') + '|' + (msg.image || '') + '|' + (msg.gif || '') + '|' + (msg.file ? msg.file.name : '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Sort by timestamp ascending
    merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Save merged history back to localStorage and backend
    localStorage.setItem(localKey, JSON.stringify(merged));
    try {
      await fetch(`${CHAT_SERVER_URL}/api/messages/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
        body: JSON.stringify({ user: myUsername, other: username, messages: merged })
      });
    } catch (e) {}
    if (!CHAT_SERVER_URL.includes('localhost')) {
      try {
        await fetch(`http://localhost:3000/api/messages/merge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
          body: JSON.stringify({ user: myUsername, other: username, messages: merged })
        });
      } catch (e) {}
    }

    if (merged.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'transient-notice';
      empty.textContent = 'No messages yet. Say hi! 👋';
      messagesArea.appendChild(empty);
    } else {
      merged.forEach(msg => appendMessage(msg, msg.sender === myUsername));
      scrollToBottom();
    }
  })().catch(() => showNotice('Could not load message history.', 'var(--red)'));

  document.getElementById('chatInput').focus();
}

function updateChatHeaderStatus() {
  const el = document.getElementById('chatHeaderStatus');
  if (!el || !currentChatUser) return;
  el.textContent = getStatusLabel(currentChatUser);
}

// ─── SEND MESSAGE ─────────────────────────────────────────────
function sendMessage() {
  if (currentGroup || currentChatUser) {
    const input = document.getElementById('chatInput');
    const content = input ? input.value.trim() : '';
    if (!currentChatUser && !currentGroup) { showNotice('Select a user or group first.', 'var(--yellow)'); return; }
    if (!content && !pendingImageDataUrl && !pendingFileData) return;
    const msg = {
      sender: myUsername,
      receiver: currentChatUser,
      group: currentGroup ? currentGroup.id : undefined,
      content: content || '',
      image: pendingImageDataUrl || null,
      file: pendingFileData && pendingFileName ? { name: pendingFileName, data: pendingFileData } : undefined,
      timestamp: new Date().toISOString()
    };
    sendMessageUniversal(msg);
    appendMessage(msg, true);
    if (input) input.value = '';
    clearFilePreview && clearFilePreview();
    clearImagePreview && clearImagePreview();
    scrollToBottom();
    autoResizeTextarea && autoResizeTextarea();
  }
}

// --- Universal message sync (backend + localStorage + Socket.io) ---
async function sendMessageUniversal(msg) {
  // Save to localStorage immediately
  let localKey = `chatHistory_${myUsername}_${msg.receiver || msg.group}`;
  let msgs = JSON.parse(localStorage.getItem(localKey) || '[]');
  msgs.push(msg);
  localStorage.setItem(localKey, JSON.stringify(msgs));

  // Try backend
  try {
    await fetch(`${CHAT_SERVER_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify(msg)
    });
  } catch (e) {
    // If offline, keep in localStorage for later sync
  }
  // Emit via Socket.io for real-time update
  if (socket && socket.connected) {
    if (msg.group) socket.emit('group_message', msg);
    else socket.emit('private_message', msg);
  }
}

async function fetchMessagesUniversal(chatId, isGroup) {
  let localMsgs = JSON.parse(localStorage.getItem(`chatHistory_${myUsername}_${chatId}`) || '[]');
  let backendMsgs = [];
  try {
    let res = await fetch(`${CHAT_SERVER_URL}/api/messages?chatId=${encodeURIComponent(chatId)}`, {
      headers: { 'Authorization': token ? 'Bearer ' + token : '' }
    });
    if (res.ok) backendMsgs = await res.json();
  } catch (e) {}
  // Merge and deduplicate by timestamp+sender+content
  let allMsgs = [...localMsgs, ...backendMsgs];
  let seen = new Set();
  let merged = allMsgs.filter(msg => {
    let key = msg.timestamp + '|' + msg.sender + '|' + (msg.content || '') + '|' + (msg.image || '') + '|' + (msg.gif || '') + '|' + (msg.file ? msg.file.name : '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Sort by timestamp ascending
  merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  // Save merged history back to localStorage
  localStorage.setItem(`chatHistory_${myUsername}_${chatId}`, JSON.stringify(merged));
  return merged;
}

// Patch sendMessage to use universal sync
const origSendMessageUniversal = sendMessage;
sendMessage = function() {
  const input = document.getElementById('chatInput');
  const content = input ? input.value.trim() : '';
  if (!currentChatUser && !currentGroup) { showNotice('Select a user or group first.', 'var(--yellow)'); return; }
  if (!content && !pendingImageDataUrl && !pendingFileData) return;
  const msg = {
    sender: myUsername,
    receiver: currentChatUser,
    group: currentGroup ? currentGroup.id : undefined,
    content: content || '',
    image: pendingImageDataUrl || null,
    file: pendingFileData && pendingFileName ? { name: pendingFileName, data: pendingFileData } : undefined,
    timestamp: new Date().toISOString()
  };
  sendMessageUniversal(msg);
  appendMessage(msg, true);
  if (input) input.value = '';
  clearFilePreview && clearFilePreview();
  clearImagePreview && clearImagePreview();
  scrollToBottom();
  autoResizeTextarea && autoResizeTextarea();
};

// Patch selectUser/selectGroup to use universal fetch
const origSelectUserUniversal = selectUser;
selectUser = async function(username, liElem) {
  origSelectUserUniversal(username, liElem);
  const area = document.getElementById('messagesArea');
  if (!area) return;
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(username, false);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
  }
};
const origSelectGroupUniversal = selectGroup;
selectGroup = async function(groupId) {
  origSelectGroupUniversal(groupId);
  const area = document.getElementById('messagesArea');
  if (!area || !currentGroup) return;
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(currentGroup.id, true);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
  }
};

// ─── CONNECTION STATUS ────────────────────────────────────────
function updateConnectionStatus(state) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (!dot || !text) return;
  const map = {
    connected:    { color: 'var(--green)',  label: 'Connected' },
    disconnected: { color: 'var(--red)',    label: 'Disconnected' },
    error:        { color: 'var(--yellow)', label: 'Reconnecting…' },
  };
  const s = map[state] || map.error;
  dot.style.background = s.color;
  text.textContent = s.label;
}

// ─── USER LIST ────────────────────────────────────────────────
function getStatusColor(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'var(--green)';
  if (st === 'dnd')    return 'var(--red)';
  if (st === 'away')   return 'var(--yellow)';
  return 'var(--text-dim)';
}

function getStatusLabel(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'Online';
  if (st === 'dnd')    return 'Do Not Disturb';
  if (st === 'away')   return 'Away';
  return 'Offline';
}

function renderUserList() {
  const userList = document.getElementById('userList');
  if (!userList) return;
  userList.innerHTML = '';

  let recents = getRecentDMs();
  let usersByName = Object.fromEntries(allUsers.map(u => [u.username, u]));
  let filtered = allUsers.filter(u => u.username !== myUsername);

  // If searching, show search results at top, else show recents at top
  if (userSearch.startsWith('@')) {
    const term = userSearch.slice(1).toLowerCase();
    filtered = filtered.filter(u =>
      u.username.toLowerCase().includes(term) ||
      (u.displayName && u.displayName.toLowerCase().includes(term))
    );
    // If not found, allow quick start
    if (filtered.length === 0) {
      const typed = userSearch.slice(1).trim();
      if (typed && typed !== myUsername) {
        const li = makeUserLi({ username: typed, displayName: typed }, true);
        userList.appendChild(li);
      }
      return;
    }
    filtered.forEach(u => userList.appendChild(makeUserLi(u)));
    return;
  }

  // Stack strictly by recency (no pinning current chat)
  let stacked = [];
  recents.forEach(username => {
    if (usersByName[username]) stacked.push(usersByName[username]);
  });
  // Add the rest (not in recents)
  filtered.forEach(u => {
    if (!recents.includes(u.username)) stacked.push(u);
  });

  if (stacked.length === 0) {
    const li = document.createElement('li');
    li.style.cssText = 'opacity:0.5;cursor:default;font-size:0.9em;';
    li.textContent = 'No users found. Type @username to start a chat.';
    userList.appendChild(li);
    return;
  }
  stacked.forEach(u => userList.appendChild(makeUserLi(u)));
}

function makeUserLi(u, isQuickStart = false) {
  const li = document.createElement('li');
  if (currentChatUser === u.username) li.classList.add('active');

  // Avatar wrap
  const wrap = document.createElement('div');
  wrap.className = 'user-avatar-wrap';

  const avatar = document.createElement('img');
  avatar.src = u.avatar || DEFAULT_AVATAR;
  avatar.onerror = () => { avatar.src = DEFAULT_AVATAR; };
  avatar.className = 'avatar';
  wrap.appendChild(avatar);

  const dot = document.createElement('span');
  dot.className = 'avatar-status-dot';
  dot.style.background = isQuickStart ? 'var(--text-dim)' : getStatusColor(u.username);
  wrap.appendChild(dot);
  li.appendChild(wrap);

  // Info
  const info = document.createElement('div');
  info.className = 'user-info';

  const nameSpan = document.createElement('div');
  nameSpan.className = 'user-display-name';
  nameSpan.textContent = u.displayName || u.username;
  info.appendChild(nameSpan);

  const usernameSpan = document.createElement('div');
  usernameSpan.className = 'user-username';
  usernameSpan.textContent = '@' + u.username;
  info.appendChild(usernameSpan);
  li.appendChild(info);

  // Unread badge
  if (unreadCounts[u.username] > 0) {
    const badge = document.createElement('span');
    badge.className = 'unread-badge';
    badge.textContent = unreadCounts[u.username];
    li.appendChild(badge);
  }

  li.onclick = () => selectUser(u.username, li);
  return li;
}

// ─── SELECT USER ──────────────────────────────────────────────
function selectUser(username, liElem) {
  touchRecentDM(username);
  fetchAndCacheAvatar(username);
  currentChatUser = username;
  currentChatUserObj = allUsers.find(u => u.username === username) || { username, displayName: username };

  // Highlight
  document.querySelectorAll('.user-list li').forEach(li => li.classList.remove('active'));
  liElem.classList.add('active');

  // Reset unread
  unreadCounts[username] = 0;
  saveUnread();
  renderUserList();

  // Show chat panels
  document.getElementById('emptyState').style.display = 'none';
  const chatHeader = document.getElementById('chatHeader');
  const messagesArea = document.getElementById('messagesArea');
  const inputArea = document.getElementById('chatInputArea');
  chatHeader.style.display = 'flex';
  messagesArea.style.display = 'flex';
  inputArea.style.display = 'block';

  // Update header
  document.getElementById('chatHeaderName').textContent =
    (currentChatUserObj.displayName || username) + ' (@' + username + ')';
  const headerAvatar = document.getElementById('chatHeaderAvatar');
  headerAvatar.src = currentChatUserObj.avatar || DEFAULT_AVATAR;
  headerAvatar.style.display = 'block';
  updateChatHeaderStatus();

  // Clear messages, fetch and merge history from all sources
  messagesArea.innerHTML = '';
  (async () => {
    let histories = [];
    // 1. Backend
    try {
      let res = await fetch(`${CHAT_SERVER_URL}/api/messages?user=${encodeURIComponent(username)}`, {
        headers: {
          'Authorization': token ? 'Bearer ' + token : '',
          'X-Chat-User': myUsername
        }
      });
      if (res.ok) histories.push(await res.json());
    } catch (e) {}
    // 2. Localhost
    if (!CHAT_SERVER_URL.includes('localhost')) {
      try {
        let res = await fetch(`http://localhost:3000/api/messages?user=${encodeURIComponent(username)}`, {
          headers: {
            'Authorization': token ? 'Bearer ' + token : '',
            'X-Chat-User': myUsername
          }
        });
        if (res.ok) histories.push(await res.json());
      } catch (e) {}
    }
    // 3. LocalStorage
    let localKey = `chatHistory_${myUsername}_${username}`;
    let localHistory = JSON.parse(localStorage.getItem(localKey) || '[]');
    if (localHistory.length) histories.push(localHistory);

    // Merge and deduplicate by timestamp+sender+content
    let allMsgs = histories.flat();
    let seen = new Set();
    let merged = allMsgs.filter(msg => {
      let key = msg.timestamp + '|' + msg.sender + '|' + (msg.content || '') + '|' + (msg.image || '') + '|' + (msg.gif || '') + '|' + (msg.file ? msg.file.name : '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Sort by timestamp ascending
    merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Save merged history back to localStorage and backend
    localStorage.setItem(localKey, JSON.stringify(merged));
    try {
      await fetch(`${CHAT_SERVER_URL}/api/messages/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
        body: JSON.stringify({ user: myUsername, other: username, messages: merged })
      });
    } catch (e) {}
    if (!CHAT_SERVER_URL.includes('localhost')) {
      try {
        await fetch(`http://localhost:3000/api/messages/merge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
          body: JSON.stringify({ user: myUsername, other: username, messages: merged })
        });
      } catch (e) {}
    }

    if (merged.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'transient-notice';
      empty.textContent = 'No messages yet. Say hi! 👋';
      messagesArea.appendChild(empty);
    } else {
      merged.forEach(msg => appendMessage(msg, msg.sender === myUsername));
      scrollToBottom();
    }
  })().catch(() => showNotice('Could not load message history.', 'var(--red)'));

  document.getElementById('chatInput').focus();
}

function updateChatHeaderStatus() {
  const el = document.getElementById('chatHeaderStatus');
  if (!el || !currentChatUser) return;
  el.textContent = getStatusLabel(currentChatUser);
}

// ─── SEND MESSAGE ─────────────────────────────────────────────
function sendMessage() {
  if (currentGroup || currentChatUser) {
    const input = document.getElementById('chatInput');
    const content = input ? input.value.trim() : '';
    if (!currentChatUser && !currentGroup) { showNotice('Select a user or group first.', 'var(--yellow)'); return; }
    if (!content && !pendingImageDataUrl && !pendingFileData) return;
    const msg = {
      sender: myUsername,
      receiver: currentChatUser,
      group: currentGroup ? currentGroup.id : undefined,
      content: content || '',
      image: pendingImageDataUrl || null,
      file: pendingFileData && pendingFileName ? { name: pendingFileName, data: pendingFileData } : undefined,
      timestamp: new Date().toISOString()
    };
    sendMessageUniversal(msg);
    appendMessage(msg, true);
    if (input) input.value = '';
    clearFilePreview && clearFilePreview();
    clearImagePreview && clearImagePreview();
    scrollToBottom();
    autoResizeTextarea && autoResizeTextarea();
  }
}

// --- Universal message sync (backend + localStorage + Socket.io) ---
async function sendMessageUniversal(msg) {
  // Save to localStorage immediately
  let localKey = `chatHistory_${myUsername}_${msg.receiver || msg.group}`;
  let msgs = JSON.parse(localStorage.getItem(localKey) || '[]');
  msgs.push(msg);
  localStorage.setItem(localKey, JSON.stringify(msgs));

  // Try backend
  try {
    await fetch(`${CHAT_SERVER_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify(msg)
    });
  } catch (e) {
    // If offline, keep in localStorage for later sync
  }
  // Emit via Socket.io for real-time update
  if (socket && socket.connected) {
    if (msg.group) socket.emit('group_message', msg);
    else socket.emit('private_message', msg);
  }
}

async function fetchMessagesUniversal(chatId, isGroup) {
  let localMsgs = JSON.parse(localStorage.getItem(`chatHistory_${myUsername}_${chatId}`) || '[]');
  let backendMsgs = [];
  try {
    let res = await fetch(`${CHAT_SERVER_URL}/api/messages?chatId=${encodeURIComponent(chatId)}`, {
      headers: { 'Authorization': token ? 'Bearer ' + token : '' }
    });
    if (res.ok) backendMsgs = await res.json();
  } catch (e) {}
  // Merge and deduplicate by timestamp+sender+content
  let allMsgs = [...localMsgs, ...backendMsgs];
  let seen = new Set();
  let merged = allMsgs.filter(msg => {
    let key = msg.timestamp + '|' + msg.sender + '|' + (msg.content || '') + '|' + (msg.image || '') + '|' + (msg.gif || '') + '|' + (msg.file ? msg.file.name : '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Sort by timestamp ascending
  merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  // Save merged history back to localStorage
  localStorage.setItem(`chatHistory_${myUsername}_${chatId}`, JSON.stringify(merged));
  return merged;
}

// Patch sendMessage to use universal sync
const origSendMessageUniversal = sendMessage;
sendMessage = function() {
  const input = document.getElementById('chatInput');
  const content = input ? input.value.trim() : '';
  if (!currentChatUser && !currentGroup) { showNotice('Select a user or group first.', 'var(--yellow)'); return; }
  if (!content && !pendingImageDataUrl && !pendingFileData) return;
  const msg = {
    sender: myUsername,
    receiver: currentChatUser,
    group: currentGroup ? currentGroup.id : undefined,
    content: content || '',
    image: pendingImageDataUrl || null,
    file: pendingFileData && pendingFileName ? { name: pendingFileName, data: pendingFileData } : undefined,
    timestamp: new Date().toISOString()
  };
  sendMessageUniversal(msg);
  appendMessage(msg, true);
  if (input) input.value = '';
  clearFilePreview && clearFilePreview();
  clearImagePreview && clearImagePreview();
  scrollToBottom();
  autoResizeTextarea && autoResizeTextarea();
};

// Patch selectUser/selectGroup to use universal fetch
const origSelectUserUniversal = selectUser;
selectUser = async function(username, liElem) {
  origSelectUserUniversal(username, liElem);
  const area = document.getElementById('messagesArea');
  if (!area) return;
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(username, false);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
  }
};
const origSelectGroupUniversal = selectGroup;
selectGroup = async function(groupId) {
  origSelectGroupUniversal(groupId);
  const area = document.getElementById('messagesArea');
  if (!area || !currentGroup) return;
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(currentGroup.id, true);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
  }
};

// ─── CONNECTION STATUS ────────────────────────────────────────
function updateConnectionStatus(state) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (!dot || !text) return;
  const map = {
    connected:    { color: 'var(--green)',  label: 'Connected' },
    disconnected: { color: 'var(--red)',    label: 'Disconnected' },
    error:        { color: 'var(--yellow)', label: 'Reconnecting…' },
  };
  const s = map[state] || map.error;
  dot.style.background = s.color;
  text.textContent = s.label;
}

// ─── USER LIST ────────────────────────────────────────────────
function getStatusColor(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'var(--green)';
  if (st === 'dnd')    return 'var(--red)';
  if (st === 'away')   return 'var(--yellow)';
  return 'var(--text-dim)';
}

function getStatusLabel(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'Online';
  if (st === 'dnd')    return 'Do Not Disturb';
  if (st === 'away')   return 'Away';
  return 'Offline';
}

function renderUserList() {
  const userList = document.getElementById('userList');
  if (!userList) return;
  userList.innerHTML = '';

  let recents = getRecentDMs();
  let usersByName = Object.fromEntries(allUsers.map(u => [u.username, u]));
  let filtered = allUsers.filter(u => u.username !== myUsername);

  // If searching, show search results at top, else show recents at top
  if (userSearch.startsWith('@')) {
    const term = userSearch.slice(1).toLowerCase();
    filtered = filtered.filter(u =>
      u.username.toLowerCase().includes(term) ||
      (u.displayName && u.displayName.toLowerCase().includes(term))
    );
    // If not found, allow quick start
    if (filtered.length === 0) {
      const typed = userSearch.slice(1).trim();
      if (typed && typed !== myUsername) {
        const li = makeUserLi({ username: typed, displayName: typed }, true);
        userList.appendChild(li);
      }
      return;
    }
    filtered.forEach(u => userList.appendChild(makeUserLi(u)));
    return;
  }

  // Stack strictly by recency (no pinning current chat)
  let stacked = [];
  recents.forEach(username => {
    if (usersByName[username]) stacked.push(usersByName[username]);
  });
  // Add the rest (not in recents)
  filtered.forEach(u => {
    if (!recents.includes(u.username)) stacked.push(u);
  });

  if (stacked.length === 0) {
    const li = document.createElement('li');
    li.style.cssText = 'opacity:0.5;cursor:default;font-size:0.9em;';
    li.textContent = 'No users found. Type @username to start a chat.';
    userList.appendChild(li);
    return;
  }
  stacked.forEach(u => userList.appendChild(makeUserLi(u)));
}

function makeUserLi(u, isQuickStart = false) {
  const li = document.createElement('li');
  if (currentChatUser === u.username) li.classList.add('active');

  // Avatar wrap
  const wrap = document.createElement('div');
  wrap.className = 'user-avatar-wrap';

  const avatar = document.createElement('img');
  avatar.src = u.avatar || DEFAULT_AVATAR;
  avatar.onerror = () => { avatar.src = DEFAULT_AVATAR; };
  avatar.className = 'avatar';
  wrap.appendChild(avatar);

  const dot = document.createElement('span');
  dot.className = 'avatar-status-dot';
  dot.style.background = isQuickStart ? 'var(--text-dim)' : getStatusColor(u.username);
  wrap.appendChild(dot);
  li.appendChild(wrap);

  // Info
  const info = document.createElement('div');
  info.className = 'user-info';

  const nameSpan = document.createElement('div');
  nameSpan.className = 'user-display-name';
  nameSpan.textContent = u.displayName || u.username;
  info.appendChild(nameSpan);

  const usernameSpan = document.createElement('div');
  usernameSpan.className = 'user-username';
  usernameSpan.textContent = '@' + u.username;
  info.appendChild(usernameSpan);
  li.appendChild(info);

  // Unread badge
  if (unreadCounts[u.username] > 0) {
    const badge = document.createElement('span');
    badge.className = 'unread-badge';
    badge.textContent = unreadCounts[u.username];
    li.appendChild(badge);
  }

  li.onclick = () => selectUser(u.username, li);
  return li;
}

// ─── SELECT USER ──────────────────────────────────────────────
function selectUser(username, liElem) {
  touchRecentDM(username);
  fetchAndCacheAvatar(username);
  currentChatUser = username;
  currentChatUserObj = allUsers.find(u => u.username === username) || { username, displayName: username };

  // Highlight
  document.querySelectorAll('.user-list li').forEach(li => li.classList.remove('active'));
  liElem.classList.add('active');

  // Reset unread
  unreadCounts[username] = 0;
  saveUnread();
  renderUserList();

  // Show chat panels
  document.getElementById('emptyState').style.display = 'none';
  const chatHeader = document.getElementById('chatHeader');
  const messagesArea = document.getElementById('messagesArea');
  const inputArea = document.getElementById('chatInputArea');
  chatHeader.style.display = 'flex';
  messagesArea.style.display = 'flex';
  inputArea.style.display = 'block';

  // Update header
  document.getElementById('chatHeaderName').textContent =
    (currentChatUserObj.displayName || username) + ' (@' + username + ')';
  const headerAvatar = document.getElementById('chatHeaderAvatar');
  headerAvatar.src = currentChatUserObj.avatar || DEFAULT_AVATAR;
  headerAvatar.style.display = 'block';
  updateChatHeaderStatus();

  // Clear messages, fetch and merge history from all sources
  messagesArea.innerHTML = '';
  (async () => {
    let histories = [];
    // 1. Backend
    try {
      let res = await fetch(`${CHAT_SERVER_URL}/api/messages?user=${encodeURIComponent(username)}`, {
        headers: {
          'Authorization': token ? 'Bearer ' + token : '',
          'X-Chat-User': myUsername
        }
      });
      if (res.ok) histories.push(await res.json());
    } catch (e) {}
    // 2. Localhost
    if (!CHAT_SERVER_URL.includes('localhost')) {
      try {
        let res = await fetch(`http://localhost:3000/api/messages?user=${encodeURIComponent(username)}`, {
          headers: {
            'Authorization': token ? 'Bearer ' + token : '',
            'X-Chat-User': myUsername
          }
        });
        if (res.ok) histories.push(await res.json());
      } catch (e) {}
    }
    // 3. LocalStorage
    let localKey = `chatHistory_${myUsername}_${username}`;
    let localHistory = JSON.parse(localStorage.getItem(localKey) || '[]');
    if (localHistory.length) histories.push(localHistory);

    // Merge and deduplicate by timestamp+sender+content
    let allMsgs = histories.flat();
    let seen = new Set();
    let merged = allMsgs.filter(msg => {
      let key = msg.timestamp + '|' + msg.sender + '|' + (msg.content || '') + '|' + (msg.image || '') + '|' + (msg.gif || '') + '|' + (msg.file ? msg.file.name : '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Sort by timestamp ascending
    merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Save merged history back to localStorage and backend
    localStorage.setItem(localKey, JSON.stringify(merged));
    try {
      await fetch(`${CHAT_SERVER_URL}/api/messages/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
        body: JSON.stringify({ user: myUsername, other: username, messages: merged })
      });
    } catch (e) {}
    if (!CHAT_SERVER_URL.includes('localhost')) {
      try {
        await fetch(`http://localhost:3000/api/messages/merge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
          body: JSON.stringify({ user: myUsername, other: username, messages: merged })
        });
      } catch (e) {}
    }

    if (merged.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'transient-notice';
      empty.textContent = 'No messages yet. Say hi! 👋';
      messagesArea.appendChild(empty);
    } else {
      merged.forEach(msg => appendMessage(msg, msg.sender === myUsername));
      scrollToBottom();
    }
  })().catch(() => showNotice('Could not load message history.', 'var(--red)'));

  document.getElementById('chatInput').focus();
}

function updateChatHeaderStatus() {
  const el = document.getElementById('chatHeaderStatus');
  if (!el || !currentChatUser) return;
  el.textContent = getStatusLabel(currentChatUser);
}

// ─── SEND MESSAGE ─────────────────────────────────────────────
function sendMessage() {
  if (currentGroup || currentChatUser) {
    const input = document.getElementById('chatInput');
    const content = input ? input.value.trim() : '';
    if (!currentChatUser && !currentGroup) { showNotice('Select a user or group first.', 'var(--yellow)'); return; }
    if (!content && !pendingImageDataUrl && !pendingFileData) return;
    const msg = {
      sender: myUsername,
      receiver: currentChatUser,
      group: currentGroup ? currentGroup.id : undefined,
      content: content || '',
      image: pendingImageDataUrl || null,
      file: pendingFileData && pendingFileName ? { name: pendingFileName, data: pendingFileData } : undefined,
      timestamp: new Date().toISOString()
    };
    sendMessageUniversal(msg);
    appendMessage(msg, true);
    if (input) input.value = '';
    clearFilePreview && clearFilePreview();
    clearImagePreview && clearImagePreview();
    scrollToBottom();
    autoResizeTextarea && autoResizeTextarea();
  }
}

// --- Universal message sync (backend + localStorage + Socket.io) ---
async function sendMessageUniversal(msg) {
  // Save to localStorage immediately
  let localKey = `chatHistory_${myUsername}_${msg.receiver || msg.group}`;
  let msgs = JSON.parse(localStorage.getItem(localKey) || '[]');
  msgs.push(msg);
  localStorage.setItem(localKey, JSON.stringify(msgs));

  // Try backend
  try {
    await fetch(`${CHAT_SERVER_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify(msg)
    });
  } catch (e) {
    // If offline, keep in localStorage for later sync
  }
  // Emit via Socket.io for real-time update
  if (socket && socket.connected) {
    if (msg.group) socket.emit('group_message', msg);
    else socket.emit('private_message', msg);
  }
}

async function fetchMessagesUniversal(chatId, isGroup) {
  let localMsgs = JSON.parse(localStorage.getItem(`chatHistory_${myUsername}_${chatId}`) || '[]');
  let backendMsgs = [];
  try {
    let res = await fetch(`${CHAT_SERVER_URL}/api/messages?chatId=${encodeURIComponent(chatId)}`, {
      headers: { 'Authorization': token ? 'Bearer ' + token : '' }
    });
    if (res.ok) backendMsgs = await res.json();
  } catch (e) {}
  // Merge and deduplicate by timestamp+sender+content
  let allMsgs = [...localMsgs, ...backendMsgs];
  let seen = new Set();
  let merged = allMsgs.filter(msg => {
    let key = msg.timestamp + '|' + msg.sender + '|' + (msg.content || '') + '|' + (msg.image || '') + '|' + (msg.gif || '') + '|' + (msg.file ? msg.file.name : '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Sort by timestamp ascending
  merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  // Save merged history back to localStorage
  localStorage.setItem(`chatHistory_${myUsername}_${chatId}`, JSON.stringify(merged));
  return merged;
}

// Patch sendMessage to use universal sync
const origSendMessageUniversal = sendMessage;
sendMessage = function() {
  const input = document.getElementById('chatInput');
  const content = input ? input.value.trim() : '';
  if (!currentChatUser && !currentGroup) { showNotice('Select a user or group first.', 'var(--yellow)'); return; }
  if (!content && !pendingImageDataUrl && !pendingFileData) return;
  const msg = {
    sender: myUsername,
    receiver: currentChatUser,
    group: currentGroup ? currentGroup.id : undefined,
    content: content || '',
    image: pendingImageDataUrl || null,
    file: pendingFileData && pendingFileName ? { name: pendingFileName, data: pendingFileData } : undefined,
    timestamp: new Date().toISOString()
  };
  sendMessageUniversal(msg);
  appendMessage(msg, true);
  if (input) input.value = '';
  clearFilePreview && clearFilePreview();
  clearImagePreview && clearImagePreview();
  scrollToBottom();
  autoResizeTextarea && autoResizeTextarea();
};

// Patch selectUser/selectGroup to use universal fetch
const origSelectUserUniversal = selectUser;
selectUser = async function(username, liElem) {
  origSelectUserUniversal(username, liElem);
  const area = document.getElementById('messagesArea');
  if (!area) return;
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(username, false);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
  }
};
const origSelectGroupUniversal = selectGroup;
selectGroup = async function(groupId) {
  origSelectGroupUniversal(groupId);
  const area = document.getElementById('messagesArea');
  if (!area || !currentGroup) return;
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(currentGroup.id, true);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
  }
};

// ─── CONNECTION STATUS ────────────────────────────────────────
function updateConnectionStatus(state) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (!dot || !text) return;
  const map = {
    connected:    { color: 'var(--green)',  label: 'Connected' },
    disconnected: { color: 'var(--red)',    label: 'Disconnected' },
    error:        { color: 'var(--yellow)', label: 'Reconnecting…' },
  };
  const s = map[state] || map.error;
  dot.style.background = s.color;
  text.textContent = s.label;
}

// ─── USER LIST ────────────────────────────────────────────────
function getStatusColor(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'var(--green)';
  if (st === 'dnd')    return 'var(--red)';
  if (st === 'away')   return 'var(--yellow)';
  return 'var(--text-dim)';
}

function getStatusLabel(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'Online';
  if (st === 'dnd')    return 'Do Not Disturb';
  if (st === 'away')   return 'Away';
  return 'Offline';
}

function renderUserList() {
  const userList = document.getElementById('userList');
  if (!userList) return;
  userList.innerHTML = '';

  let recents = getRecentDMs();
  let usersByName = Object.fromEntries(allUsers.map(u => [u.username, u]));
  let filtered = allUsers.filter(u => u.username !== myUsername);

  // If searching, show search results at top, else show recents at top
  if (userSearch.startsWith('@')) {
    const term = userSearch.slice(1).toLowerCase();
    filtered = filtered.filter(u =>
      u.username.toLowerCase().includes(term) ||
      (u.displayName && u.displayName.toLowerCase().includes(term))
    );
    // If not found, allow quick start
    if (filtered.length === 0) {
      const typed = userSearch.slice(1).trim();
      if (typed && typed !== myUsername) {
        const li = makeUserLi({ username: typed, displayName: typed }, true);
        userList.appendChild(li);
      }
      return;
    }
    filtered.forEach(u => userList.appendChild(makeUserLi(u)));
    return;
  }

  // Stack strictly by recency (no pinning current chat)
  let stacked = [];
  recents.forEach(username => {
    if (usersByName[username]) stacked.push(usersByName[username]);
  });
  // Add the rest (not in recents)
  filtered.forEach(u => {
    if (!recents.includes(u.username)) stacked.push(u);
  });

  if (stacked.length === 0) {
    const li = document.createElement('li');
    li.style.cssText = 'opacity:0.5;cursor:default;font-size:0.9em;';
    li.textContent = 'No users found. Type @username to start a chat.';
    userList.appendChild(li);
    return;
  }
  stacked.forEach(u => userList.appendChild(makeUserLi(u)));
}

function makeUserLi(u, isQuickStart = false) {
  const li = document.createElement('li');
  if (currentChatUser === u.username) li.classList.add('active');

  // Avatar wrap
  const wrap = document.createElement('div');
  wrap.className = 'user-avatar-wrap';

  const avatar = document.createElement('img');
  avatar.src = u.avatar || DEFAULT_AVATAR;
  avatar.onerror = () => { avatar.src = DEFAULT_AVATAR; };
  avatar.className = 'avatar';
  wrap.appendChild(avatar);

  const dot = document.createElement('span');
  dot.className = 'avatar-status-dot';
  dot.style.background = isQuickStart ? 'var(--text-dim)' : getStatusColor(u.username);
  wrap.appendChild(dot);
  li.appendChild(wrap);

  // Info
  const info = document.createElement('div');
  info.className = 'user-info';

  const nameSpan = document.createElement('div');
  nameSpan.className = 'user-display-name';
  nameSpan.textContent = u.displayName || u.username;
  info.appendChild(nameSpan);

  const usernameSpan = document.createElement('div');
  usernameSpan.className = 'user-username';
  usernameSpan.textContent = '@' + u.username;
  info.appendChild(usernameSpan);
  li.appendChild(info);

  // Unread badge
  if (unreadCounts[u.username] > 0) {
    const badge = document.createElement('span');
    badge.className = 'unread-badge';
    badge.textContent = unreadCounts[u.username];
    li.appendChild(badge);
  }

  li.onclick = () => selectUser(u.username, li);
  return li;
}

// ─── SELECT USER ──────────────────────────────────────────────
function selectUser(username, liElem) {
  touchRecentDM(username);
  fetchAndCacheAvatar(username);
  currentChatUser = username;
  currentChatUserObj = allUsers.find(u => u.username === username) || { username, displayName: username };

  // Highlight
  document.querySelectorAll('.user-list li').forEach(li => li.classList.remove('active'));
  liElem.classList.add('active');

  // Reset unread
  unreadCounts[username] = 0;
  saveUnread();
  renderUserList();

  // Show chat panels
  document.getElementById('emptyState').style.display = 'none';
  const chatHeader = document.getElementById('chatHeader');
  const messagesArea = document.getElementById('messagesArea');
  const inputArea = document.getElementById('chatInputArea');
  chatHeader.style.display = 'flex';
  messagesArea.style.display = 'flex';
  inputArea.style.display = 'block';

  // Update header
  document.getElementById('chatHeaderName').textContent =
    (currentChatUserObj.displayName || username) + ' (@' + username + ')';
  const headerAvatar = document.getElementById('chatHeaderAvatar');
  headerAvatar.src = currentChatUserObj.avatar || DEFAULT_AVATAR;
  headerAvatar.style.display = 'block';
  updateChatHeaderStatus();

  // Clear messages, fetch and merge history from all sources
  messagesArea.innerHTML = '';
  (async () => {
    let histories = [];
    // 1. Backend
    try {
      let res = await fetch(`${CHAT_SERVER_URL}/api/messages?user=${encodeURIComponent(username)}`, {
        headers: {
          'Authorization': token ? 'Bearer ' + token : '',
          'X-Chat-User': myUsername
        }
      });
      if (res.ok) histories.push(await res.json());
    } catch (e) {}
    // 2. Localhost
    if (!CHAT_SERVER_URL.includes('localhost')) {
      try {
        let res = await fetch(`http://localhost:3000/api/messages?user=${encodeURIComponent(username)}`, {
          headers: {
            'Authorization': token ? 'Bearer ' + token : '',
            'X-Chat-User': myUsername
          }
        });
        if (res.ok) histories.push(await res.json());
      } catch (e) {}
    }
    // 3. LocalStorage
    let localKey = `chatHistory_${myUsername}_${username}`;
    let localHistory = JSON.parse(localStorage.getItem(localKey) || '[]');
    if (localHistory.length) histories.push(localHistory);

    // Merge and deduplicate by timestamp+sender+content
    let allMsgs = histories.flat();
    let seen = new Set();
    let merged = allMsgs.filter(msg => {
      let key = msg.timestamp + '|' + msg.sender + '|' + (msg.content || '') + '|' + (msg.image || '') + '|' + (msg.gif || '') + '|' + (msg.file ? msg.file.name : '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Sort by timestamp ascending
    merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Save merged history back to localStorage and backend
    localStorage.setItem(localKey, JSON.stringify(merged));
    try {
      await fetch(`${CHAT_SERVER_URL}/api/messages/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
        body: JSON.stringify({ user: myUsername, other: username, messages: merged })
      });
    } catch (e) {}
    if (!CHAT_SERVER_URL.includes('localhost')) {
      try {
        await fetch(`http://localhost:3000/api/messages/merge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
          body: JSON.stringify({ user: myUsername, other: username, messages: merged })
        });
      } catch (e) {}
    }

    if (merged.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'transient-notice';
      empty.textContent = 'No messages yet. Say hi! 👋';
      messagesArea.appendChild(empty);
    } else {
      merged.forEach(msg => appendMessage(msg, msg.sender === myUsername));
      scrollToBottom();
    }
  })().catch(() => showNotice('Could not load message history.', 'var(--red)'));

  document.getElementById('chatInput').focus();
}

function updateChatHeaderStatus() {
  const el = document.getElementById('chatHeaderStatus');
  if (!el || !currentChatUser) return;
  el.textContent = getStatusLabel(currentChatUser);
}

// ─── SEND MESSAGE ─────────────────────────────────────────────
function sendMessage() {
  if (currentGroup || currentChatUser) {
    const input = document.getElementById('chatInput');
    const content = input ? input.value.trim() : '';
    if (!currentChatUser && !currentGroup) { showNotice('Select a user or group first.', 'var(--yellow)'); return; }
    if (!content && !pendingImageDataUrl && !pendingFileData) return;
    const msg = {
      sender: myUsername,
      receiver: currentChatUser,
      group: currentGroup ? currentGroup.id : undefined,
      content: content || '',
      image: pendingImageDataUrl || null,
      file: pendingFileData && pendingFileName ? { name: pendingFileName, data: pendingFileData } : undefined,
      timestamp: new Date().toISOString()
    };
    sendMessageUniversal(msg);
    appendMessage(msg, true);
    if (input) input.value = '';
    clearFilePreview && clearFilePreview();
    clearImagePreview && clearImagePreview();
    scrollToBottom();
    autoResizeTextarea && autoResizeTextarea();
  }
}

// --- Universal message sync (backend + localStorage + Socket.io) ---
async function sendMessageUniversal(msg) {
  // Save to localStorage immediately
  let localKey = `chatHistory_${myUsername}_${msg.receiver || msg.group}`;
  let msgs = JSON.parse(localStorage.getItem(localKey) || '[]');
  msgs.push(msg);
  localStorage.setItem(localKey, JSON.stringify(msgs));

  // Try backend
  try {
    await fetch(`${CHAT_SERVER_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify(msg)
    });
  } catch (e) {
    // If offline, keep in localStorage for later sync
  }
  // Emit via Socket.io for real-time update
  if (socket && socket.connected) {
    if (msg.group) socket.emit('group_message', msg);
    else socket.emit('private_message', msg);
  }
}

async function fetchMessagesUniversal(chatId, isGroup) {
  let localMsgs = JSON.parse(localStorage.getItem(`chatHistory_${myUsername}_${chatId}`) || '[]');
  let backendMsgs = [];
  try {
    let res = await fetch(`${CHAT_SERVER_URL}/api/messages?chatId=${encodeURIComponent(chatId)}`, {
      headers: { 'Authorization': token ? 'Bearer ' + token : '' }
    });
    if (res.ok) backendMsgs = await res.json();
  } catch (e) {}
  // Merge and deduplicate by timestamp+sender+content
  let allMsgs = [...localMsgs, ...backendMsgs];
  let seen = new Set();
  let merged = allMsgs.filter(msg => {
    let key = msg.timestamp + '|' + msg.sender + '|' + (msg.content || '') + '|' + (msg.image || '') + '|' + (msg.gif || '') + '|' + (msg.file ? msg.file.name : '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Sort by timestamp ascending
  merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  // Save merged history back to localStorage
  localStorage.setItem(`chatHistory_${myUsername}_${chatId}`, JSON.stringify(merged));
  return merged;
}

// Patch sendMessage to use universal sync
const origSendMessageUniversal = sendMessage;
sendMessage = function() {
  const input = document.getElementById('chatInput');
  const content = input ? input.value.trim() : '';
  if (!currentChatUser && !currentGroup) { showNotice('Select a user or group first.', 'var(--yellow)'); return; }
  if (!content && !pendingImageDataUrl && !pendingFileData) return;
  const msg = {
    sender: myUsername,
    receiver: currentChatUser,
    group: currentGroup ? currentGroup.id : undefined,
    content: content || '',
    image: pendingImageDataUrl || null,
    file: pendingFileData && pendingFileName ? { name: pendingFileName, data: pendingFileData } : undefined,
    timestamp: new Date().toISOString()
  };
  sendMessageUniversal(msg);
  appendMessage(msg, true);
  if (input) input.value = '';
  clearFilePreview && clearFilePreview();
  clearImagePreview && clearImagePreview();
  scrollToBottom();
  autoResizeTextarea && autoResizeTextarea();
};

// Patch selectUser/selectGroup to use universal fetch
const origSelectUserUniversal = selectUser;
selectUser = async function(username, liElem) {
  origSelectUserUniversal(username, liElem);
  const area = document.getElementById('messagesArea');
  if (!area) return;
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(username, false);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
  }
};
const origSelectGroupUniversal = selectGroup;
selectGroup = async function(groupId) {
  origSelectGroupUniversal(groupId);
  const area = document.getElementById('messagesArea');
  if (!area || !currentGroup) return;
  area.innerHTML = '';
  let msgs = await fetchMessagesUniversal(currentGroup.id, true);
  if (msgs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'transient-notice';
    empty.textContent = 'No messages yet. Say hi! 👋';
    area.appendChild(empty);
  } else {
    msgs.forEach(msg => appendMessage(msg, msg.sender === myUsername));
  }
};

// ─── CONNECTION STATUS ────────────────────────────────────────
function updateConnectionStatus(state) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (!dot || !text) return;
  const map = {
    connected:    { color: 'var(--green)',  label: 'Connected' },
    disconnected: { color: 'var(--red)',    label: 'Disconnected' },
    error:        { color: 'var(--yellow)', label: 'Reconnecting…' },
  };
  const s = map[state] || map.error;
  dot.style.background = s.color;
  text.textContent = s.label;
}

// ─── USER LIST ────────────────────────────────────────────────
function getStatusColor(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'var(--green)';
  if (st === 'dnd')    return 'var(--red)';
  if (st === 'away')   return 'var(--yellow)';
  return 'var(--text-dim)';
}

function getStatusLabel(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'Online';
  if (st === 'dnd')    return 'Do Not Disturb';
  if (st === 'away')   return 'Away';
  return 'Offline';
}

function renderUserList() {
  const userList = document.getElementById('userList');
  if (!userList) return;
  userList.innerHTML = '';

  let recents = getRecentDMs();
  let usersByName = Object.fromEntries(allUsers.map(u => [u.username, u]));
  let filtered = allUsers.filter(u => u.username !== myUsername);

  // If searching, show search results at top, else show recents at top
  if (userSearch.startsWith('@')) {
    const term = userSearch.slice(1).toLowerCase();
    filtered = filtered.filter(u =>
      u.username.toLowerCase().includes(term) ||
      (u.displayName && u.displayName.toLowerCase().includes(term))
    );
    // If not found, allow quick start
    if (filtered.length === 0) {
      const typed = userSearch.slice(1).trim();
      if (typed && typed !== myUsername) {
        const li = makeUserLi({ username: typed, displayName: typed }, true);
        userList.appendChild(li);
      }
      return;
    }
    filtered.forEach(u => userList.appendChild(makeUserLi(u)));
    return;
  }

  // Stack strictly by recency (no pinning current chat)
  let stacked = [];
  recents.forEach(username => {
    if (usersByName[username]) stacked.push(usersByName[username]);
  });
  // Add the rest (not in recents)
  filtered.forEach(u => {
    if (!recents.includes(u.username)) stacked.push(u);
  });

  if (stacked.length === 0) {
    const li = document.createElement('li');
    li.style.cssText = 'opacity:0.5;cursor:default;font-size:0.9em;';
    li.textContent = 'No users found. Type @username to start a chat.';
    userList.appendChild(li);
    return;
  }
  stacked.forEach(u => userList.appendChild(makeUserLi(u)));
}

function makeUserLi(u, isQuickStart = false) {
  const li = document.createElement('li');
  if (currentChatUser === u.username) li.classList.add('active');

  // Avatar wrap
  const wrap = document.createElement('div');
  wrap.className = 'user-avatar-wrap';

  const avatar = document.createElement('img');
  avatar.src = u.avatar || DEFAULT_AVATAR;
  avatar.onerror = () => { avatar.src = DEFAULT_AVATAR; };
  avatar.className = 'avatar';
  wrap.appendChild(avatar);

  const dot = document.createElement('span');
  dot.className = 'avatar-status-dot';
  dot.style.background = isQuickStart ? 'var(--text-dim)' : getStatusColor(u.username);
  wrap.appendChild(dot);
  li.appendChild(wrap);

  // Info
  const info = document.createElement('div');
  info.className = 'user-info';

  const nameSpan = document.createElement('div');
  nameSpan.className = 'user-display-name';
  nameSpan.textContent = u.displayName || u.username;
  info.appendChild(nameSpan);

  const usernameSpan = document.createElement('div');
  usernameSpan.className = 'user-username';
  usernameSpan.textContent = '@' + u.username;
  info.appendChild(usernameSpan);
  li.appendChild(info);

  // Unread badge
  if (unreadCounts[u.username] > 0) {
    const badge = document.createElement('span');
    badge.className = 'unread-badge';
    badge.textContent = unreadCounts[u.username];
    li.appendChild(badge);
  }

  li.onclick = () => selectUser(u.username, li);
  return li;
}

// ─── SELECT USER ──────────────────────────────────────────────
function selectUser(username, liElem) {
  touchRecentDM(username);
  fetchAndCacheAvatar(username);
  currentChatUser = username;
  currentChatUserObj = allUsers.find(u => u.username === username) || { username, displayName: username };

  // Highlight
  document.querySelectorAll('.user-list li').forEach(li => li.classList.remove('active'));
  liElem.classList.add('active');

  // Reset unread
  unreadCounts[username] = 0;
  saveUnread();
  renderUserList();

  // Show chat panels
  document.getElementById('emptyState').style.display = 'none';
  const chatHeader = document.getElementById('chatHeader');
  const messagesArea = document.getElementById('messagesArea');
  const inputArea = document.getElementById('chatInputArea');
  chatHeader.style.display = 'flex';
  messagesArea.style.display = 'flex';
  inputArea.style.display = 'block';

  // Update header
  document.getElementById('chatHeaderName').textContent =
    (currentChatUserObj.displayName || username) + ' (@' + username + ')';
  const headerAvatar = document.getElementById('chatHeaderAvatar');
  headerAvatar.src = currentChatUserObj.avatar || DEFAULT_AVATAR;
  headerAvatar.style.display = 'block';
  updateChatHeaderStatus();

  // Clear messages, fetch and merge history from all sources
  messagesArea.innerHTML = '';
  (async () => {
    let histories = [];
    // 1. Backend
    try {
      let res = await fetch(`${CHAT_SERVER_URL}/api/messages?user=${encodeURIComponent(username)}`, {
        headers: {
          'Authorization': token ? 'Bearer ' + token : '',
          'X-Chat-User': myUsername
        }
      });
      if (res.ok) histories.push(await res.json());
    } catch (e) {}
    // 2. Localhost
    if (!CHAT_SERVER_URL.includes('localhost')) {
      try {
        let res = await fetch(`http://localhost:3000/api/messages?user=${encodeURIComponent(username)}`, {
          headers: {
            'Authorization': token ? 'Bearer ' + token : '',
            'X-Chat-User': myUsername
          }
        });
        if (res.ok) histories.push(await res.json());
      } catch (e) {}
    }
    // 3. LocalStorage
    let localKey = `chatHistory_${myUsername}_${username}`;
    let localHistory = JSON.parse(localStorage.getItem(localKey) || '[]');
    if (localHistory.length) histories.push(localHistory);

    // Merge and deduplicate by timestamp+sender+content
    let allMsgs = histories.flat();
    let seen = new Set();
    let merged = allMsgs.filter(msg => {
      let key = msg.timestamp + '|' + msg.sender + '|' + (msg.content || '') + '|' + (msg.image || '') + '|' + (msg.gif || '') + '|' + (msg.file ? msg.file.name : '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Sort by timestamp ascending
    merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Save merged history back to localStorage and backend
    localStorage.setItem(localKey, JSON.stringify(merged));
    try {
      await fetch(`${CHAT_SERVER_URL}/api/messages/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },