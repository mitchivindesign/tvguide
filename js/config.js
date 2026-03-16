// Display constants
export const PIXELS_PER_MINUTE = 8;
export const MIN_PROGRAM_WIDTH = 120;

// Time constants (milliseconds)
export const MS_PER_DAY = 86400000;
export const MS_PER_HOUR = 3600000;
export const MS_PER_MINUTE = 60000;
export const REFRESH_INTERVAL = 10 * MS_PER_MINUTE;

// Channel data loaded dynamically
let channelsData = null;

/**
 * Load channels from JSON file
 * 
 * TIMEZONE OFFSET LOGIC:
 * The API returns times inconsistently depending on channel type:
 * - Sports channels: API returns UTC times (offset: 0 for UK/US, +2 for NZ to convert UTC-8 to UTC+10)
 * - News channels: API returns times in user's local timezone UTC+10 (offset: -10 to convert back to UTC)
 * - Entertainment channels: API returns UTC times (offset: 0 for UK/US)
 * 
 * User timezone: UTC+10 (Brisbane/Sydney)
 * NZ channels: timezoneOffset +2 (API returns UTC-8, need to add 2 to match UTC+10)
 * UK/US sports: timezoneOffset 0 (API returns UTC)
 * UK/US news: timezoneOffset -10 (API returns UTC+10, subtract 10 to get UTC)
 * UK/US entertainment: timezoneOffset 0 (API returns UTC)
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
