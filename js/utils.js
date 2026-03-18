/**
 * Format a Date object to HH:MM string
 * @param {Date} date - The date to format
 * @returns {string} Formatted time string
 */
export function formatTime(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Format a Date object to DD/MM string
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    return `${months[date.getMonth()]} ${date.getDate()}`;
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
 * Get date string in YYYYMMDD format
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
export function getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * Parse XMLTV date string (YYYYMMDDHHMMSS +Offset)
 * @param {string} xmltvDate - Date string from XMLTV
 * @returns {Date} JavaScript Date object
 */
export function parseXMLTVDate(xmltvDate) {
    if (!xmltvDate) return null;
    const parts = xmltvDate.split(' ');
    const s = parts[0];
    const offset = parts[1] || '';
    
    const year = s.substring(0, 4);
    const month = s.substring(4, 6);
    const day = s.substring(6, 8);
    const hour = s.substring(8, 10);
    const min = s.substring(10, 12);
    const sec = s.substring(12, 14);
    
    // Format to ISO with offset if present
    let iso = `${year}-${month}-${day}T${hour}:${min}:${sec}`;
    if (offset) {
        const offsetSign = offset.substring(0, 1);
        const offsetHours = offset.substring(1, 3);
        const offsetMins = offset.substring(3, 5);
        iso += `${offsetSign}${offsetHours}:${offsetMins}`;
    } else {
        iso += 'Z';
    }
    
    return new Date(iso);
}