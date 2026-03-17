import { PIXELS_PER_MINUTE, MIN_PROGRAM_WIDTH, MS_PER_HOUR, getChannels } from './config.js';
import { formatTime, cleanTitle, formatDate } from './utils.js';
import { fetchEPGForChannel } from './api.js';
import { state } from './state.js';

const COLLAPSE_DELAY = 7000; // 7 seconds
let collapseTimeout = null;
let lastRenderId = 0;

/**
 * Collapse a program block
 */
function collapseBlock(block) {
    if (!block) return;
    block.classList.remove('expanded');
    if (block.dataset.expandedWidth) {
        block.style.width = `${block.dataset.originalWidth}px`;
    }
}

/**
 * Create a program block element
 */
function createProgramBlock(program, nextProgram, channelName, now) {
    const start = new Date(program.start_date);
    const end = nextProgram 
        ? new Date(nextProgram.start_date)
        : new Date(start.getTime() + MS_PER_HOUR);
    const isCurrent = start.getTime() <= now && end.getTime() > now;
    
    // Calculate width based on remaining duration for current program
    const displayStart = start.getTime() < now ? now : start.getTime();
    const durationMinutes = (end - displayStart) / 60000;
    const width = Math.max(durationMinutes * PIXELS_PER_MINUTE, MIN_PROGRAM_WIDTH);
    
    const programDiv = document.createElement('div');
    programDiv.className = isCurrent ? 'program program-current' : 'program';
    programDiv.style.width = `${width}px`;
    programDiv.setAttribute('role', 'article');
    programDiv.setAttribute('aria-label', `${cleanTitle(program.title)} from ${formatTime(start)} to ${formatTime(end)}`);
    programDiv.dataset.originalWidth = width;
    
    programDiv.innerHTML = `
        <div class="program-title">${cleanTitle(program.title)}</div>
        <div class="program-time">${formatTime(start)} - ${formatTime(end)} <span class="program-date">${formatDate(start)}</span></div>
    `;
    
    // Check if title is truncated after element is rendered
    requestAnimationFrame(() => {
        const titleElement = programDiv.querySelector('.program-title');
        
        // Expanded width should accommodate the full title and at least enough room for time + date (min 250px)
        const minExpandedWidth = 250;
        const titleNeededWidth = titleElement.scrollWidth + (parseInt(getComputedStyle(programDiv).paddingLeft) * 2) + 20;
        
        programDiv.dataset.expandedWidth = Math.max(width, titleNeededWidth, minExpandedWidth);
        
        // Add click handler for all blocks
        programDiv.style.cursor = 'pointer';
        programDiv.classList.add('program-clickable');
        
        const startCollapseTimer = () => {
            clearTimeout(collapseTimeout);
            collapseTimeout = setTimeout(() => {
                collapseBlock(programDiv);
            }, COLLAPSE_DELAY);
        };

        programDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Collapse any other expanded blocks
            document.querySelectorAll('.program.expanded').forEach(block => {
                if (block !== programDiv) {
                    collapseBlock(block);
                }
            });
            
            // Toggle this block
            if (programDiv.classList.contains('expanded')) {
                collapseBlock(programDiv);
                clearTimeout(collapseTimeout);
            } else {
                programDiv.classList.add('expanded');
                if (programDiv.dataset.expandedWidth) {
                    programDiv.style.width = `${programDiv.dataset.expandedWidth}px`;
                }
                startCollapseTimer();
            }
        });

        // Hover listeners to manage auto-collapse
        programDiv.addEventListener('mouseenter', () => {
            if (programDiv.classList.contains('expanded')) {
                clearTimeout(collapseTimeout);
            }
        });

        programDiv.addEventListener('mouseleave', () => {
            if (programDiv.classList.contains('expanded')) {
                startCollapseTimer();
            }
        });
    });
    
    return programDiv;
}

/**
 * Create a channel row element
 */
