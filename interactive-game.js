const charmBtn = document.getElementById('charmBtn');

function showVerse(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '26px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '1rem 1.4rem';
    toast.style.background = 'rgba(19,8,38,0.92)';
    toast.style.color = '#fff';
    toast.style.border = '1px solid rgba(255,255,255,0.18)';
    toast.style.borderRadius = '999px';
    toast.style.fontWeight = '600';
    toast.style.boxShadow = '0 25px 80px rgba(20,9,42,0.45)';
    toast.style.zIndex = '999';
    toast.style.opacity = '0';
    toast.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(-8px)';
    });
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(() => toast.remove(), 250);
    }, 2850);
}

if (charmBtn) {
    charmBtn.addEventListener('click', () => showVerse('A playful whisker brush and a sultry smile arrive.'));
}

