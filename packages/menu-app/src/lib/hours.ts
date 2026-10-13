interface DayHours {
  open: string;
  close: string;
}

interface OperatingHours {
  [day: string]: DayHours;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getCurrentDayIndex(tz: string, now: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' });
  const dayName = formatter.format(now);
  return DAYS.indexOf(dayName);
}

function getCurrentTimeInMinutes(tz: string, now: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const time = formatter.format(now);
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function isOpenNow(operatingHours: OperatingHours | null | undefined, timezone: string, now: Date): boolean | null {
  if (!operatingHours) return null;

  const dayIndex = getCurrentDayIndex(timezone, now);
  const currentTime = getCurrentTimeInMinutes(timezone, now);
  const dayName = DAYS[dayIndex];

  const dayHours = operatingHours[dayName];
  if (!dayHours) return null;

  const openTime = timeToMinutes(dayHours.open);
  const closeTime = timeToMinutes(dayHours.close);

  // Handle overnight closing (e.g., close at 02:00 means next day)
  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime < closeTime;
  }

  return currentTime >= openTime && currentTime < closeTime;
}

export function getTodayHours(operatingHours: OperatingHours | null | undefined, timezone: string, now: Date): { open: string; close: string } | null {
  if (!operatingHours) return null;

  const dayIndex = getCurrentDayIndex(timezone, now);
  const dayName = DAYS[dayIndex];

  return operatingHours[dayName] || null;
}

export function getWeekHours(operatingHours: OperatingHours | null | undefined): { day: string; open: string; close: string }[] | null {
  if (!operatingHours) return null;

  return DAYS.map((day) => {
    const hours = operatingHours[day];
    return {
      day,
      open: hours?.open || '—',
      close: hours?.close || '—',
    };
  });
}

export function getNextOpenTime(operatingHours: OperatingHours | null | undefined, timezone: string, now: Date): string | null {
  if (!operatingHours) return null;

  let dayIndex = getCurrentDayIndex(timezone, now);
  let currentTime = getCurrentTimeInMinutes(timezone, now);

  for (let i = 0; i < 7; i++) {
    const dayName = DAYS[(dayIndex + i) % 7];
    const dayHours = operatingHours[dayName];

    if (!dayHours) continue;

    const openTime = timeToMinutes(dayHours.open);
    const closeTime = timeToMinutes(dayHours.close);

    if (i === 0) {
      // Today
      if (closeTime < openTime) {
        // Overnight closing
        if (currentTime >= openTime) {
          return null; // Opens until tomorrow
        } else if (currentTime < closeTime) {
          return null; // Currently open
        }
      } else {
        if (currentTime < openTime) {
          const h = Math.floor(openTime / 60);
          const m = openTime % 60;
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        } else if (currentTime < closeTime) {
          return null; // Currently open
        }
      }
    } else {
      // Future day
      const h = Math.floor(openTime / 60);
      const m = openTime % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${dayName}`;
    }
  }

  return null;
}
