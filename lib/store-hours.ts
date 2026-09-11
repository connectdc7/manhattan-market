// Store hours — one place both the Hours & Location page and the live
// "open now" status on the homepage read from. Update the times here (and
// the timezone, if the real store isn't in New York) once you have the
// real schedule from your friend.
//
// Times are 24-hour "HH:mm" in STORE_TIMEZONE, regardless of where the
// server or the visitor's browser happens to be — that's what makes
// "open now" correct for everyone, not just people in the same timezone
// as whoever's viewing the site.

export const STORE_TIMEZONE = "America/New_York";

export type DayHours = { day: string; open: string; close: string };

// Sunday = 0 .. Saturday = 6, matching Date#getDay().
export const HOURS: DayHours[] = [
  { day: "Sunday", open: "07:00", close: "22:00" },
  { day: "Monday", open: "06:00", close: "23:00" },
  { day: "Tuesday", open: "06:00", close: "23:00" },
  { day: "Wednesday", open: "06:00", close: "23:00" },
  { day: "Thursday", open: "06:00", close: "23:00" },
  { day: "Friday", open: "06:00", close: "23:00" },
  { day: "Saturday", open: "06:00", close: "23:00" },
];

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, "0")}${period}`;
}

export const HOURS_DISPLAY = HOURS.map((h) => ({
  day: h.day,
  time: `${formatTime(h.open)} – ${formatTime(h.close)}`,
}));

// Returns the store's current wall-clock day/time in STORE_TIMEZONE,
// independent of the server's own timezone (Vercel functions run in UTC).
function storeNow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayShort = get("weekday");
  const hour = get("hour") === "24" ? "00" : get("hour");
  const minute = get("minute");

  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayIndex = WEEKDAYS.indexOf(weekdayShort);
  const minutesSinceMidnight = Number(hour) * 60 + Number(minute);
  return { dayIndex, minutesSinceMidnight };
}

// Today's date, as the store sees it (STORE_TIMEZONE), formatted "YYYY-MM-DD".
// Used anywhere something needs to change once per store-local calendar day —
// e.g. the homepage's "Product of the Day" rotation — regardless of what
// timezone the server or the visitor happens to be in.
export function getStoreDateKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export type StoreStatus =
  | { isOpen: true; closesAt: string }
  | { isOpen: false; opensAt: string; opensDay: "today" | string };

export function getStoreStatus(now: Date = new Date()): StoreStatus {
  const { dayIndex, minutesSinceMidnight } = storeNow(now);
  const today = HOURS[dayIndex];

  if (
    today &&
    minutesSinceMidnight >= toMinutes(today.open) &&
    minutesSinceMidnight < toMinutes(today.close)
  ) {
    return { isOpen: true, closesAt: formatTime(today.close) };
  }

  // Not open now — find the next day (starting with today, if it hasn't
  // opened yet) that has hours, up to a week out.
  for (let offset = 0; offset < 7; offset++) {
    const idx = (dayIndex + offset) % 7;
    const candidate = HOURS[idx];
    if (!candidate) continue;
    if (offset === 0 && minutesSinceMidnight >= toMinutes(candidate.open)) continue; // already closed for today
    return {
      isOpen: false,
      opensAt: formatTime(candidate.open),
      opensDay: offset === 0 ? "today" : candidate.day,
    };
  }

  return { isOpen: false, opensAt: formatTime(HOURS[0].open), opensDay: HOURS[0].day };
}
