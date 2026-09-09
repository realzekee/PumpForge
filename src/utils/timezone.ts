/**
 * Device Timezone & Liquid Glass Date Utilities
 * Automatically adjusts and displays timestamps according to the viewer's device timezone
 * (e.g. US, Italy, Philippines, or any global locale).
 */

export interface DeviceTimezoneInfo {
  timeZone: string;
  gmtOffset: string;
  formattedName: string;
}

/**
 * Returns user's detected local device timezone name (e.g. "Asia/Manila", "Europe/Rome", "America/New_York")
 */
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (e) {
    return "UTC";
  }
}

/**
 * Returns detailed timezone information for the current device
 */
export function getDeviceTimezoneInfo(): DeviceTimezoneInfo {
  const timeZone = getDeviceTimezone();
  let gmtOffset = "GMT";
  let formattedName = timeZone.replace(/_/g, " ");

  try {
    const now = new Date();
    // Use formatToParts to extract GMT offset or timezone abbreviation
    const formatter = new Intl.DateTimeFormat(undefined, {
      timeZone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (tzPart) {
      gmtOffset = tzPart.value;
    } else {
      // Fallback manual offset calculation
      const offsetMinutes = -now.getTimezoneOffset();
      const sign = offsetMinutes >= 0 ? "+" : "-";
      const hours = Math.floor(Math.abs(offsetMinutes) / 60);
      const mins = Math.abs(offsetMinutes) % 60;
      gmtOffset = `GMT${sign}${hours}${mins > 0 ? `:${mins.toString().padStart(2, "0")}` : ""}`;
    }
  } catch (err) {
    const offsetMinutes = -new Date().getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const hours = Math.floor(Math.abs(offsetMinutes) / 60);
    gmtOffset = `GMT${sign}${hours}`;
  }

  // Friendly location label (e.g. "Manila (GMT+8)", "Rome (GMT+2)", "New York (GMT-4)")
  const city = timeZone.includes("/") ? timeZone.split("/").pop()!.replace(/_/g, " ") : timeZone;
  formattedName = `${city} (${gmtOffset})`;

  return {
    timeZone,
    gmtOffset,
    formattedName,
  };
}

/**
 * Parses any incoming date string (ISO, local date, timestamp) safely into a Date object
 */
export function parseDateSafe(input: string | Date | undefined | null): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  // Try standard parse
  const parsed = Date.parse(input);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  // Relative string fallbacks
  const lower = String(input).toLowerCase();
  const now = new Date();
  if (lower.includes("hour")) {
    const match = lower.match(/\d+/);
    now.setHours(now.getHours() + (match ? parseInt(match[0]) : 2));
    return now;
  }
  if (lower.includes("tomorrow") || lower.includes("day")) {
    const match = lower.match(/\d+/);
    now.setDate(now.getDate() + (match ? parseInt(match[0]) : 1));
    return now;
  }
  if (lower.includes("week") || lower.includes("friday")) {
    now.setDate(now.getDate() + 7);
    return now;
  }
  if (lower.includes("month")) {
    now.setMonth(now.getMonth() + 1);
    return now;
  }

  return null;
}

/**
 * Formats a given date to the user device's local timezone
 */
export function formatToDeviceTimezone(
  dateInput: string | Date | undefined | null,
  options?: {
    includeTime?: boolean;
    includeTz?: boolean;
    short?: boolean;
  }
): string {
  if (!dateInput) return "TBD";

  const date = parseDateSafe(dateInput);
  if (!date) {
    return String(dateInput);
  }

  const includeTime = options?.includeTime ?? true;
  const includeTz = options?.includeTz ?? true;
  const isShort = options?.short ?? false;

  try {
    const formatOptions: Intl.DateTimeFormatOptions = {
      month: isShort ? "short" : "short",
      day: "numeric",
      year: "numeric",
      ...(includeTime
        ? {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }
        : {}),
      ...(includeTz
        ? {
            timeZoneName: "short",
          }
        : {}),
    };

    return new Intl.DateTimeFormat(undefined, formatOptions).format(date);
  } catch (err) {
    return date.toLocaleDateString();
  }
}

/**
 * Computes a relative countdown from now to the target date
 */
export function getRelativeTimeCountdown(dateInput: string | Date | undefined | null): {
  text: string;
  isExpired: boolean;
  isUrgent: boolean;
} {
  const date = parseDateSafe(dateInput);
  if (!date) {
    return { text: "Date pending", isExpired: false, isUrgent: false };
  }

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { text: "Pending Resolution", isExpired: true, isUrgent: false };
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    const months = Math.floor(diffDays / 30);
    return { text: `Ends in ${months} mo${months > 1 ? "s" : ""}`, isExpired: false, isUrgent: false };
  }

  if (diffDays > 0) {
    const remainingHours = diffHours % 24;
    return {
      text: remainingHours > 0 ? `Ends in ${diffDays}d ${remainingHours}h` : `Ends in ${diffDays}d`,
      isExpired: false,
      isUrgent: diffDays <= 1,
    };
  }

  if (diffHours > 0) {
    const remainingMins = diffMin % 60;
    return {
      text: remainingMins > 0 ? `Ends in ${diffHours}h ${remainingMins}m` : `Ends in ${diffHours}h`,
      isExpired: false,
      isUrgent: true,
    };
  }

  if (diffMin > 0) {
    return { text: `Ends in ${diffMin}m`, isExpired: false, isUrgent: true };
  }

  return { text: "Ending in seconds", isExpired: false, isUrgent: true };
}
