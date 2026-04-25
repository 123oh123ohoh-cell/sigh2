
function renderProfileSummary(data, username) {
    const summary = document.getElementById('profileSummary');
    let pronouns = data.pronouns === 'custom' ? data.customPronouns : data.pronouns;
    summary.innerHTML = `
        <div style="display:flex;align-items:center;gap:18px;">
            ${data.avatar ? `<img class='profile-avatar' src='${data.avatar}' alt='Avatar'>` : ''}
            <div>
                <div><strong>${data.displayName || username}</strong></div>
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

    // Always show profile summary (public or own)
    let fetchOptions = {};
    if (isLoggedIn) {
        fetchOptions.headers = { 'Authorization': 'Bearer ' + token };
    }
    fetch('https://ownshub.onrender.com/api/profile', fetchOptions)
        .then(res => res.json())
        .then(data => {
            if (data.avatar) {
                document.getElementById('avatarPreview').src = data.avatar;
                document.getElementById('avatarPreview').style.display = '';
            }
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
            document.getElementById('avatarPreview').src = evt.target.result;
            document.getElementById('avatarPreview').style.display = '';
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
        fetch('https://ownshub.onrender.com/api/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ displayName, pronouns, customPronouns, bio, avatar }) // followers/following are managed by backend
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Redirect to public profile page after save
                window.location.replace(`public-profile.html?user=${encodeURIComponent(username)}`);
            } else {
                alert('Failed to save profile.');
            }
        })
        .catch(() => {
            alert('Failed to save profile. Network or server error.');
        });
    });
});
