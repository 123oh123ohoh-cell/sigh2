// Simple auto-rotating carousel for models.html

document.addEventListener('DOMContentLoaded', function() {
  const carousel = document.getElementById('featuredCarousel');
  if (!carousel) return;
  const slides = Array.from(carousel.getElementsByClassName('carousel-slide'));
  let current = 0;

  function showSlide(idx) {
    slides.forEach((slide, i) => {
      slide.style.display = i === idx ? 'block' : 'none';
    });
  }

  function nextSlide() {
    current = (current + 1) % slides.length;
    showSlide(current);
  }

  showSlide(current);
  setInterval(nextSlide, 3500);
});
