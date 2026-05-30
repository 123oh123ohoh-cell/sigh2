// User profile, followers, and diamonds management
// Store all user data in localStorage under 'userProfiles'

function getUserProfiles() {
  return JSON.parse(localStorage.getItem('userProfiles') || '{}');
}

function saveUserProfiles(profiles) {
  localStorage.setItem('userProfiles', JSON.stringify(profiles));
}

function getUserProfile(username) {
  const profiles = getUserProfiles();
  if (!profiles[username]) {
    profiles[username] = {
      username,
      bio: '',
      diamonds: 0,
      followers: [],
      following: [],
      avatar: '',
      diamondsEnabled: false // diamonds OFF by default
    };
    saveUserProfiles(profiles);
  }
  // Ensure diamondsEnabled is always present (for legacy users)
  if (typeof profiles[username].diamondsEnabled === 'undefined') {
    profiles[username].diamondsEnabled = false;
    saveUserProfiles(profiles);
  }
  return profiles[username];
}

function updateUserProfile(username, data) {
  const profiles = getUserProfiles();
  profiles[username] = { ...getUserProfile(username), ...data };
  saveUserProfiles(profiles);
}

function addDiamonds(username, amount) {
  const profile = getUserProfile(username);
  profile.diamonds = (profile.diamonds || 0) + amount;
  updateUserProfile(username, profile);
}

function setDiamonds(username, amount) {
  const profile = getUserProfile(username);
  profile.diamonds = amount;
  updateUserProfile(username, profile);
}

function followUser(follower, target) {
  if (follower === target) return;
  const profiles = getUserProfiles();
  if (!profiles[target]) getUserProfile(target);
  if (!profiles[follower]) getUserProfile(follower);
  if (!profiles[target].followers.includes(follower)) {
    profiles[target].followers.push(follower);
  }
  if (!profiles[follower].following.includes(target)) {
    profiles[follower].following.push(target);
  }
  saveUserProfiles(profiles);
}

function unfollowUser(follower, target) {
  if (follower === target) return;
  const profiles = getUserProfiles();
  if (!profiles[target] || !profiles[follower]) return;
  profiles[target].followers = profiles[target].followers.filter(u => u !== follower);
  profiles[follower].following = profiles[follower].following.filter(u => u !== target);
  saveUserProfiles(profiles);
}

function getFollowers(username) {
  return getUserProfile(username).followers;
}

function getFollowing(username) {
  return getUserProfile(username).following;
}

function getDiamonds(username) {
  return getUserProfile(username).diamonds;
}

// Example usage:
// addDiamonds('alice', 10);
// followUser('bob', 'alice');
// let profile = getUserProfile('alice');
