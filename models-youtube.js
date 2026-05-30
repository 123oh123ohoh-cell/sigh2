// Basic interactivity for models YouTube-style page
document.addEventListener('DOMContentLoaded', function() {
  // Search filter (simple demo)
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const query = searchInput.value.toLowerCase();
      document.querySelectorAll('.model-card').forEach(card => {
        const name = card.querySelector('.model-name').textContent.toLowerCase();
        card.style.display = name.includes(query) ? '' : 'none';
      });
    });
  }
});