/**
 * Universal Error Message Formatter
 * Prevents any raw JavaScript Error objects, empty structures, or "[object Object]"
 * strings from leaking into toasts, modal alerts, or notifications.
 */
export function formatErrorMessage(err: any, fallback = "An unexpected error occurred. Please try again."): string {
  if (err === undefined || err === null) {
    return fallback;
  }

  const isInvalidStr = (s: string) => {
    const lower = s.toLowerCase();
    return (
      !s ||
      s === "[object Object]" ||
      s === "{}" ||
      s === "[]" ||
      lower === "object error" ||
      lower === "error: [object object]" ||
      lower.startsWith("[object ")
    );
  };

  // 1. Direct string checking
  if (typeof err === "string") {
    const trimmed = err.trim();
    if (!isInvalidStr(trimmed)) {
      return trimmed;
    }
    return fallback;
  }

  // 2. Standard Error instance or object with message
  if (typeof err?.message === "string") {
    const trimmed = err.message.trim();
    if (!isInvalidStr(trimmed)) {
      return trimmed;
    }
  }

  // 3. Object with error property (common in API responses)
  if (typeof err?.error === "string") {
    const trimmed = err.error.trim();
    if (!isInvalidStr(trimmed)) {
      return trimmed;
    }
  }

  // 4. Object with description, details, reason, or statusText property (Appwrite / OAuth / Fetch)
  for (const prop of ["description", "details", "reason", "statusText"]) {
    if (typeof err?.[prop] === "string") {
      const trimmed = err[prop].trim();
      if (!isInvalidStr(trimmed)) {
        return trimmed;
      }
    }
  }

  // 5. Nested object message or error
  if (err?.message && typeof err.message === "object") {
    return formatErrorMessage(err.message, fallback);
  }

  if (err?.error && typeof err.error === "object") {
    return formatErrorMessage(err.error, fallback);
  }

  // 6. Inspect HTTP status codes
  if (typeof err?.code === "number" || typeof err?.status === "number") {
    const code = err.code || err.status;
    if (code === 401) return "Session expired or authentication required.";
    if (code === 403) return "Access denied. Insufficient permissions.";
    if (code === 404) return "Requested resource was not found.";
    if (code === 429) return "Rate limit exceeded. Please wait a moment.";
    if (code >= 500) return "Server encountered a temporary issue. Please try again.";
  }

  // 7. Custom toString implementation (if not Object.prototype.toString)
  try {
    if (typeof err.toString === "function" && err.toString !== Object.prototype.toString) {
      const str = err.toString();
      if (typeof str === "string" && !isInvalidStr(str.trim())) {
        return str.trim();
      }
    }
  } catch {
    // Ignore
  }

  return fallback;
}