function createChannelRow(channelName, programs, channel, now) {
    const row = document.createElement('div');
    row.className = 'channel-row';
    
    const channelNameDiv = document.createElement('div');
    channelNameDiv.className = 'channel-name';
    channelNameDiv.setAttribute('role', 'heading');
    channelNameDiv.setAttribute('aria-level', '2');
    channelNameDiv.setAttribute('aria-label', channelName);
    
    const logo = document.createElement('img');
    logo.className = 'channel-logo';
    logo.src = channel.logo || `assets/logos/${channel.id || channel.xmlid}.webp`;
    logo.alt = `${channelName} logo`;
    logo.loading = 'lazy';
    
    // Fallback logic: try .png if .webp fails, then placeholder
    logo.onerror = () => {
        if (logo.src.endsWith('.webp')) {
            const pngPath = logo.src.replace('.webp', '.png');
            logo.src = pngPath;
        } else {
            logo.style.display = 'none';
            const placeholder = document.createElement('div');
            placeholder.className = 'channel-logo-placeholder';
            placeholder.textContent = channelName.substring(0, 4).toUpperCase();
            placeholder.setAttribute('aria-hidden', 'true');
            channelNameDiv.appendChild(placeholder);
        }
    };
    
    channelNameDiv.appendChild(logo);
    row.appendChild(channelNameDiv);
    
    const programsContainer = document.createElement('div');
    programsContainer.className = 'programs';
    programsContainer.setAttribute('role', 'list');
    programsContainer.setAttribute('aria-label', `${channelName} programs`);
    
    if (programs.length > 0) {
        programs.forEach((program, i) => {
            const programBlock = createProgramBlock(program, programs[i + 1], channelName, now);
            programBlock.setAttribute('role', 'listitem');
            programsContainer.appendChild(programBlock);
        });
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'program program-empty';
        placeholder.innerHTML = '<div class="program-title">No data available</div>';
        programsContainer.appendChild(placeholder);
    }
    
    row.appendChild(programsContainer);
    
    return row;
}

/**
 * Filter and sort channels based on current state
 */
function getFilteredChannels() {
    const filters = state.getFilters();
    let filtered = [...getChannels()];
    
    if (filters.category !== 'all') {
        filtered = filtered.filter(ch => ch.category === filters.category);
    }
    
    if (filters.region !== 'all') {
        filtered = filtered.filter(ch => ch.region === filters.region);
    }

    // Custom sorting: Region (NZ, UK, US) then Category (entertainment, sport, news)
    const regionPriority = { 'NZ': 1, 'UK': 2, 'US': 3 };
    const categoryPriority = { 'entertainment': 1, 'sport': 2, 'news': 3 };

    return filtered.sort((a, b) => {
        // First sort by region priority
        const aRegionPrio = regionPriority[a.region] || 99;
        const bRegionPrio = regionPriority[b.region] || 99;
        
        if (aRegionPrio !== bRegionPrio) {
            return aRegionPrio - bRegionPrio;
        }
        
        // Then sort by category priority
        const aCatPrio = categoryPriority[a.category] || 99;
        const bCatPrio = categoryPriority[b.category] || 99;
        
        if (aCatPrio !== bCatPrio) {
            return aCatPrio - bCatPrio;
        }
        
        // Finally sort by name
        return a.name.localeCompare(b.name);
    });
}

/**
 * Render the EPG grid
 */
export async function renderEPG() {
    const container = document.getElementById('epg');
    const renderId = ++lastRenderId;
    const now = Date.now();
    
    // Only show loading if empty
    if (!container.querySelector('.epg-grid')) {
        container.innerHTML = '<div class="loading">Loading EPG data...</div>';
    }
    
    const filteredChannels = getFilteredChannels();
    
    if (filteredChannels.length === 0) {
        container.innerHTML = '<div class="empty-state">No channels match your filters</div>';
        return;
    }
    
    try {
        // Fetch all channels in parallel
        const channelPromises = filteredChannels.map(async (channel) => {
            if (channel.id || channel.xmlid) {
                const programs = await fetchEPGForChannel(channel, now);
                return { channel, programs };
            }
            return { channel, programs: [] };
        });
        
        const channelData = await Promise.all(channelPromises);
        
        // Bail if a newer render has started
        if (renderId !== lastRenderId) return;

        const grid = document.createElement('div');
        grid.className = 'epg-grid';
        grid.setAttribute('role', 'region');
        grid.setAttribute('aria-label', 'Electronic Program Guide');
        
        channelData.forEach(({ channel, programs }) => {
            const row = createChannelRow(channel.name, programs, channel, now);
            grid.appendChild(row);
        });
        
        container.innerHTML = '';
        container.appendChild(grid);
    } catch (error) {
        console.error('Failed to render EPG:', error);
        container.innerHTML = '<div class="error-state">Failed to load EPG data. Please try again.</div>';
    }
}

/**
 * Update the clock display
 */
export function updateClock() {
    const clockElement = document.getElementById('clock');
    if (clockElement) {
        const now = new Date();
        clockElement.innerHTML = `${formatTime(now)} <span class="header-date">${formatDate(now)}</span>`;
    }
}
