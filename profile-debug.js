// Extra smart analysis: check for weak passwords, generic avatars, and field quality
function debugProfileExtraSmartAnalysis(username) {
    if (!username) { return {}; }
    let summary = debugProfileSummary(username);
    let extra = { warnings: [], recommendations: [] };
    // Check for weak/generic passwords if available
    let password = '';
    try {
        if (typeof getUserProfile === 'function') {
            let user = getUserProfile(username);
            password = user && user.password ? user.password : '';
        }
    } catch (e) {}
    if (password && (password.length < 6 || /^(1234|password|qwerty|letmein|test)$/i.test(password))) {
        extra.warnings.push('Weak or default password detected.');
        extra.recommendations.push('Set a strong, unique password.');
    }
    // Check for generic avatar
    if (summary.avatar && summary.avatar.includes('default-profile.png')) {
        extra.warnings.push('Generic/default avatar in use.');
        extra.recommendations.push('Upload a unique profile picture for better recognition.');
    }
    // Check for short or generic fields
    if (summary.bio && summary.bio.length < 10) {
        extra.warnings.push('Bio is very short.');
        extra.recommendations.push('Write a more descriptive bio.');
    }
    if (summary.displayName && summary.displayName.toLowerCase() === username.toLowerCase()) {
        extra.warnings.push('Display name is same as username.');
        extra.recommendations.push('Set a more personal display name.');
    }
    if (summary.pronouns && !/\b(he|she|they|xe|ze|fae|it)\b/i.test(summary.pronouns)) {
        extra.warnings.push('Pronouns may be missing or nonstandard.');
        extra.recommendations.push('Double-check your pronouns for clarity.');
    }
    return extra;
}
// Smart summary: analyze profile and suggest improvements
function debugProfileSmartSummary(username) {
    if (!username) { alert('No username provided'); return; }
    let summary = debugProfileSummary(username);
    let diffs = debugDiffProfileSources(username);
    let issues = [];
    let suggestions = [];
    if (!summary.bio) { issues.push('Bio missing'); suggestions.push('Add a bio for a more complete profile.'); }
    if (!summary.displayName) { issues.push('Display name missing'); suggestions.push('Set a display name for better identification.'); }
    if (!summary.pronouns) { issues.push('Pronouns missing'); suggestions.push('Set your pronouns for clarity.'); }
    if (!summary.avatar) { issues.push('Avatar missing'); suggestions.push('Upload a profile picture for recognition.'); }
    if (diffs && Object.keys(diffs).length) { issues.push('Inconsistent profile data across sources'); suggestions.push('Run Auto-Sync or Full Repair to resolve inconsistencies.'); }
    if (issues.length === 0) suggestions.push('Your profile looks good!');
    return { issues, suggestions, summary, diffs };
}

// Auto-detect and fix common issues
function debugProfileAutoFix(username) {
    if (!username) { alert('No username provided'); return; }
    let smart = debugProfileSmartSummary(username);
    let fixed = false;
    if (smart.issues.includes('Bio missing')) { debugSetProfileFieldsEverywhere(username, {bio:'This is my bio.'}); fixed = true; }
    if (smart.issues.includes('Display name missing')) { debugSetProfileFieldsEverywhere(username, {displayName:username}); fixed = true; }
    if (smart.issues.includes('Pronouns missing')) { debugSetProfileFieldsEverywhere(username, {pronouns:'they/them'}); fixed = true; }
    if (smart.issues.includes('Avatar missing')) { debugSetAvatarEverywhere(username, 'logos_and_profileicons/default-profile.png'); fixed = true; }
    if (smart.issues.includes('Inconsistent profile data across sources')) { debugAutoSyncProfile(username); fixed = true; }
    if (fixed) {
        debugForceReloadAvatars(username);
        debugForceNavProfileIcon(username);
        console.log('Auto-fixed common profile issues for', username);
    } else {
        console.log('No auto-fixes needed for', username);
    }
    return fixed;
}

