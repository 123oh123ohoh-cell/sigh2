// Utility: Immediately update all caches and user.js with avatar
function setUserAvatarEverywhere(username, avatar) {
    if (!username || !avatar) return;
    try {
        localStorage.setItem('profileAvatar:' + username.toLowerCase(), avatar);
        sessionStorage.setItem('profileAvatar:' + username.toLowerCase(), avatar);
        localStorage.setItem('profileAvatarChanged', Date.now() + ':' + username);
    } catch (e) {}
    try {
        if (typeof updateUserProfile === 'function') {
            var profile = (typeof getUserProfile === 'function') ? getUserProfile(username) : { username: username };
            profile.avatar = avatar;
            updateUserProfile(username, profile);
        }
    } catch (e) {}
}

function renderProfileSummary(data, username) {
    const summary = document.getElementById('profileSummary');
    let pronouns = data.pronouns === 'custom' ? data.customPronouns : data.pronouns;
    // Premium badge
    let premiumBadge = '';
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (loggedInUser && username === loggedInUser && data.premiumTier) {
        let color = '#ffd700';
        if (data.premiumTier === 'Silver') color = '#c0c0c0';
        if (data.premiumTier === 'Bronze') color = '#cd7f32';
        premiumBadge = `<span style="margin-left:8px;padding:2px 10px;border-radius:8px;background:${color};color:#181818;font-size:0.95em;font-weight:bold;vertical-align:middle;">${data.premiumTier} Premium</span>`;
    }
    const avatarUrl = data.avatar && data.avatar.trim() ? data.avatar : 'logos_and_profileicons/default-profile.png';
    summary.innerHTML = `
        <div style="display:flex;align-items:center;gap:18px;">
            <img class='profile-avatar' src='${avatarUrl}' alt='Avatar' onerror="this.onerror=null;this.src='logos_and_profileicons/default-profile.png';">
            <div>
                <div><strong>${data.displayName || username}</strong> ${premiumBadge}</div>
                ${pronouns ? `<div style='font-size:0.98em;color:var(--text-dark);'>${pronouns}</div>` : ''}
            </div>
        </div>
        ${data.bio ? `<div style='margin-top:10px;'>${data.bio}</div>` : ''}
    `;
}

