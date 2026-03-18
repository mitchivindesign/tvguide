import { PIXELS_PER_MINUTE, MIN_PROGRAM_WIDTH, MS_PER_HOUR, getChannels } from './config.js';
import { formatTime, cleanTitle, formatDate } from './utils.js';
import { fetchEPGForChannel } from './api.js';
import { state } from './state.js';

const COLLAPSE_DELAY = 7000;
let lastRenderId = 0;

function collapseBlock(block) {
    if (!block) return;
    block.classList.remove('expanded');
    if (block.dataset.originalWidth) {
        block.style.width = `${block.dataset.originalWidth}px`;
    }
}

function getScale() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale')) || 1;
}

function createProgramBlock(program, nextProgram, now) {
    const start = new Date(program.start_date);
    const end = nextProgram
        ? new Date(nextProgram.start_date)
        : new Date(start.getTime() + MS_PER_HOUR);
    const isCurrent = start.getTime() <= now && end.getTime() > now;

    const scale = getScale();
    const displayStart = start.getTime() < now ? now : start.getTime();
    const durationMinutes = (end - displayStart) / 60000;
    const width = Math.max(durationMinutes * PIXELS_PER_MINUTE * scale, MIN_PROGRAM_WIDTH * scale);

    const programDiv = document.createElement('div');
    programDiv.className = isCurrent ? 'program program-current' : 'program';
    programDiv.style.width = `${width}px`;
    programDiv.setAttribute('role', 'listitem');
    programDiv.setAttribute('aria-label', `${cleanTitle(program.title)} from ${formatTime(start)} to ${formatTime(end)}`);
    programDiv.dataset.originalWidth = width;

    programDiv.innerHTML = `
        <div class="program-title">${cleanTitle(program.title)}</div>
        <div class="program-time">${formatTime(start)} - ${formatTime(end)} <span class="program-date">${formatDate(start)}</span></div>
    `;

    const titleElement = programDiv.querySelector('.program-title');
    let collapseTimeout = null;

    const startCollapseTimer = () => {
        clearTimeout(collapseTimeout);
        collapseTimeout = setTimeout(() => collapseBlock(programDiv), COLLAPSE_DELAY);
    };

    programDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.program.expanded').forEach(block => {
            if (block !== programDiv) collapseBlock(block);
        });
        if (programDiv.classList.contains('expanded')) {
            collapseBlock(programDiv);
            clearTimeout(collapseTimeout);
        } else {
            const currentScale = getScale();
            const titleWidth = titleElement.scrollWidth + (parseInt(getComputedStyle(programDiv).paddingLeft) * 2) + 20;
            const expandedWidth = Math.max(parseFloat(programDiv.dataset.originalWidth), titleWidth, 250 * currentScale);
            programDiv.classList.add('expanded');
            programDiv.style.width = `${expandedWidth}px`;
            startCollapseTimer();
        }
    });

    programDiv.addEventListener('mouseenter', () => {
        if (programDiv.classList.contains('expanded')) clearTimeout(collapseTimeout);
    });

    programDiv.addEventListener('mouseleave', () => {
        if (programDiv.classList.contains('expanded')) startCollapseTimer();
    });

    return programDiv;
}

function createChannelRow(channel, programs, now) {
    const row = document.createElement('div');
    row.className = 'channel-row';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'channel-name';
    nameDiv.setAttribute('role', 'heading');
    nameDiv.setAttribute('aria-level', '2');
    nameDiv.setAttribute('aria-label', channel.name);

    const logo = document.createElement('img');
    logo.className = 'channel-logo';
    logo.src = channel.logo || `assets/logos/${channel.id || channel.xmlid}.png`;
    logo.alt = `${channel.name} logo`;
    logo.loading = 'lazy';
    nameDiv.appendChild(logo);
    row.appendChild(nameDiv);

    const programsContainer = document.createElement('div');
    programsContainer.className = 'programs';
    programsContainer.setAttribute('role', 'list');
    programsContainer.setAttribute('aria-label', `${channel.name} programs`);

    if (programs.length > 0) {
        programs.forEach((program, i) => {
            const block = createProgramBlock(program, programs[i + 1], now);
            if (block.classList.contains('program-current')) row.classList.add('has-current');
            programsContainer.appendChild(block);
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

function getFilteredChannels() {
    const { region, category } = state.getFilters();
    let filtered = [...getChannels()];

    if (category !== 'all') filtered = filtered.filter(ch => ch.category === category);
    if (region !== 'all') filtered = filtered.filter(ch => ch.region === region);

    const regionPriority = { NZ: 1, UK: 2, AU: 3, US: 4 };
    const categoryPriority = { sport: 1, entertainment: 2, lifestyle: 3, movies: 4, news: 5 };

    return filtered.sort((a, b) => {
        const rDiff = (regionPriority[a.region] || 99) - (regionPriority[b.region] || 99);
        if (rDiff !== 0) return rDiff;
        return (categoryPriority[a.category] || 99) - (categoryPriority[b.category] || 99);
    });
}

export async function renderEPG() {
    const container = document.getElementById('epg');
    const renderId = ++lastRenderId;
    const { timeOffset } = state.getFilters();
    const now = Date.now() + (timeOffset * MS_PER_HOUR);

    if (!container.querySelector('.epg-grid')) {
        container.innerHTML = '<div class="loading">Loading EPG data...</div>';
    }

    const filteredChannels = getFilteredChannels();

    if (filteredChannels.length === 0) {
        container.innerHTML = '<div class="empty-state">No channels match your filters</div>';
        return;
    }

    try {
        const channelData = await Promise.all(
            filteredChannels.map(async (channel) => ({
                channel,
                programs: (channel.id || channel.xmlid) ? await fetchEPGForChannel(channel, now) : []
            }))
        );

        if (renderId !== lastRenderId) return;

        const { search } = state.getFilters();
        const grid = document.createElement('div');
        grid.className = 'epg-grid';
        grid.setAttribute('role', 'region');
        grid.setAttribute('aria-label', 'Electronic Program Guide');

        channelData.forEach(({ channel, programs }) => {
            let displayPrograms = programs;
            if (search) {
                displayPrograms = programs.filter(p => cleanTitle(p.title).toLowerCase().includes(search));
                if (displayPrograms.length === 0) return;
            }
            grid.appendChild(createChannelRow(channel, displayPrograms, now));
        });

        container.innerHTML = '';
        container.appendChild(grid);
    } catch (error) {
        console.error('Failed to render EPG:', error);
        container.innerHTML = '<div class="error-state">Failed to load EPG data. Please try again.</div>';
    }
}

export function updateClock() {
    const { timeOffset } = state.getFilters();
    const label = document.getElementById('timeLabel');
    const backBtn = document.getElementById('timeBack');
    if (!label) return;

    const viewTime = timeOffset === 0 ? new Date() : new Date(Date.now() + timeOffset * MS_PER_HOUR);
    label.innerHTML = `<span class="clock-time">${formatTime(viewTime)}</span>`;
    if (backBtn) backBtn.disabled = timeOffset === 0;
}