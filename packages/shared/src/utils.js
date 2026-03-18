/**
 * Format wait time for display
 * @param {number} minutes
 * @returns {string}
 */
export function formatWaitTime(minutes) {
  if (minutes === 0) return 'Ready now';
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

/**
 * Format paise to INR currency string
 * @param {number} paise
 * @returns {string}
 */
export function formatPaise(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(paise / 100);
}

/**
 * Generate customer-facing queue URL
 * @param {string} restaurantSlug
 * @param {string} baseUrl
 * @returns {string}
 */
export function generateQueueUrl(restaurantSlug, baseUrl = 'https://app.qflow.in') {
  return `${baseUrl}/r/${restaurantSlug}`;
}

/**
 * Get elapsed minutes since a given timestamp
 * @param {string} joinedAt - ISO 8601 timestamp
 * @returns {number}
 */
export function getElapsedMinutes(joinedAt) {
  return Math.floor((Date.now() - new Date(joinedAt)) / 60000);
}

/**
 * Generate a URL-safe slug from a string
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Clamp a number between min and max
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
