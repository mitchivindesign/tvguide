import { MS_PER_DAY, REGIONAL_CONFIG } from './config.js';
import { getDateString, parseXMLTVDate } from './utils.js';

const API_BASE_URL = 'https://epg.pw/api/epg.json';

// Fetch cache: { channelId: { programs: Array, timestamp: number } }
const epgCache = new Map();
// XML document cache: { url: { doc: Document, timestamp: number } }
const xmlCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch EPG data for a channel from various sources (JSON or XMLTV)
 * @param {Object} channel - The channel object from channels.json
 * @param {number} [now=Date.now()] - Synchronized current timestamp
 * @returns {Promise<Array>} Array of programs
 */
export async function fetchEPGForChannel(channel, now = Date.now()) {
    const { id, region, source = 'epg.pw', xmlid, url } = channel;
    
    // Check cache
    const cached = epgCache.get(id || xmlid);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        // Find indices in full cached program list using synchronized 'now'
        const startIndex = findCurrentProgramIndex(cached.programs, now);
        return cached.programs.slice(startIndex);
    }

    try {
        let programs = [];
        if (source === 'xmltv') {
            programs = await fetchXMLTVPrograms(url, xmlid);
        } else {
            programs = await fetchJSONPrograms(id, region, now);
        }

        // Cache result with FULL list (no slicing yet)
        epgCache.set(id || xmlid, {
            programs,
            timestamp: now
        });

        const startIndex = findCurrentProgramIndex(programs, now);
        return programs.slice(startIndex);
    } catch (error) {
        console.error(`Failed to fetch EPG for channel ${channel.name}:`, error);
        return [];
    }
}

/**
 * Fetch programs from XMLTV source
 */
async function fetchXMLTVPrograms(url, xmlid) {
    const fetchTime = Date.now();
    let doc;

    const cachedXml = xmlCache.get(url);
    if (cachedXml && (fetchTime - cachedXml.timestamp) < CACHE_DURATION) {
        doc = cachedXml.doc;
    } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`XML fetch failed: ${response.status}`);
        const text = await response.text();
        doc = new DOMParser().parseFromString(text, 'text/xml');
        xmlCache.set(url, { doc, timestamp: fetchTime });
    }

    const programs = [];
    const nodes = doc.querySelectorAll(`programme[channel="${xmlid}"]`);
    
    nodes.forEach(node => {
        const start = parseXMLTVDate(node.getAttribute('start'));
        const stop = parseXMLTVDate(node.getAttribute('stop'));
        const title = node.querySelector('title')?.textContent || 'No Title';
        const desc = node.querySelector('desc')?.textContent || '';
        
        programs.push({
            start_date: start.toISOString(),
            title: title,
            desc: desc,
            duration: (stop.getTime() - start.getTime()) / 60000
        });
    });

    return programs.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
}

/**
 * Fetch programs from JSON source (epg.pw)
 */
async function fetchJSONPrograms(channelId, region, now) {
    const regional = REGIONAL_CONFIG[region] || {};
    const tz = regional.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const nowObj = new Date(now);
    const today = getDateString(nowObj);
    const tomorrow = getDateString(new Date(now + MS_PER_DAY));
    const encodedTz = btoa(tz);
    const tzParam = `&timezone=${encodedTz}`;
    
    const [todayData, tomorrowData] = await Promise.all([
        fetch(`${API_BASE_URL}?lang=en&channel_id=${channelId}&date=${today}${tzParam}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status)),
        fetch(`${API_BASE_URL}?lang=en&channel_id=${channelId}&date=${tomorrow}${tzParam}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
    ]);
    
    return processPrograms(todayData, tomorrowData, now, regional.shift);
}

/**
 * Process and normalize program times
 */
function processPrograms(today, tomorrow, now, shift = 0) {
    const allPrograms = [...(today.epg_list || []), ...(tomorrow.epg_list || [])].map(p => {
        if (!shift) return p;
        const shiftedStart = new Date(new Date(p.start_date).getTime() + shift);
        return { ...p, start_date: shiftedStart.toISOString() };
    });
    
    return allPrograms;
}

/**
 * Find the index of the current or next program
 */
function findCurrentProgramIndex(programs, now) {
    for (let i = 0; i < programs.length; i++) {
        const programStart = new Date(programs[i].start_date);
        const nextProgramStart = programs[i + 1] 
            ? new Date(programs[i + 1].start_date)
            : null;
        
        if (programStart.getTime() <= now && (!nextProgramStart || nextProgramStart.getTime() > now)) {
            return i;
        }
        
        if (programStart.getTime() > now) {
            return i;
        }
    }
    
    return 0;
}
