// Sidebar collapse/expand
const menuBtn = document.getElementById('ytMenuBtn');
const sidebar = document.querySelector('.yt-sidebar');
const main = document.querySelector('.yt-main');
if (menuBtn && sidebar && main) {
  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('sidebar-collapsed');
  });
}
