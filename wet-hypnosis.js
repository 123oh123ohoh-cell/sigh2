// wet-hypnosis.js
// Adds rain effect to the wet hypnosis gallery page

document.addEventListener('DOMContentLoaded', function () {
    // Create rain container
    const rainContainer = document.createElement('div');
    rainContainer.className = 'rain-container';
    document.body.appendChild(rainContainer);

    // Generate raindrops
    for (let i = 0; i < 60; i++) {
        const drop = document.createElement('div');
        drop.className = 'raindrop';
        drop.style.left = Math.random() * 100 + 'vw';
        drop.style.animationDelay = (Math.random() * 3) + 's';
        drop.style.animationDuration = (1.8 + Math.random() * 1.5) + 's';
        rainContainer.appendChild(drop);
    }

    // Create sweat drop container
    const sweatContainer = document.createElement('div');
    sweatContainer.className = 'page-sweat-container';
    document.body.appendChild(sweatContainer);

    // Generate sweat drops
    for (let i = 0; i < 18; i++) {
        const sweat = document.createElement('div');
        sweat.className = 'page-sweat-drop';
        sweat.style.left = Math.random() * 100 + 'vw';
        sweat.style.animationDelay = (Math.random() * 4) + 's';
        sweat.style.animationDuration = (2.5 + Math.random() * 2.5) + 's';
        sweatContainer.appendChild(sweat);
    }

    // Add flashing effect to all .hypno elements
    setTimeout(() => {
        document.querySelectorAll('.hypno').forEach(el => {
            el.classList.add('flashing');
        });
    }, 100);

    // Add a flashing overlay to the body for extra effect
    const flashOverlay = document.createElement('div');
    flashOverlay.className = 'hypno-flash-overlay';
    document.body.appendChild(flashOverlay);
});
