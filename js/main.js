import { REFRESH_INTERVAL, loadChannels } from './config.js';
import { renderEPG, updateClock } from './ui.js';
import { state } from './state.js';

/**
 * Initialize event listeners
 */
function initEventListeners() {
    const categoryFilter = document.getElementById('categoryFilter');
    const categoryFilterMobile = document.getElementById('categoryFilterMobile');
    const regionFilter = document.getElementById('regionFilter');
    const regionFilterMobile = document.getElementById('regionFilterMobile');

    const onCategory = (e) => {
        if (categoryFilter) categoryFilter.value = e.target.value;
        if (categoryFilterMobile) categoryFilterMobile.value = e.target.value;
        state.setCategoryFilter(e.target.value);
    };

    const onRegion = (e) => {
        if (regionFilter) regionFilter.value = e.target.value;
        if (regionFilterMobile) regionFilterMobile.value = e.target.value;
        state.setRegionFilter(e.target.value);
    };

    if (categoryFilter) categoryFilter.addEventListener('change', onCategory);
    if (categoryFilterMobile) categoryFilterMobile.addEventListener('change', onCategory);
    if (regionFilter) regionFilter.addEventListener('change', onRegion);
    if (regionFilterMobile) regionFilterMobile.addEventListener('change', onRegion);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.setSearchQuery(e.target.value.trim().toLowerCase());
        });
    }

    // Mobile search toggle
    const searchToggle = document.getElementById('searchToggle');
    const searchClose = document.getElementById('searchClose');
    const mobileControls = document.querySelector('.mobile-controls');
    const mobileSearchBar = document.querySelector('.mobile-search-bar');
    const searchInputMobile = document.getElementById('searchInputMobile');

    if (searchToggle) {
        searchToggle.addEventListener('click', () => {
            mobileControls.classList.add('hidden');
            mobileSearchBar.classList.add('active');
            searchInputMobile.focus();
        });
    }

    if (searchClose) {
        searchClose.addEventListener('click', () => {
            mobileSearchBar.classList.remove('active');
            mobileControls.classList.remove('hidden');
            searchInputMobile.value = '';
            state.setSearchQuery('');
        });
    }

    if (searchInputMobile) {
        searchInputMobile.addEventListener('input', (e) => {
            state.setSearchQuery(e.target.value.trim().toLowerCase());
        });
    }

    // Debug scale slider
    const scaleSlider = document.getElementById('scaleSlider');
    const scaleValue = document.getElementById('scaleValue');
    if (scaleSlider) {
        scaleSlider.addEventListener('input', async () => {
            const v = parseFloat(scaleSlider.value);
            document.documentElement.style.setProperty('--scale', v);
            scaleValue.textContent = `${v}×`;
            await renderEPG();
        });
    }

    const headerScaleSlider = document.getElementById('headerScaleSlider');
    const headerScaleValue = document.getElementById('headerScaleValue');
    if (headerScaleSlider) {
        headerScaleSlider.addEventListener('input', () => {
            const v = parseFloat(headerScaleSlider.value);
            document.documentElement.style.setProperty('--header-scale', v);
            headerScaleValue.textContent = `${v}×`;
        });
    }

    // Time navigation
    const timeBack = document.getElementById('timeBack');
    const timeForward = document.getElementById('timeForward');

    if (timeBack) {
        timeBack.addEventListener('click', () => {
            state.setTimeOffset(state.timeOffset - 1);
            updateClock();
        });
    }

    if (timeForward) {
        timeForward.addEventListener('click', () => {
            state.setTimeOffset(state.timeOffset + 1);
            updateClock();
        });
    }

    // Touch axis lock — prevent diagonal drift on the EPG scroll container
    const epg = document.getElementById('epg');
    if (epg) {
        let touchStartX = 0;
        let touchStartY = 0;
        let lockedAxis = null;

        epg.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            lockedAxis = null;
            epg.style.touchAction = 'pan-x pan-y';
        }, { passive: true });

        epg.addEventListener('touchmove', (e) => {
            if (lockedAxis) return;
            const dx = Math.abs(e.touches[0].clientX - touchStartX);
            const dy = Math.abs(e.touches[0].clientY - touchStartY);
            if (dx < 4 && dy < 4) return;

            lockedAxis = dx > dy * 2.5 ? 'x' : 'y';
            epg.style.touchAction = lockedAxis === 'y' ? 'pan-y' : 'pan-x';
        }, { passive: true });

        epg.addEventListener('touchend', () => {
            lockedAxis = null;
            epg.style.touchAction = 'pan-x pan-y';
        }, { passive: true });
    }

    // Subscribe to state changes
    state.subscribe(async () => {
        await renderEPG();
    });
}

/**
 * Initialize the application
 */
async function init() {
    try {
        await loadChannels();
        await renderEPG();

        updateClock();
        setInterval(updateClock, 1000);
        setInterval(renderEPG, REFRESH_INTERVAL);

        initEventListeners();
    } catch (error) {
        console.error('Failed to initialize application:', error);
        const container = document.getElementById('epg');
        if (container) {
            container.innerHTML = '<div class="error-state">Failed to initialize application. Please refresh the page.</div>';
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