document.addEventListener('DOMContentLoaded', function() {
    const profileInfo = document.getElementById('profileInfo');
    const username = localStorage.getItem('loggedInUser');
    const token = localStorage.getItem('token');
    let isLoggedIn = !!(username && token);

    // Always show profile summary (public or own), try sigh2 first, then ownshub, then local cache
    let fetchOptions = {};
    if (isLoggedIn) {
        fetchOptions.headers = { 'Authorization': 'Bearer ' + token };
    }
    function getBestAvatar(profile, username) {
        // Try avatar in profile
        if (profile && profile.avatar && profile.avatar.trim()) return profile.avatar;
        // Try dedicated cache key
        if (username) {
            let cached = localStorage.getItem('profileAvatar:' + username.toLowerCase()) || sessionStorage.getItem('profileAvatar:' + username.toLowerCase());
            if (cached && cached.trim()) return cached;
        }
        // Try lastSavedProfile
        try {
            let last = JSON.parse(localStorage.getItem('lastSavedProfile'));
            if (last && last.avatar && last.avatar.trim()) return last.avatar;
        } catch {}
        try {
            let last = JSON.parse(sessionStorage.getItem('lastSavedProfile'));
            if (last && last.avatar && last.avatar.trim()) return last.avatar;
        } catch {}
        // Try user.js
        if (typeof getUserProfile === 'function' && username) {
            try {
                let userjs = getUserProfile(username);
                if (userjs && userjs.avatar && userjs.avatar.trim()) return userjs.avatar;
            } catch {}
        }
        // Default
        return 'logos_and_profileicons/default-profile.png';
    }
    function loadProfileFromBackends() {
        // Try sigh2 backend first
        return fetch('https://sigh2.onrender.com/api/profile', fetchOptions)
            .then(res => res.ok ? res.json() : Promise.reject())
            .catch(() => fetch('https://ownshub.onrender.com/api/profile', fetchOptions)
                .then(res => res.ok ? res.json() : Promise.reject())
            )
            .catch(() => {
                // Fallback to localStorage/sessionStorage/user.js
                let profile = null;
                try {
                    profile = JSON.parse(localStorage.getItem('lastSavedProfile'));
                } catch {}
                if (!profile) {
                    try { profile = JSON.parse(sessionStorage.getItem('lastSavedProfile')); } catch {}
                }
                if (!profile && typeof getUserProfile === 'function' && username) {
                    try { profile = getUserProfile(username); } catch {}
                }
                return profile || { username, avatar: '', displayName: '', pronouns: '', customPronouns: '', bio: '' };
            });
    }
    loadProfileFromBackends().then(data => {
        const avatarUrl = getBestAvatar(data, username);
        document.getElementById('avatarPreview').src = avatarUrl;
        document.getElementById('avatarPreview').style.display = '';
        // Also update nav/header avatar if present
        try {
            var navIcon = document.getElementById('profileAvatarIcon');
            if (navIcon) { navIcon.src = avatarUrl; navIcon.style.display = ''; }
        } catch (e) {}
        if (isLoggedIn) {
            profileInfo.innerHTML = `<p><strong>Username:</strong> ${username}</p>`;
            if (data.displayName) document.getElementById('displayName').value = data.displayName;
            if (data.pronouns) document.getElementById('pronouns').value = data.pronouns;
            if (data.pronouns === 'custom' && data.customPronouns) {
                document.getElementById('customPronouns').style.display = '';
                document.getElementById('customPronouns').value = data.customPronouns;
            }
            if (data.bio) document.getElementById('bio').value = data.bio;
            document.getElementById('profileForm').style.display = '';
        } else {
            profileInfo.innerHTML = '<p>You are viewing a public profile. <a href="login.html">Login</a> to edit your own.</p>';
            document.getElementById('profileForm').style.display = 'none';
        }
        renderProfileSummary(data, username || 'Guest');
    });

    // Pronouns logic
    document.getElementById('pronouns').addEventListener('change', function() {
        if (this.value === 'custom') {
            document.getElementById('customPronouns').style.display = '';
        } else {
            document.getElementById('customPronouns').style.display = 'none';
        }
    });

    // Avatar preview
    document.getElementById('profilePic').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const username = localStorage.getItem('loggedInUser');
            // Use robust fallback: prefer uploaded, else best available
            let avatarUrl = evt.target.result || getBestAvatar(null, username);
            document.getElementById('avatarPreview').src = avatarUrl;
            document.getElementById('avatarPreview').style.display = '';
            setUserAvatarEverywhere(username, avatarUrl);
            // Also update nav/header avatar if present
            try {
                var navIcon = document.getElementById('profileAvatarIcon');
                if (navIcon) { navIcon.src = avatarUrl; navIcon.style.display = ''; }
            } catch (e) {}
        };
        reader.readAsDataURL(file);
    });

    // Save profile to backend
    document.getElementById('profileForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const displayName = document.getElementById('displayName').value.trim();
        const pronouns = document.getElementById('pronouns').value;
        const customPronouns = document.getElementById('customPronouns').value.trim();
        const bio = document.getElementById('bio').value.trim();
        const avatar = document.getElementById('avatarPreview').src || '';
        // Save to both backends in parallel
        const payload = { displayName, pronouns, customPronouns, bio, avatar };
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        };
        Promise.all([
            fetch('https://sigh2.onrender.com/api/profile', { method: 'POST', headers, body: JSON.stringify(payload) }).catch(() => null),
            fetch('https://ownshub.onrender.com/api/profile', { method: 'POST', headers, body: JSON.stringify(payload) }).catch(() => null)
        ]).then(() => {
            // After save, reload from both backends (prefer sigh2)
            loadProfileFromBackends().then(profile => {
                    // Use robust fallback for avatar after save
                    const avatarUrl = getBestAvatar(profile, username);
                    document.getElementById('avatarPreview').src = avatarUrl;
                    document.getElementById('avatarPreview').style.display = '';
                    renderProfileSummary(profile, username);
                    // Immediately update everywhere
                    setUserAvatarEverywhere(username, avatarUrl);
                    // Save to localStorage and sessionStorage (cache)
                    try {
                        localStorage.setItem('lastSavedProfile', JSON.stringify(profile));
                        sessionStorage.setItem('lastSavedProfile', JSON.stringify(profile));
                        // Redundant: save bio, pronouns, displayName separately for robustness
                        if (profile.bio) {
                            localStorage.setItem('profileBio:' + username.toLowerCase(), profile.bio);
                            sessionStorage.setItem('profileBio:' + username.toLowerCase(), profile.bio);
                        }
                        if (profile.displayName) {
                            localStorage.setItem('profileDisplayName:' + username.toLowerCase(), profile.displayName);
                            sessionStorage.setItem('profileDisplayName:' + username.toLowerCase(), profile.displayName);
                        }
                        if (profile.pronouns) {
                            localStorage.setItem('profilePronouns:' + username.toLowerCase(), profile.pronouns);
                            sessionStorage.setItem('profilePronouns:' + username.toLowerCase(), profile.pronouns);
                        }
                        if (profile.customPronouns) {
                            localStorage.setItem('profileCustomPronouns:' + username.toLowerCase(), profile.customPronouns);
                            sessionStorage.setItem('profileCustomPronouns:' + username.toLowerCase(), profile.customPronouns);
                        }
                    } catch (e) {}
                // Attempt to POST to localhost (if running)
                try {
                    fetch('http://localhost:5500/api/profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(profile)
                    });
                } catch (e) {}
                // Redirect to public profile after save
                window.location.href = `public-profile.html?user=${encodeURIComponent(username)}`;
            });
        }).catch(() => {
            alert('Failed to save profile. Network or server error.');
        });
    });
});
