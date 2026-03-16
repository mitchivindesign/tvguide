import { MS_PER_DAY } from './config.js';
import { applyTimezoneOffset, getDateString } from './utils.js';

const API_BASE_URL = 'https://epg.pw/api/epg.json';

// Cache structure: { channelId: { today: data, tomorrow: data, timestamp: number } }
const epgCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch EPG data for a specific channel with caching
 * @param {number} channelId - The channel ID
 * @param {number} timezoneOffset - Timezone offset in hours
 * @returns {Promise<Array>} Array of programs starting from current time
 */
export async function fetchEPGForChannel(channelId, timezoneOffset) {
    try {
        const today = getDateString(new Date());
        const tomorrow = getDateString(new Date(Date.now() + MS_PER_DAY));
        const now = Date.now();
        
        // Check cache
        const cached = epgCache.get(channelId);
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
            const allPrograms = [...(cached.today.epg_list || []), ...(cached.tomorrow.epg_list || [])];
            const startIndex = findCurrentProgramIndex(allPrograms, now, timezoneOffset);
            return allPrograms.slice(startIndex);
        }
        
        // Fetch fresh data
        const [todayData, tomorrowData] = await Promise.all([
            fetch(`${API_BASE_URL}?lang=en&channel_id=${channelId}&date=${today}`).then(r => {
                if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
                return r.json();
            }),
            fetch(`${API_BASE_URL}?lang=en&channel_id=${channelId}&date=${tomorrow}`).then(r => {
                if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
                return r.json();
            })
        ]);
        
        // Update cache
        epgCache.set(channelId, {
            today: todayData,
            tomorrow: tomorrowData,
            timestamp: now
        });
        
        const allPrograms = [...(todayData.epg_list || []), ...(tomorrowData.epg_list || [])];
        const startIndex = findCurrentProgramIndex(allPrograms, now, timezoneOffset);
        
        return allPrograms.slice(startIndex);
    } catch (error) {
        console.error(`Failed to fetch EPG for channel ${channelId}:`, error);
        return [];
    }
}

/**
 * Clear the EPG cache (useful for manual refresh)
 */
export function clearCache() {
    epgCache.clear();
}

/**
 * Find the index of the current or next program
 * @param {Array} programs - Array of program objects
 * @param {number} now - Current timestamp
 * @param {number} timezoneOffset - Timezone offset in hours
 * @returns {number} Index of current/next program
 */
function findCurrentProgramIndex(programs, now, timezoneOffset) {
    for (let i = 0; i < programs.length; i++) {
        const programStart = applyTimezoneOffset(new Date(programs[i].start_date), timezoneOffset);
        const nextProgramStart = programs[i + 1] 
            ? applyTimezoneOffset(new Date(programs[i + 1].start_date), timezoneOffset)
            : null;
        
        // If we're in this program
        if (programStart.getTime() <= now && (!nextProgramStart || nextProgramStart.getTime() > now)) {
            return i;
        }
        
        // If this program starts in the future
        if (programStart.getTime() > now) {
            return i;
        }
    }
    
    return 0;
}