// Show smart summary overlay (dev mode only)
function debugShowProfileSmartSummary() {
    if (!isDeveloperMode()) { alert('Developer mode required for this tool.'); return; }
    let username = localStorage.getItem('loggedInUser');
    if (!username) { alert('No loggedInUser'); return; }
    let smart = debugProfileSmartSummary(username);
    let extra = debugProfileExtraSmartAnalysis(username);
    let overlay = document.getElementById('profileDebugSmartSummary');
    if (overlay) { overlay.style.display = ''; return; }
    overlay = document.createElement('div');
    overlay.id = 'profileDebugSmartSummary';
    overlay.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999999;background:rgba(0,0,0,0.7);color:#fff;font-family:monospace;padding:40px 0 0 0;';
    let box = document.createElement('div');
    box.style = 'background:#222;padding:32px 40px;border-radius:18px;max-width:600px;margin:40px auto;font-size:1.1em;box-shadow:0 4px 32px #000b;';
    box.innerHTML = '<h2 style="margin-top:0">Profile Smart Summary</h2>';
    let issues = document.createElement('div');
    issues.innerHTML = '<b>Issues:</b><br>' + (smart.issues.length ? smart.issues.map(i=>'- '+i).join('<br>') : 'None');
    box.appendChild(issues);
    let warnings = document.createElement('div');
    warnings.innerHTML = '<b>Warnings:</b><br>' + (extra.warnings.length ? extra.warnings.map(w=>'- '+w).join('<br>') : 'None');
    box.appendChild(warnings);
    let suggestions = document.createElement('div');
    suggestions.innerHTML = '<b>Suggestions:</b><br>' + smart.suggestions.map(s=>'- '+s).concat(extra.recommendations.map(r=>'- '+r)).join('<br>');
    box.appendChild(suggestions);
        // Enhance Profile button: applies all recommendations
        let enhanceBtn = document.createElement('button');
        enhanceBtn.textContent = 'Enhance Profile';
        enhanceBtn.style = 'margin:12px 12px 0 0;padding:8px 18px;font-size:1em;border-radius:7px;border:none;background:#2196f3;color:#fff;cursor:pointer;';
        enhanceBtn.onclick = ()=>{
            // Apply all smart auto-fixes and extra recommendations
            debugProfileAutoFix(username);
            // Extra: set a better bio/displayName if needed
            let summary = debugProfileSummary(username);
            if (summary.bio && summary.bio.length < 10) debugSetProfileFieldsEverywhere(username, {bio:'I am a unique user who loves this site!'});
            if (summary.displayName && summary.displayName.toLowerCase() === username.toLowerCase()) debugSetProfileFieldsEverywhere(username, {displayName: summary.displayName + ' (User)'});
            debugShowProfileSmartSummary();
        };
        box.appendChild(enhanceBtn);
    let summaryPre = document.createElement('pre');
    summaryPre.textContent = JSON.stringify(smart.summary, null, 2);
    box.appendChild(summaryPre);
    let diffsPre = document.createElement('pre');
    diffsPre.textContent = 'Diffs:\n' + JSON.stringify(smart.diffs, null, 2);
    box.appendChild(diffsPre);
    let fixBtn = document.createElement('button');
    fixBtn.textContent = 'Auto-Fix Issues';
    fixBtn.style = 'margin:12px 12px 0 0;padding:8px 18px;font-size:1em;border-radius:7px;border:none;background:#4caf50;color:#fff;cursor:pointer;';
    fixBtn.onclick = ()=>{debugProfileAutoFix(username);debugShowProfileSmartSummary();};
    box.appendChild(fixBtn);
    let closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style = 'margin:12px 0 0 0;padding:8px 18px;font-size:1em;border-radius:7px;border:none;background:#ff69b4;color:#fff;cursor:pointer;';
    closeBtn.onclick = ()=>{overlay.style.display='none';};
    box.appendChild(closeBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

window.debugProfileSmartSummary = debugProfileSmartSummary;
window.debugProfileAutoFix = debugProfileAutoFix;
window.debugShowProfileSmartSummary = debugShowProfileSmartSummary;
// Helper: check if developer mode is enabled
function isDeveloperMode() {
    // Check for developer mode flag in localStorage or global var
    return localStorage.getItem('developerMode') === 'true' || window.developerMode === true;
}
// Timeline/history: keep a history of all profile field changes
if (!window._profileDebugHistory) window._profileDebugHistory = [];
function debugLogProfileChange(username, field, oldValue, newValue) {
    window._profileDebugHistory.push({
        username,
        field,
        oldValue,
        newValue,
        time: new Date().toISOString()
    });
    if (window._profileDebugHistory.length > 1000) window._profileDebugHistory.shift();
}

// Patch setProfileFieldsEverywhere and setAvatarEverywhere to log changes
const _origSetProfileFieldsEverywhere = window.debugSetProfileFieldsEverywhere;
window.debugSetProfileFieldsEverywhere = function(username, fields) {
    let old = debugProfileSummary(username);
    for (let k in fields) debugLogProfileChange(username, k, old[k], fields[k]);
    return _origSetProfileFieldsEverywhere(username, fields);
};
const _origSetAvatarEverywhere = window.debugSetAvatarEverywhere;
window.debugSetAvatarEverywhere = function(username, avatar) {
    let old = debugProfileSummary(username);
    debugLogProfileChange(username, 'avatar', old.avatar, avatar);
    return _origSetAvatarEverywhere(username, avatar);
};

// Undo/redo for profile fields
window._profileDebugUndoStack = [];
window._profileDebugRedoStack = [];
function debugProfileUndo(username) {
    if (!window._profileDebugHistory.length) return;
    let last = window._profileDebugHistory.pop();
    if (!last) return;
    window._profileDebugRedoStack.push(last);
    let prev = window._profileDebugHistory.slice().reverse().find(h=>h.username===username&&h.field===last.field);
    let value = prev ? prev.newValue : '';
    if (last.field==='avatar') debugSetAvatarEverywhere(username, value);
    else {
        let obj = {}; obj[last.field]=value; debugSetProfileFieldsEverywhere(username, obj);
    }
    debugForceReloadAvatars(username);
    debugForceNavProfileIcon(username);
    console.log('Undo:', last);
}
function debugProfileRedo(username) {
    if (!window._profileDebugRedoStack.length) return;
    let next = window._profileDebugRedoStack.pop();
    if (!next) return;
    window._profileDebugHistory.push(next);
    if (next.field==='avatar') debugSetAvatarEverywhere(username, next.newValue);
    else {
        let obj = {}; obj[next.field]=next.newValue; debugSetProfileFieldsEverywhere(username, obj);
    }
    debugForceReloadAvatars(username);
    debugForceNavProfileIcon(username);
    console.log('Redo:', next);
}

// Quick field edit overlay for live testing
function debugShowProfileQuickEdit() {
    if (!isDeveloperMode()) { alert('Developer mode required for this tool.'); return; }
    let username = localStorage.getItem('loggedInUser');
    if (!username) { alert('No loggedInUser'); return; }
    let overlay = document.getElementById('profileDebugQuickEdit');
    if (overlay) { overlay.style.display = ''; return; }
    overlay = document.createElement('div');
    overlay.id = 'profileDebugQuickEdit';
    overlay.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999999;background:rgba(0,0,0,0.7);color:#fff;font-family:monospace;padding:40px 0 0 0;';
    let box = document.createElement('div');
    box.style = 'background:#222;padding:32px 40px;border-radius:18px;max-width:480px;margin:40px auto;font-size:1.1em;box-shadow:0 4px 32px #000b;';
    box.innerHTML = '<h2 style="margin-top:0">Profile Quick Edit</h2>';
    let summary = debugProfileSummary(username);
    ['bio','displayName','pronouns','customPronouns'].forEach(field=>{
        let label = document.createElement('label');
        label.textContent = field+': ';
        let input = document.createElement('input');
        input.type = 'text';
        input.value = summary[field]||'';
        input.style = 'width:320px;margin:0 0 12px 0;padding:6px 10px;font-size:1em;border-radius:6px;border:1px solid #888;background:#333;color:#fff;';
        input.onchange = ()=>{
            let obj={}; obj[field]=input.value; debugSetProfileFieldsEverywhere(username, obj);
            debugShowProfileQuickEdit();
        };
        label.appendChild(input);
        box.appendChild(label);
        box.appendChild(document.createElement('br'));
    });
    let closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style = 'margin-top:18px;padding:8px 22px;font-size:1.1em;border-radius:8px;background:#ff69b4;color:#fff;border:none;';
    closeBtn.onclick = ()=>{overlay.style.display='none';};
    box.appendChild(closeBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

window.debugLogProfileChange = debugLogProfileChange;
window.debugProfileUndo = debugProfileUndo;
window.debugProfileRedo = debugProfileRedo;
window.debugShowProfileQuickEdit = debugShowProfileQuickEdit;
// Log all profile-related storage changes in real time
function debugWatchProfileStorageChanges() {
    if (window._profileDebugStorageListener) return;
    window._profileDebugStorageListener = function(e) {
        if (!e.key) return;
        if (e.key.toLowerCase().includes('profile') || e.key.toLowerCase().includes('avatar')) {
            console.log('[profile-debug] Storage change:', e.key, 'old:', e.oldValue, 'new:', e.newValue);
        }
    };
    window.addEventListener('storage', window._profileDebugStorageListener);
    console.log('Profile storage change watcher enabled.');
}

// Stop watching storage changes
function debugUnwatchProfileStorageChanges() {
    if (window._profileDebugStorageListener) {
        window.removeEventListener('storage', window._profileDebugStorageListener);
        window._profileDebugStorageListener = null;
        console.log('Profile storage change watcher disabled.');
    }
}

// Live watch overlay: show all current profile fields and update live
function debugShowProfileLiveWatch() {
    if (!isDeveloperMode()) { alert('Developer mode required for this tool.'); return; }
    let username = localStorage.getItem('loggedInUser');
    if (!username) { alert('No loggedInUser'); return; }
    let overlay = document.getElementById('profileDebugLiveWatch');
    if (overlay) { overlay.style.display = ''; return; }
    overlay = document.createElement('div');
    overlay.id = 'profileDebugLiveWatch';
    overlay.style = 'position:fixed;top:0;right:0;width:420px;height:100vh;z-index:999999;background:rgba(34,34,34,0.98);color:#fff;font-family:monospace;padding:18px 0 0 0;overflow:auto;box-shadow:-2px 0 18px #000b;';
    let box = document.createElement('div');
    box.style = 'padding:18px 24px;';
    box.innerHTML = '<h2 style="margin-top:0">Profile Live Watch</h2>';
    let summaryPre = document.createElement('pre');
    summaryPre.id = 'profileDebugLiveWatchPre';
    box.appendChild(summaryPre);
    let closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style = 'margin-top:18px;padding:8px 22px;font-size:1.1em;border-radius:8px;background:#ff69b4;color:#fff;border:none;';
    closeBtn.onclick = ()=>{overlay.style.display='none';};
    box.appendChild(closeBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function update() {
        let username = localStorage.getItem('loggedInUser');
        let summary = debugProfileSummary(username);
        summaryPre.textContent = JSON.stringify(summary, null, 2);
    }
    update();
    overlay._interval = setInterval(update, 1200);
    overlay._onremove = ()=>clearInterval(overlay._interval);
    overlay.addEventListener('DOMNodeRemoved', function(e){if(e.target===overlay&&overlay._onremove)overlay._onremove();});
}

// Reset all profile fields and avatar to defaults for a username
function debugResetProfileToDefaults(username) {
    if (!username) { alert('No username provided'); return; }
    debugSetProfileFieldsEverywhere(username, {bio:'',displayName:'',pronouns:'',customPronouns:''});
    debugSetAvatarEverywhere(username, 'logos_and_profileicons/default-profile.png');
    debugForceReloadAvatars(username);
    debugForceNavProfileIcon(username);
    console.log('Profile reset to defaults for', username);
}

window.debugWatchProfileStorageChanges = debugWatchProfileStorageChanges;
window.debugUnwatchProfileStorageChanges = debugUnwatchProfileStorageChanges;
window.debugShowProfileLiveWatch = debugShowProfileLiveWatch;
window.debugResetProfileToDefaults = debugResetProfileToDefaults;
// Download all profile data as a file
function debugDownloadProfileBackup(username) {
    if (!username) { alert('No username provided'); return; }
    let json = debugExportProfileData(username);
    let blob = new Blob([json], {type:'application/json'});
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'profile-backup-' + username + '-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);}, 500);
}

// Upload and restore profile data from a file
function debugUploadProfileBackup(username, file, cb) {
    if (!username || !file) { alert('Missing username or file'); return; }
    let reader = new FileReader();
    reader.onload = function(e) {
        try {
            debugImportProfileData(username, e.target.result);
            if (cb) cb(true);
        } catch (err) {
            alert('Failed to import profile: ' + err);
            if (cb) cb(false);
        }
    };
    reader.readAsText(file);
}

// Quick avatar test: show avatar in a popup
function debugTestAvatarPopup(username) {
    if (!username) { alert('No username provided'); return; }
    let avatar = null;
    if (typeof getBestAvatar === 'function') {
        avatar = getBestAvatar(null, username);
    } else {
        avatar = localStorage.getItem('profileAvatar:' + username.toLowerCase()) || '';
    }
    let win = window.open('', 'avatarTest', 'width=320,height=320');
    win.document.write('<html><body style="background:#222;color:#fff;text-align:center;padding:40px;"><h2>Avatar Test</h2><img src="'+avatar+'" style="max-width:220px;max-height:220px;border-radius:50%;box-shadow:0 2px 16px #000b;"><br><br><button onclick="window.close()" style="margin-top:18px;padding:8px 22px;font-size:1.1em;border-radius:8px;background:#ff69b4;color:#fff;border:none;">Close</button></body></html>');
}

// Alert user if profile fields or avatar are missing or inconsistent
function debugProfileAlert(username) {
    if (!username) { alert('No username provided'); return; }
    let diffs = debugDiffProfileSources(username);
    let summary = debugProfileSummary(username);
    let issues = [];
    if (!summary.bio) issues.push('Bio missing');
    if (!summary.displayName) issues.push('Display name missing');
    if (!summary.pronouns) issues.push('Pronouns missing');
    if (!summary.avatar) issues.push('Avatar missing');
    if (diffs && Object.keys(diffs).length) issues.push('Inconsistent profile data across sources');
    if (issues.length) {
        alert('Profile issues for ' + username + ':\n' + issues.join('\n'));
    } else {
        alert('Profile for ' + username + ' looks good!');
    }
}

// Auto-sync all profile fields and avatar to all sources
function debugAutoSyncProfile(username) {
    if (!username) { console.warn('No username provided'); return; }
    let summary = debugProfileSummary(username);
    debugSetProfileFieldsEverywhere(username, {
        bio: summary.bio,
        displayName: summary.displayName,
        pronouns: summary.pronouns,
        customPronouns: summary.customPronouns
    });
    if (summary.avatar) debugSetAvatarEverywhere(username, summary.avatar);
    debugForceReloadAvatars(username);
    debugForceNavProfileIcon(username);
    console.log('Auto-synced all profile fields for', username);
}

// UI overlay for quick profile diagnostics and repair
function debugShowProfileOverlay() {
    if (!isDeveloperMode()) { alert('Developer mode required for this tool.'); return; }
    let username = localStorage.getItem('loggedInUser');
    if (!username) { alert('No loggedInUser'); return; }
    let overlay = document.getElementById('profileDebugOverlay');
    if (overlay) { overlay.style.display = ''; return; }
    overlay = document.createElement('div');
    overlay.id = 'profileDebugOverlay';
    overlay.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999999;background:rgba(0,0,0,0.7);color:#fff;font-family:monospace;padding:40px 0 0 0;';
    let box = document.createElement('div');
    box.style = 'background:#222;padding:32px 40px;border-radius:18px;max-width:600px;margin:40px auto;font-size:1.1em;box-shadow:0 4px 32px #000b;';
    box.innerHTML = '<h2 style="margin-top:0">Profile Debug Overlay</h2>';
    let usernameDisplay = document.createElement('div');
    usernameDisplay.textContent = 'Username: ' + username;
    box.appendChild(usernameDisplay);
    let summary = debugProfileSummary(username);
    let summaryPre = document.createElement('pre');
    summaryPre.textContent = JSON.stringify(summary, null, 2);
    box.appendChild(summaryPre);
    let btns = [
        {label:'Alert Issues', fn:()=>debugProfileAlert(username)},
        {label:'Auto-Heal', fn:()=>{debugAutoHealProfile(username);debugShowProfileOverlay();}},
        {label:'Full Repair', fn:()=>{debugFullProfileRepair(username);debugShowProfileOverlay();}},
        {label:'Auto-Sync', fn:()=>{debugAutoSyncProfile(username);debugShowProfileOverlay();}},
        {label:'Self-Test', fn:()=>{debugProfileSelfTest();debugShowProfileOverlay();}},
        {label:'Test Avatar', fn:()=>debugTestAvatarPopup(username)},
        {label:'Download Backup', fn:()=>debugDownloadProfileBackup(username)},
        {label:'Upload Backup', fn:()=>{
            let input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.onchange = function(e) {
                let file = e.target.files[0];
                if (file) debugUploadProfileBackup(username, file, ok=>{if(ok)debugShowProfileOverlay();});
            };
            input.click();
        }},
        {label:'Close', fn:()=>{overlay.style.display='none';}}
    ];
    window.debugDownloadProfileBackup = debugDownloadProfileBackup;
    window.debugUploadProfileBackup = debugUploadProfileBackup;
    window.debugTestAvatarPopup = debugTestAvatarPopup;
    btns.forEach(b=>{
        let btn=document.createElement('button');
        btn.textContent=b.label;
        btn.style='margin:8px 12px 8px 0;padding:8px 18px;font-size:1em;border-radius:7px;border:none;background:#ff69b4;color:#fff;cursor:pointer;';
        btn.onclick=b.fn;
        box.appendChild(btn);
    });
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

window.debugProfileAlert = debugProfileAlert;
window.debugAutoSyncProfile = debugAutoSyncProfile;
window.debugShowProfileOverlay = debugShowProfileOverlay;
// Diff all profile sources for a username
function debugDiffProfileSources(username) {
    if (!username) { console.warn('No username provided'); return; }
    let fields = debugPrintAllProfileFields(username);
    let avatars = debugPrintAllAvatars(username);
    let userjs = (typeof getUserProfile === 'function') ? getUserProfile(username) : {};
    let diffs = {};
    // Compare all fields
    ['bio','displayName','pronouns','customPronouns'].forEach(field => {
        let vals = [fields[`user.js.${field}`], fields[`profile${field.charAt(0).toUpperCase()+field.slice(1)}:localStorage`], fields[`profile${field.charAt(0).toUpperCase()+field.slice(1)}:sessionStorage`]];
        let unique = Array.from(new Set(vals.filter(Boolean)));
        if (unique.length > 1) diffs[field] = unique;
    });
    // Compare avatars
    let avatarVals = [avatars['user.js'], avatars['profileAvatar:localStorage'], avatars['profileAvatar:sessionStorage'], avatars['lastSavedProfile:localStorage'], avatars['lastSavedProfile:sessionStorage']];
    let avatarUnique = Array.from(new Set(avatarVals.filter(Boolean)));
    if (avatarUnique.length > 1) diffs['avatar'] = avatarUnique;
    console.log('Profile source diffs for', username, diffs);
    return diffs;
}

// Export all profile data for a username as JSON
function debugExportProfileData(username) {
    if (!username) { console.warn('No username provided'); return; }
    let summary = debugProfileSummary(username);
    let json = JSON.stringify(summary, null, 2);
    console.log('Exported profile data for', username, json);
    return json;
}

// Import profile data (from JSON) and set everywhere
function debugImportProfileData(username, json) {
    if (!username || !json) { console.warn('Missing username or json'); return; }
    let data;
    try { data = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { console.warn('Invalid JSON', e); return; }
    if (!data) return;
    debugSetProfileFieldsEverywhere(username, {
        bio: data.bio,
        displayName: data.displayName,
        pronouns: data.pronouns,
        customPronouns: data.customPronouns
    });
    if (data.avatar) debugSetAvatarEverywhere(username, data.avatar);
    debugForceReloadAvatars(username);
    debugForceNavProfileIcon(username);
    console.log('Imported profile data for', username, data);
}

// Self-test: run all debug functions for current user and print results
function debugProfileSelfTest() {
    const username = localStorage.getItem('loggedInUser');
    if (!username) { console.warn('No loggedInUser'); return; }
    debugProfileSummary(username);
    debugDiffProfileSources(username);
    debugFullProfileRepair(username);
    debugProfileSummary(username);
    console.log('Profile debug self-test complete for', username);
}

window.debugDiffProfileSources = debugDiffProfileSources;
window.debugExportProfileData = debugExportProfileData;
window.debugImportProfileData = debugImportProfileData;
window.debugProfileSelfTest = debugProfileSelfTest;
// Smart auto-heal: fill missing/corrupt profile fields from best available source
function debugAutoHealProfile(username) {
    if (!username) { console.warn('No username provided'); return; }
    let healed = {};
    // Try to get best values from all sources
    let sources = debugPrintAllProfileFields(username);
    let userjs = (typeof getUserProfile === 'function') ? getUserProfile(username) : {};
    // Prefer user.js, then localStorage, then sessionStorage
    healed.bio = userjs.bio || sources['profileBio:localStorage'] || sources['profileBio:sessionStorage'] || '';
    healed.displayName = userjs.displayName || sources['profileDisplayName:localStorage'] || sources['profileDisplayName:sessionStorage'] || '';
    healed.pronouns = userjs.pronouns || sources['profilePronouns:localStorage'] || sources['profilePronouns:sessionStorage'] || '';
    healed.customPronouns = userjs.customPronouns || sources['profileCustomPronouns:localStorage'] || sources['profileCustomPronouns:sessionStorage'] || '';
    // Save everywhere
    debugSetProfileFieldsEverywhere(username, healed);
    console.log('Auto-healed profile fields for', username, healed);
    return healed;
}

// Full repair: auto-heal all fields and avatar, and force UI update
function debugFullProfileRepair(username) {
    if (!username) { console.warn('No username provided'); return; }
    debugAutoHealProfile(username);
    // Heal avatar
    let avatar = null;
    if (typeof getBestAvatar === 'function') {
        avatar = getBestAvatar(null, username);
    } else {
        avatar = localStorage.getItem('profileAvatar:' + username.toLowerCase()) || '';
    }
    debugSetAvatarEverywhere(username, avatar);
    debugForceReloadAvatars(username);
    debugForceNavProfileIcon(username);
    console.log('Full profile repair done for', username);
}

// Smart summary: print a summary report of all profile fields and avatar status
function debugProfileSummary(username) {
    if (!username) { console.warn('No username provided'); return; }
    let fields = debugPrintAllProfileFields(username);
    let avatars = debugPrintAllAvatars(username);
    let userjs = (typeof getUserProfile === 'function') ? getUserProfile(username) : {};
    let summary = {
        bio: fields['user.js.bio'] || fields['profileBio:localStorage'] || fields['profileBio:sessionStorage'] || '',
        displayName: fields['user.js.displayName'] || fields['profileDisplayName:localStorage'] || fields['profileDisplayName:sessionStorage'] || '',
        pronouns: fields['user.js.pronouns'] || fields['profilePronouns:localStorage'] || fields['profilePronouns:sessionStorage'] || '',
        customPronouns: fields['user.js.customPronouns'] || fields['profileCustomPronouns:localStorage'] || fields['profileCustomPronouns:sessionStorage'] || '',
        avatar: avatars['user.js'] || avatars['profileAvatar:localStorage'] || avatars['profileAvatar:sessionStorage'] || avatars['lastSavedProfile:localStorage'] || avatars['lastSavedProfile:sessionStorage'] || '',
        followers: (userjs && Array.isArray(userjs.followers)) ? userjs.followers : [],
        following: (userjs && Array.isArray(userjs.following)) ? userjs.following : [],
        userjs,
        fields,
        avatars
    };
    console.log('Profile summary for', username, summary);
    return summary;
}

window.debugAutoHealProfile = debugAutoHealProfile;
window.debugFullProfileRepair = debugFullProfileRepair;
window.debugProfileSummary = debugProfileSummary;
// Print all profile fields (bio, pronouns, displayName, customPronouns) from all sources
function debugPrintAllProfileFields(username) {
    if (!username) { console.warn('No username provided'); return; }
    let results = {};
    try {
        results['profileBio:localStorage'] = localStorage.getItem('profileBio:' + username.toLowerCase());
        results['profileBio:sessionStorage'] = sessionStorage.getItem('profileBio:' + username.toLowerCase());
        results['profileDisplayName:localStorage'] = localStorage.getItem('profileDisplayName:' + username.toLowerCase());
        results['profileDisplayName:sessionStorage'] = sessionStorage.getItem('profileDisplayName:' + username.toLowerCase());
        results['profilePronouns:localStorage'] = localStorage.getItem('profilePronouns:' + username.toLowerCase());
        results['profilePronouns:sessionStorage'] = sessionStorage.getItem('profilePronouns:' + username.toLowerCase());
        results['profileCustomPronouns:localStorage'] = localStorage.getItem('profileCustomPronouns:' + username.toLowerCase());
        results['profileCustomPronouns:sessionStorage'] = sessionStorage.getItem('profileCustomPronouns:' + username.toLowerCase());
    } catch {}
    try {
        if (typeof getUserProfile === 'function') {
            let userjs = getUserProfile(username);
            if (userjs) {
                results['user.js.bio'] = userjs.bio;
                results['user.js.displayName'] = userjs.displayName;
                results['user.js.pronouns'] = userjs.pronouns;
                results['user.js.customPronouns'] = userjs.customPronouns;
            }
        }
    } catch {}
    console.log('Profile fields for', username, results);
    return results;
}

// Force set bio, pronouns, displayName, customPronouns everywhere
function debugSetProfileFieldsEverywhere(username, {bio, displayName, pronouns, customPronouns}) {
    if (!username) { console.warn('No username provided'); return; }
    try {
        if (bio) {
            localStorage.setItem('profileBio:' + username.toLowerCase(), bio);
            sessionStorage.setItem('profileBio:' + username.toLowerCase(), bio);
        }
        if (displayName) {
            localStorage.setItem('profileDisplayName:' + username.toLowerCase(), displayName);
            sessionStorage.setItem('profileDisplayName:' + username.toLowerCase(), displayName);
        }
        if (pronouns) {
            localStorage.setItem('profilePronouns:' + username.toLowerCase(), pronouns);
            sessionStorage.setItem('profilePronouns:' + username.toLowerCase(), pronouns);
        }
        if (customPronouns) {
            localStorage.setItem('profileCustomPronouns:' + username.toLowerCase(), customPronouns);
            sessionStorage.setItem('profileCustomPronouns:' + username.toLowerCase(), customPronouns);
        }
    } catch (e) { console.warn('local/sessionStorage error', e); }
    try {
        if (typeof updateUserProfile === 'function') {
            var profile = (typeof getUserProfile === 'function') ? getUserProfile(username) : { username: username };
            if (bio) profile.bio = bio;
            if (displayName) profile.displayName = displayName;
            if (pronouns) profile.pronouns = pronouns;
            if (customPronouns) profile.customPronouns = customPronouns;
            updateUserProfile(username, profile);
        }
    } catch (e) { console.warn('user.js error', e); }
    // Update profile preview if present
    try {
        var preview = document.getElementById('bio');
        if (preview && bio) preview.value = bio;
        var dn = document.getElementById('displayName');
        if (dn && displayName) dn.value = displayName;
        var pr = document.getElementById('pronouns');
        if (pr && pronouns) pr.value = pronouns;
        var cpr = document.getElementById('customPronouns');
        if (cpr && customPronouns) cpr.value = customPronouns;
    } catch (e) { console.warn('profile preview error', e); }
}

// Force update nav bar profile icon in index.html
function debugForceNavProfileIcon(username) {
    if (!username) return;
    let avatar = null;
    if (typeof getBestAvatar === 'function') {
        avatar = getBestAvatar(null, username);
    } else {
        avatar = localStorage.getItem('profileAvatar:' + username.toLowerCase()) || '';
    }
    try {
        var navIcon = document.getElementById('profileAvatarIcon');
        if (navIcon && avatar) { navIcon.src = avatar; navIcon.style.display = ''; }
    } catch (e) { console.warn('navIcon error', e); }
}

window.debugPrintAllProfileFields = debugPrintAllProfileFields;
window.debugSetProfileFieldsEverywhere = debugSetProfileFieldsEverywhere;
window.debugForceNavProfileIcon = debugForceNavProfileIcon;
// Clear all avatar caches for a username
function debugClearAvatarCaches(username) {
    if (!username) return;
    try {
        localStorage.removeItem('profileAvatar:' + username.toLowerCase());
        sessionStorage.removeItem('profileAvatar:' + username.toLowerCase());
        localStorage.removeItem('lastSavedProfile');
        sessionStorage.removeItem('lastSavedProfile');
        localStorage.removeItem('profileAvatarChanged');
    } catch (e) { console.warn('Error clearing caches', e); }
    console.log('Cleared avatar caches for', username);
}

// Force reload avatar in nav/header and preview from best available source
function debugForceReloadAvatars(username) {
    if (!username) return;
    if (typeof getBestAvatar !== 'function') {
        console.warn('getBestAvatar not available');
        return;
    }
    let avatar = getBestAvatar(null, username);
    try {
        var navIcon = document.getElementById('profileAvatarIcon');
        if (navIcon) { navIcon.src = avatar; navIcon.style.display = ''; }
    } catch (e) {}
    try {
        var preview = document.getElementById('avatarPreview');
        if (preview) { preview.src = avatar; preview.style.display = ''; }
    } catch (e) {}
    console.log('Forced reload of avatars for', username, avatar);
}

// Print all localStorage/sessionStorage keys related to profile/avatar
function debugPrintAllProfileStorageKeys() {
    let keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        let k = localStorage.key(i);
        if (k && k.toLowerCase().includes('profile') || k.toLowerCase().includes('avatar')) keys.push('localStorage: ' + k);
    }
    for (let i = 0; i < sessionStorage.length; i++) {
        let k = sessionStorage.key(i);
        if (k && k.toLowerCase().includes('profile') || k.toLowerCase().includes('avatar')) keys.push('sessionStorage: ' + k);
    }
    console.log('Profile/avatar storage keys:', keys);
    return keys;
}

window.debugClearAvatarCaches = debugClearAvatarCaches;
window.debugForceReloadAvatars = debugForceReloadAvatars;
window.debugPrintAllProfileStorageKeys = debugPrintAllProfileStorageKeys;
// profile-debug.js
// Utility/debug functions for troubleshooting profile avatar issues

// Print all possible avatar sources for a username
function debugPrintAllAvatars(username) {
    if (!username) {
        console.warn('No username provided');
        return;
    }
    let results = {};
    try {
        results['profileAvatar:localStorage'] = localStorage.getItem('profileAvatar:' + username.toLowerCase());
    } catch {}
    try {
        results['profileAvatar:sessionStorage'] = sessionStorage.getItem('profileAvatar:' + username.toLowerCase());
    } catch {}
    try {
        let last = JSON.parse(localStorage.getItem('lastSavedProfile'));
        if (last && last.avatar) results['lastSavedProfile:localStorage'] = last.avatar;
    } catch {}
    try {
        let last = JSON.parse(sessionStorage.getItem('lastSavedProfile'));
        if (last && last.avatar) results['lastSavedProfile:sessionStorage'] = last.avatar;
    } catch {}
    try {
        if (typeof getUserProfile === 'function') {
            let userjs = getUserProfile(username);
            if (userjs && userjs.avatar) results['user.js'] = userjs.avatar;
        }
    } catch {}
    console.log('Avatar sources for', username, results);
    return results;
}

// Force update avatar everywhere for a username and avatar
function debugSetAvatarEverywhere(username, avatar) {
    if (!username || !avatar) {
        console.warn('Missing username or avatar');
        return;
    }
    try {
        localStorage.setItem('profileAvatar:' + username.toLowerCase(), avatar);
        sessionStorage.setItem('profileAvatar:' + username.toLowerCase(), avatar);
        localStorage.setItem('profileAvatarChanged', Date.now() + ':' + username);
    } catch (e) { console.warn('local/sessionStorage error', e); }
    try {
        if (typeof updateUserProfile === 'function') {
            var profile = (typeof getUserProfile === 'function') ? getUserProfile(username) : { username: username };
            profile.avatar = avatar;
            updateUserProfile(username, profile);
        }
    } catch (e) { console.warn('user.js error', e); }
    // Update nav/header if present
    try {
        var navIcon = document.getElementById('profileAvatarIcon');
        if (navIcon) { navIcon.src = avatar; navIcon.style.display = ''; }
    } catch (e) { console.warn('navIcon error', e); }
    // Update profile preview if present
    try {
        var preview = document.getElementById('avatarPreview');
        if (preview) { preview.src = avatar; preview.style.display = ''; }
    } catch (e) { console.warn('avatarPreview error', e); }
}

// Print current profile object from user.js
function debugPrintUserProfile(username) {
    if (typeof getUserProfile === 'function') {
        try {
            let profile = getUserProfile(username);
            console.log('user.js profile for', username, profile);
            return profile;
        } catch (e) {
            console.warn('getUserProfile error', e);
        }
    } else {
        console.warn('getUserProfile not available');
    }
}

// Print backend profile (ownshub and sigh2)
async function debugPrintBackendProfiles(token) {
    if (!token) {
        console.warn('No token provided');
        return;
    }
    try {
        let res1 = await fetch('https://ownshub.onrender.com/api/profile', { headers: { 'Authorization': 'Bearer ' + token } });
        let data1 = await res1.json();
        console.log('ownshub backend profile:', data1);
    } catch (e) { console.warn('ownshub backend error', e); }
    try {
        let res2 = await fetch('https://sigh2.onrender.com/api/profile', { headers: { 'Authorization': 'Bearer ' + token } });
        let data2 = await res2.json();
        console.log('sigh2 backend profile:', data2);
    } catch (e) { console.warn('sigh2 backend error', e); }
}

// Print all relevant info for current user
function debugProfileAll() {
    const username = localStorage.getItem('loggedInUser');
    const token = localStorage.getItem('token');
    debugPrintAllAvatars(username);
    debugPrintUserProfile(username);
    debugPrintBackendProfiles(token);
}

// Expose for console
window.debugPrintAllAvatars = debugPrintAllAvatars;
window.debugSetAvatarEverywhere = debugSetAvatarEverywhere;
window.debugPrintUserProfile = debugPrintUserProfile;
window.debugPrintBackendProfiles = debugPrintBackendProfiles;
window.debugProfileAll = debugProfileAll;
