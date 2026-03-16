import { REFRESH_INTERVAL, loadChannels } from './config.js';
import { renderEPG, updateClock } from './ui.js';
import { state } from './state.js';

/**
 * Initialize event listeners
 */
function initEventListeners() {
    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            state.setCategoryFilter(e.target.value);
        });
    }
    
    // Region filter
    const regionFilter = document.getElementById('regionFilter');
    if (regionFilter) {
        regionFilter.addEventListener('change', (e) => {
            state.setRegionFilter(e.target.value);
        });
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
        // Load channels first
        await loadChannels();
        
        // Initial render
        await renderEPG();
        
        // Start clock
        updateClock();
        setInterval(updateClock, 1000);
        
        // Auto-refresh EPG
        setInterval(renderEPG, REFRESH_INTERVAL);
        
        // Setup event listeners
        initEventListeners();
    } catch (error) {
        console.error('Failed to initialize application:', error);
        const container = document.getElementById('epg');
        if (container) {
            container.innerHTML = '<div class="error-state">Failed to initialize application. Please refresh the page.</div>';
        }
    }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
