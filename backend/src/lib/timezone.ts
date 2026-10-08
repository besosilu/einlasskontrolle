// "Today" is the day of the gate, not the day of a UTC server. Must be imported before any Date logic runs.
process.env['TZ'] ||= 'Europe/Berlin';

export const APP_TIMEZONE = process.env['TZ'];
