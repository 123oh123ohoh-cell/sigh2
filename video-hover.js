// video-hover.js
// Replaces image with video on hover for video cards

document.addEventListener('DOMContentLoaded', function () {
  // Apply to all .yt-card elements
  const cards = Array.from(document.querySelectorAll('.yt-card'));
  cards.forEach(function(card) {
    const img = card.querySelector('img.video-hover');
    if (!img) return;
    let mp4 = 'videohover/silent_chill-15.mp4';
    let video = null;
    function showThisVideo() {
      const existing = card.querySelector('video');
      if (existing) {
        existing.pause();
        existing.remove();
      }
      video = document.createElement('video');
      video.src = mp4;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.position = 'absolute';
      video.style.top = '0';
      video.style.left = '0';
      video.style.zIndex = '2147483647';
      video.style.pointerEvents = 'none';
      video.style.display = 'block';
      video.style.borderRadius = '18px';
      video.style.boxShadow = '0 8px 32px #ffd70088, 0 2px 12px #0008';
      video.style.transition = 'transform 0.32s cubic-bezier(.22,1.12,.58,1.01), box-shadow 0.32s cubic-bezier(.22,1.12,.58,1.01)';
      video.style.transform = 'scale(1.08) rotate(-1.5deg)';
      card.style.position = 'relative';
      card.style.overflow = 'visible';
      card.insertBefore(video, card.firstChild);
      img.style.visibility = 'hidden';
      card.style.zIndex = '2147483647';
      setTimeout(() => { video.play(); }, 0);
    }
    function hideThisVideo() {
      if (video) {
        video.pause();
        video.remove();
        video = null;
      }
      img.style.visibility = 'visible';
      card.style.zIndex = '';
    }
    card.addEventListener('mouseenter', showThisVideo);
    card.addEventListener('mouseleave', hideThisVideo);
    card.addEventListener('focusin', showThisVideo);
    card.addEventListener('focusout', hideThisVideo);
  });
});
