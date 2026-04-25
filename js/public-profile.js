// Parse ?user=username from URL
function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

const username = getQueryParam('user');
const loggedInUser = localStorage.getItem('loggedInUser');
const token = localStorage.getItem('token');

const profileTitle = document.getElementById('profileTitle');
const infoDiv = document.getElementById('publicProfileInfo');
const editBtnDiv = document.getElementById('editProfileBtnContainer');
const followBtnDiv = document.getElementById('followBtnContainer');

if (!username) {
    infoDiv.innerHTML = '<p>No user specified.</p>';
} else {
    profileTitle.textContent = `@${username}`;
    fetch(`https://ownshub.onrender.com/api/profile?user=${encodeURIComponent(username)}`)
        .then(res => res.json())
        .then(data => {
            // If no profile, show default
            if (!data || Object.keys(data).length === 0) {
                data = {
                    displayName: username,
                    pronouns: '',
                    customPronouns: '',
                    bio: '',
                    avatar: ''
                };
            }
            let pronouns = data.pronouns === 'custom' ? data.customPronouns : data.pronouns;
            // Default avatar SVG (circle with user icon)
            const defaultAvatar = `<svg width="110" height="110" viewBox="0 0 110 110" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="55" cy="55" r="54" fill="#e0e0e0" stroke="#fff" stroke-width="2"/><ellipse cx="55" cy="46" rx="26" ry="26" fill="#bdbdbd"/><ellipse cx="55" cy="85" rx="36" ry="20" fill="#bdbdbd"/></svg>`;
            let nameHtml = '';
            if (username === 'own') {
                nameHtml = `<span style="font-size:1.5em;font-weight:bold;background:linear-gradient(90deg,#ffb347 0%,#ff416c 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${data.displayName || username}</span><br><span style="font-size:1em;font-weight:600;color:#ffb347;">Developer</span>`;
            } else {
                nameHtml = `<div style="font-size:1.5em;font-weight:bold;">${data.displayName || username}</div>`;
            }
            infoDiv.innerHTML = `
                <div class="public-profile-summary">
                    ${data.avatar ? `<img class='public-profile-avatar' src='${data.avatar}' alt='Avatar'>` : defaultAvatar}
                    <div class="public-profile-info">
                        ${nameHtml}
                        <div style="font-size:1.08em;color:#bbb;margin-top:2px;">${pronouns ? pronouns : '<span style=\'opacity:0.7;\'>No pronouns set</span>'}</div>
                        <div style='font-size:0.98em;color:#888;margin-top:4px;'>
                          <span><b>Followers:</b> ${data.followers || 0}</span> &nbsp;|&nbsp; <span><b>Following:</b> ${data.following || 0}</span>
                        </div>
                    </div>
                    <div class="public-profile-bio">${data.bio ? data.bio : '<span style=\'opacity:0.7;\'>No bio yet</span>'}</div>
                </div>
            `;
            // Show edit button if viewing own profile
            if (loggedInUser && loggedInUser === username) {
                editBtnDiv.innerHTML = '<a href="profile.html" class="btn" style="background:linear-gradient(90deg,#ffb347 0%,#ffcc80 100%);color:#181818;padding:10px 24px;border-radius:6px;font-weight:700;text-decoration:none;">Edit Profile</a>';
                followBtnDiv.innerHTML = '';
            } else if (loggedInUser && loggedInUser !== username) {
                // Check if already following (using a simple localStorage workaround for demo, ideally should be backend-driven)
                let followingList = [];
                try {
                  followingList = JSON.parse(localStorage.getItem('followingList') || '[]');
                } catch {}
                const isFollowing = followingList.includes(username);
                // Chat button always available
                let chatBtn = document.createElement('button');
                chatBtn.className = 'btn';
                chatBtn.style.background = 'linear-gradient(90deg,#232526 0%,#414345 100%)';
                chatBtn.style.color = '#fff';
                chatBtn.style.padding = '10px 24px';
                chatBtn.style.borderRadius = '6px';
                chatBtn.style.fontWeight = '700';
                chatBtn.style.marginLeft = '10px';
                chatBtn.style.textDecoration = 'none';
                chatBtn.textContent = 'Chat';
                chatBtn.onclick = function() {
                  // Go to chat.html and pass ?user=username for direct message
                  window.location.href = `chat.html?user=${encodeURIComponent(username)}`;
                };
                if (isFollowing) {
                  followBtnDiv.innerHTML = `<button id="unfollowBtn" class="btn" style="background:linear-gradient(90deg,#ffb347 0%,#ffcc80 100%);color:#181818;padding:10px 24px;border-radius:6px;font-weight:700;">Unfollow</button>`;
                  followBtnDiv.appendChild(chatBtn);
                  document.getElementById('unfollowBtn').onclick = function() {
                    fetch('https://ownshub.onrender.com/api/unfollow', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({ followee: username })
                    })
                    .then(res => res.json())
                    .then(result => {
                        if (result.success) {
                            // Remove from localStorage
                            const idx = followingList.indexOf(username);
                            if (idx !== -1) followingList.splice(idx, 1);
                            localStorage.setItem('followingList', JSON.stringify(followingList));
                            location.reload();
                        } else {
                            alert('Failed to unfollow user.');
                        }
                    })
                    .catch(() => alert('Failed to unfollow user.'));
                  };
                } else {
                  followBtnDiv.innerHTML = `<button id="followBtn" class="btn" style="background:linear-gradient(90deg,#ffb347 0%,#ffcc80 100%);color:#181818;padding:10px 24px;border-radius:6px;font-weight:700;">Follow</button>`;
                  followBtnDiv.appendChild(chatBtn);
                  document.getElementById('followBtn').onclick = function() {
                    fetch('https://ownshub.onrender.com/api/follow', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({ followee: username })
                    })
                    .then(res => res.json())
                    .then(result => {
                        if (result.success) {
                            // Add to localStorage
                            followingList.push(username);
                            localStorage.setItem('followingList', JSON.stringify(followingList));
                            location.reload();
                        } else {
                            alert('Failed to follow user.');
                        }
                    })
                    .catch(() => alert('Failed to follow user.'));
                  };
                }
            } else {
                followBtnDiv.innerHTML = '';
            }
        })
        .catch(() => {
            // On error, show default profile
            const defaultAvatar = `<svg width="110" height="110" viewBox="0 0 110 110" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="55" cy="55" r="54" fill="#e0e0e0" stroke="#fff" stroke-width="2"/><ellipse cx="55" cy="46" rx="26" ry="26" fill="#bdbdbd"/><ellipse cx="55" cy="85" rx="36" ry="20" fill="#bdbdbd"/></svg>`;
            infoDiv.innerHTML = `
                <div class="public-profile-summary">
                    ${defaultAvatar}
                    <div class="public-profile-info">
                        <div style="font-size:1.5em;font-weight:bold;">${username}</div>
                        <div style="font-size:1.08em;color:#bbb;margin-top:2px;"><span style='opacity:0.7;'>No pronouns set</span></div>
                    </div>
                    <div class="public-profile-bio"><span style='opacity:0.7;'>No bio yet</span></div>
                </div>
            `;
            if (loggedInUser && loggedInUser === username) {
                editBtnDiv.innerHTML = '<a href="profile.html" class="btn">Edit Profile</a>';
            }
        });
}
