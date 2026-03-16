/**
 * Format a Date object to HH:MM string
 * @param {Date} date - The date to format
 * @returns {string} Formatted time string
 */
export function formatTime(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Clean program title by removing special characters
 * @param {string} title - The title to clean
 * @returns {string} Cleaned title
 */
export function cleanTitle(title) {
    return (title || '').replace(/^[⋗⋖\s]+/, '').trim();
}

/**
 * Apply timezone offset to a date without mutation
 * @param {Date} date - The original date
 * @param {number} offsetHours - Hours to offset
 * @returns {Date} New date with offset applied
 */
export function applyTimezoneOffset(date, offsetHours) {
    const newDate = new Date(date);
    newDate.setHours(newDate.getHours() + offsetHours);
    return newDate;
}

/**
 * Get date string in YYYYMMDD format
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
export function getDateString(date) {
    return date.toISOString().split('T')[0].replace(/-/g, '');
}
