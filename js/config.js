// Pixels rendered per minute of program duration
export const PIXELS_PER_MINUTE = 8;
// Minimum block width in pixels (prevents tiny unreadable blocks)
export const MIN_PROGRAM_WIDTH = 120;

// Time constants (milliseconds)
export const MS_PER_HOUR = 3600000;
export const REFRESH_INTERVAL = 10 * 60 * 1000;

// Channel data loaded dynamically
let channelsData = null;

// Regional configuration for API queries and time normalization
export const REGIONAL_CONFIG = {
    'NZ': {
        timezone: 'Pacific/Auckland',
        // epg.pw returns NZ times 1 hour behind — shift corrects the offset
        shift: 1 * 60 * 60 * 1000
    },
    'AU': {
        timezone: 'Australia/Brisbane'
    }
};

/**
 * Load channels from JSON file
 */
export async function loadChannels() {
    if (channelsData) return channelsData;
    
    try {
        const response = await fetch('data/channels.json');
        if (!response.ok) throw new Error(`Failed to load channels: ${response.status}`);
        const data = await response.json();
        channelsData = data.channels;
        return channelsData;
    } catch (error) {
        console.error('Error loading channels:', error);
        return [];
    }
}

/**
 * Get loaded channels (must call loadChannels first)
 */
export function getChannels() {
    return channelsData || [];
}