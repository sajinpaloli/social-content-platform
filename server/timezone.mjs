export const APP_TIME_ZONE = 'Europe/London';

export function toAppDateTimeInput(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function fromAppDateTimeInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) return new Date(raw);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return new Date(raw);
  const [, year, month, day, hour, minute, second = '0'] = match;
  const wanted = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  let guess = wanted;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    guess += wanted - represented;
  }
  return new Date(guess);
}
