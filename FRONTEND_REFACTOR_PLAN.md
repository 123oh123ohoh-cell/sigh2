# Frontend Refactor Plan: Universal Sync & Persistence

## 1. Universal Data Sync
- For every feature (messages, groups, pins, blocks, mutes, reactions, edits, etc.):
  - Always try backend API first (with token/IP)
  - Fallback to localStorage if backend is unavailable
  - On load, fetch from both backend and localStorage, merge, and display
  - On reconnect, sync local changes to backend
  - Use Socket.io for real-time updates for all features

## 2. User/Session Identification
- Use JWT token or unique userID for all API and Socket.io calls
- Store in localStorage and send with every request

## 3. Example: Universal Message Send
```js
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
  if (socket && socket.connected) socket.emit('private_message', msg);
}
```

## 4. Example: Universal Fetch/Merge
```js
async function fetchMessagesUniversal(chatId) {
  let localMsgs = JSON.parse(localStorage.getItem(`chatHistory_${myUsername}_${chatId}`) || '[]');
  let backendMsgs = [];
  try {
    let res = await fetch(`${CHAT_SERVER_URL}/api/messages?chat=${encodeURIComponent(chatId)}`, {
      headers: { 'Authorization': token ? 'Bearer ' + token : '' }
    });
    if (res.ok) backendMsgs = await res.json();
  } catch (e) {}
  // Merge and deduplicate
  let allMsgs = [...localMsgs, ...backendMsgs];
  // ...deduplication logic...
  return allMsgs;
}
```

## 5. Repeat for All Features
- Pins, blocks, mutes, reactions, edits, deletions, group management, etc.
- Always sync to both backend and localStorage
- Always merge on load and on reconnect

## 6. Socket.io
- Listen for all real-time events (messages, edits, pins, blocks, etc.)
- Update UI and localStorage on every event

---

**Next: Begin updating your frontend code for universal sync, starting with messages.**
