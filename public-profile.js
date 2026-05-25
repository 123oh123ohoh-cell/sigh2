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
const DEFAULT_PROFILE_AVATAR = 'logos_and_profileicons/defaultpfp.webp';

if (!username) {
    infoDiv.innerHTML = '<p>No user specified.</p>';
} else {
    profileTitle.textContent = '';
    profileTitle.style.display = 'none';
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
            const defaultAvatar = `<img class='public-profile-avatar' src='${DEFAULT_PROFILE_AVATAR}' alt='Avatar'>`;
            const handleHtml = `<div class="public-profile-handle">@${username}</div>`;
            let nameHtml = '';
            // Premium badge (only for own profile, since we can't know others' premium from localStorage)
            let premiumBadge = '';
            const loggedInUser = localStorage.getItem('loggedInUser');
            const token = localStorage.getItem('token');
            let userPremiumTier = '';
            if (loggedInUser && username === loggedInUser && token) {
                try {
                    // Synchronously fetch own premiumTier from backend
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', 'https://ownshub.onrender.com/api/profile', false);
                    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                    xhr.send();
                    if (xhr.status === 200) {
                        const d = JSON.parse(xhr.responseText);
                        userPremiumTier = d.premiumTier;
                    }
                } catch {}
                if (userPremiumTier) {
                    let color = '#ffd700';
                    if (userPremiumTier === 'Silver') color = '#c0c0c0';
                    if (userPremiumTier === 'Bronze') color = '#cd7f32';
                    premiumBadge = `<span style=\"margin-left:8px;padding:2px 10px;border-radius:8px;background:${color};color:#181818;font-size:0.95em;font-weight:bold;vertical-align:middle;\">${userPremiumTier} Premium</span>`;
                }
            }
            if (username === 'own') {
                nameHtml = `<span style="font-size:1.5em;font-weight:bold;background:linear-gradient(90deg,#ffb347 0%,#ff416c 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${data.displayName || username}</span>${handleHtml}<span style="font-size:1em;font-weight:600;color:#ffb347;">Developer</span> ${premiumBadge}`;
            } else {
                nameHtml = `<div style="font-size:1.5em;font-weight:bold;">${data.displayName || username} ${premiumBadge}</div>${handleHtml}`;
            }
            infoDiv.innerHTML = `
                <div class="public-profile-summary">
                    ${data.avatar ? `<img class='public-profile-avatar' src='${data.avatar}' alt='Avatar' onerror="this.onerror=null;this.src='${DEFAULT_PROFILE_AVATAR}'">` : defaultAvatar}
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
            const defaultAvatar = `<img class='public-profile-avatar' src='${DEFAULT_PROFILE_AVATAR}' alt='Avatar'>`;
            infoDiv.innerHTML = `
                <div class="public-profile-summary">
                    ${defaultAvatar}
                    <div class="public-profile-info">
                        <div style="font-size:1.5em;font-weight:bold;">${username}</div>
                        <div class="public-profile-handle">@${username}</div>
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
