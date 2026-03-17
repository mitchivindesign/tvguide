import { PIXELS_PER_MINUTE, MIN_PROGRAM_WIDTH, MS_PER_HOUR, getChannels } from './config.js';
import { formatTime, cleanTitle, applyTimezoneOffset } from './utils.js';
import { fetchEPGForChannel } from './api.js';
import { state } from './state.js';

/**
 * Create a program block element
 */
function createProgramBlock(program, nextProgram, timezoneOffset, channelName) {
    const start = applyTimezoneOffset(new Date(program.start_date), timezoneOffset);
    const end = nextProgram 
        ? applyTimezoneOffset(new Date(nextProgram.start_date), timezoneOffset)
        : new Date(start.getTime() + MS_PER_HOUR);
    
    const now = Date.now();
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
        <div class="program-time">${formatTime(start)} - ${formatTime(end)}</div>
    `;
    
    // Check if title is truncated after element is rendered
    requestAnimationFrame(() => {
        const titleElement = programDiv.querySelector('.program-title');
        const isTruncated = titleElement.scrollWidth > titleElement.clientWidth;
        
        // Store the width needed for full text before any modifications
        if (isTruncated) {
            const neededWidth = titleElement.scrollWidth + (parseInt(getComputedStyle(programDiv).paddingLeft) * 2) + 20; // Add 20px buffer
            programDiv.dataset.expandedWidth = Math.max(width, neededWidth, 120);
        }
        
        // Only add click handler if text is truncated
        if (isTruncated) {
            programDiv.style.cursor = 'pointer';
            programDiv.classList.add('program-clickable');
            
            programDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Collapse any other expanded blocks
                document.querySelectorAll('.program.expanded').forEach(block => {
                    if (block !== programDiv) {
                        block.classList.remove('expanded');
                        block.style.width = `${block.dataset.originalWidth}px`;
                    }
                });
                
                // Toggle this block
                if (programDiv.classList.contains('expanded')) {
                    programDiv.classList.remove('expanded');
                    programDiv.style.width = `${width}px`;
                } else {
                    programDiv.classList.add('expanded');
                    programDiv.style.width = `${programDiv.dataset.expandedWidth}px`;
                }
            });
        }
    });
    
    return programDiv;
}

/**
 * Create a channel row element
 */
function createChannelRow(channelName, programs, timezoneOffset, channelId) {
    const row = document.createElement('div');
    row.className = 'channel-row';
    
    const channelNameDiv = document.createElement('div');
    channelNameDiv.className = 'channel-name';
    channelNameDiv.setAttribute('role', 'heading');
    channelNameDiv.setAttribute('aria-level', '2');
    channelNameDiv.setAttribute('aria-label', channelName);
    
    const logo = document.createElement('img');
    logo.className = 'channel-logo';
    logo.src = `assets/logos/${channelId}.webp`;
    logo.alt = `${channelName} logo`;
    logo.loading = 'lazy';
    
    // Fallback to placeholder on error
    logo.onerror = () => {
        logo.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.className = 'channel-logo-placeholder';
        placeholder.textContent = 'LOGO';
        placeholder.setAttribute('aria-hidden', 'true');
        channelNameDiv.appendChild(placeholder);
    };
    
    channelNameDiv.appendChild(logo);
    row.appendChild(channelNameDiv);
    
    const programsContainer = document.createElement('div');
    programsContainer.className = 'programs';
    programsContainer.setAttribute('role', 'list');
    programsContainer.setAttribute('aria-label', `${channelName} programs`);
    
    if (programs.length > 0) {
        programs.forEach((program, i) => {
            const programBlock = createProgramBlock(program, programs[i + 1], timezoneOffset, channelName);
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
 * Filter channels based on current state
 */
function getFilteredChannels() {
    const filters = state.getFilters();
    let filtered = getChannels();
    
    if (filters.category !== 'all') {
        filtered = filtered.filter(ch => ch.category === filters.category);
    }
    
    if (filters.region !== 'all') {
        filtered = filtered.filter(ch => ch.region === filters.region);
    }
    
    return filtered;
}

/**
 * Render the EPG grid
 */
export async function renderEPG() {
    const container = document.getElementById('epg');
    
    // Show loading state
    container.innerHTML = '<div class="loading">Loading EPG data...</div>';
    
    const filteredChannels = getFilteredChannels();
    
    if (filteredChannels.length === 0) {
        container.innerHTML = '<div class="empty-state">No channels match your filters</div>';
        return;
    }
    
    try {
        // Fetch all channels in parallel
        const channelPromises = filteredChannels.map(async (channel) => {
            if (channel.id) {
                const programs = await fetchEPGForChannel(channel.id, channel.timezoneOffset);
                return { channel, programs };
            }
            return { channel, programs: [] };
        });
        
        const channelData = await Promise.all(channelPromises);
        
        const grid = document.createElement('div');
        grid.className = 'epg-grid';
        grid.setAttribute('role', 'region');
        grid.setAttribute('aria-label', 'Electronic Program Guide');
        
        channelData.forEach(({ channel, programs }) => {
            const row = createChannelRow(channel.name, programs, channel.timezoneOffset, channel.id);
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
        clockElement.textContent = formatTime(new Date());
    }
}
