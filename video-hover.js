// video-hover.js
// Replaces image with video on hover for video cards

document.addEventListener('DOMContentLoaded', function () {
  // Apply to all .yt-card elements
  const cards = Array.from(document.querySelectorAll('.yt-card'));
  cards.forEach(function(card) {
    const img = card.querySelector('img.video-hover');
    const video = card.querySelector('video.video-hover');
    // If card uses <video> as preview (not <img>), handle hover play/pause
    if (video) {
      function playOnHover() {
        video.currentTime = 0;
        video.muted = true;
        video.play().catch(()=>{});
        video.classList.add('hover-animate');
      }
      function pauseOnLeave() {
        video.pause();
        video.classList.remove('hover-animate');
      }
      card.addEventListener('mouseenter', playOnHover);
      card.addEventListener('mouseleave', pauseOnLeave);
      card.addEventListener('focusin', playOnHover);
      card.addEventListener('focusout', pauseOnLeave);
      // Optionally, pause video if page/tab is hidden
      document.addEventListener('visibilitychange', function() {
        if (document.hidden) video.pause();
      });
      return;
    }
    // Fallback: old logic for <img> preview
    if (!img) return;
    let mp4 = 'videohover/silent_chill-15.mp4';
    let hoverVideo = null;
    function showThisVideo() {
      const existing = card.querySelector('video');
      if (existing) {
        existing.pause();
        existing.remove();
      }
      hoverVideo = document.createElement('video');
      hoverVideo.src = mp4;
      hoverVideo.muted = true;
      hoverVideo.loop = true;
      hoverVideo.playsInline = true;
      hoverVideo.autoplay = true;
      hoverVideo.style.width = '100%';
      hoverVideo.style.height = '100%';
      hoverVideo.style.objectFit = 'cover';
      hoverVideo.style.position = 'absolute';
      hoverVideo.style.top = '0';
      hoverVideo.style.left = '0';
      hoverVideo.style.zIndex = '2147483647';
      hoverVideo.style.pointerEvents = 'none';
      hoverVideo.style.display = 'block';
      hoverVideo.style.borderRadius = '18px';
      hoverVideo.style.boxShadow = '0 8px 32px #ffd70088, 0 2px 12px #0008';
      hoverVideo.style.transition = 'transform 0.32s cubic-bezier(.22,1.12,.58,1.01), box-shadow 0.32s cubic-bezier(.22,1.12,.58,1.01)';
      hoverVideo.style.transform = 'scale(1.08)';
      card.style.position = 'relative';
      card.style.overflow = 'visible';
      card.insertBefore(hoverVideo, card.firstChild);
      img.style.visibility = 'hidden';
      card.style.zIndex = '2147483647';
      setTimeout(() => { hoverVideo.play(); }, 0);
    }
    function hideThisVideo() {
      if (hoverVideo) {
        hoverVideo.pause();
        hoverVideo.remove();
        hoverVideo = null;
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
