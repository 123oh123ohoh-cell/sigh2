// Leaderboard frontend logic for leaderboard.pug
// Fetches leaderboard from backend and renders clickable users

document.addEventListener('DOMContentLoaded', function() {
  fetch('/api/leaderboard')
    .then(res => res.json())
    .then(users => {
      const list = document.getElementById('leaderboardList');
      if (!list) return;
      if (!users.length) {
        list.innerHTML = '<p style="color:#bbb;text-align:center;">No users yet.</p>';
        return;
      }
      list.innerHTML = users.map((u, i) => `
        <div class="leaderboard-user">
          <span class="leaderboard-rank">${i+1}</span>
          <a href="public-profile.html?user=${encodeURIComponent(u.username)}">
            <img class="leaderboard-avatar" src="${u.avatar || '../png/logo2.png'}" alt="Avatar">
          </a>
          <a href="public-profile.html?user=${encodeURIComponent(u.username)}" class="leaderboard-username">${u.displayName || u.username}</a>
          <span class="leaderboard-followers">${u.followers || 0} followers</span>
        </div>
      `).join('');
    });
});
