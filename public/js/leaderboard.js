// Leaderboard frontend logic for leaderboard.html
// Fetches leaderboard from backend and renders clickable users

document.addEventListener('DOMContentLoaded', function() {
  fetch(window.location.origin + '/api/leaderboard')
    .then(res => res.json())
    .then(users => {
      const list = document.getElementById('leaderboardList');
      if (!list) return;
      if (!users.length) {
        // Show 3 premium-styled placeholders
        list.innerHTML = [1,2,3].map((i) => `
          <div class="leaderboard-user" style="display:flex;align-items:center;gap:18px;padding:18px 0 18px 0;margin:18px 0;border-radius:18px;background:linear-gradient(90deg,#232046 60%,#393053 100%);box-shadow:0 2px 16px #0006;border:2px solid #ffd70033;">
            <span class="leaderboard-rank" style="font-size:1.5em;font-weight:700;width:38px;text-align:center;color:#ffd700;">${i}</span>
            <div style="width:54px;height:54px;border-radius:50%;background:#222;display:flex;align-items:center;justify-content:center;border:2px solid #ffd700;">
              <span style="font-size:2em;">👤</span>
            </div>
            <span class="leaderboard-username" style="font-size:1.18em;font-weight:600;color:#fff;opacity:0.7;">Premium User</span>
            <span class="leaderboard-followers" style="margin-left:auto;font-size:1.08em;color:#ffd700;opacity:0.7;">0 followers</span>
          </div>
        `).join('') + `<div style='text-align:center;color:#bbb;font-size:1.1em;margin:2em 0;'><span style='font-size:2em;'>😶</span><br>No users on the leaderboard yet.<br><span style='font-size:0.95em;opacity:0.7;'>(Sign up and become the first!)</span></div>`;
        return;
      }
      list.innerHTML = users.map((u, i) => `
        <div class="leaderboard-user" style="display:flex;align-items:center;gap:18px;padding:18px 0 18px 0;margin:18px 0;border-radius:18px;background:linear-gradient(90deg,#232046 60%,#393053 100%);box-shadow:0 2px 16px #0006;border:2px solid #ffd70033;">
          <span class="leaderboard-rank" style="font-size:1.5em;font-weight:700;width:38px;text-align:center;color:#ffd700;">${i+1}</span>
          <a href="public-profile.html?user=${encodeURIComponent(u.username)}">
            <img class="leaderboard-avatar" src="${u.avatar || 'png/logo2.png'}" alt="Avatar" style="width:54px;height:54px;border-radius:50%;border:2px solid #ffd700;background:#fff;">
          </a>
          <a href="public-profile.html?user=${encodeURIComponent(u.username)}" class="leaderboard-username" style="font-size:1.18em;font-weight:600;color:#fff;text-decoration:none;">
            @${u.username}
            <span style="display:inline-block;background:#ffd700;color:#222;font-size:0.85em;font-weight:700;padding:2px 10px 2px 8px;border-radius:12px;margin-left:8px;vertical-align:middle;box-shadow:0 1px 6px #ffd70055;">PREMIUM</span>
          </a>
          <span class="leaderboard-followers" style="margin-left:auto;font-size:1.08em;color:#ffd700;">${u.followers || 0} followers</span>
        </div>
      `).join('');
    });
});
