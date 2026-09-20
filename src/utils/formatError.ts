/**
 * Universal Error Message Formatter
 * Prevents any raw JavaScript Error objects, empty structures, or "[object Object]"
 * strings from leaking into toasts, modal alerts, or notifications.
 */
export function formatErrorMessage(err: any, fallback = "An unexpected error occurred. Please try again."): string {
  if (err === undefined || err === null) {
    return fallback;
  }

  // 1. Direct string checking
  if (typeof err === "string") {
    const trimmed = err.trim();
    if (trimmed && trimmed !== "[object Object]" && trimmed !== "{}" && trimmed !== "[]") {
      return trimmed;
    }
    return fallback;
  }

  // 2. Standard Error instance or object with message
  if (typeof err?.message === "string") {
    const trimmed = err.message.trim();
    if (trimmed && trimmed !== "[object Object]" && trimmed !== "{}" && trimmed !== "[]") {
      return trimmed;
    }
  }

  // 3. Object with error property (common in API responses)
  if (typeof err?.error === "string") {
    const trimmed = err.error.trim();
    if (trimmed && trimmed !== "[object Object]" && trimmed !== "{}" && trimmed !== "[]") {
      return trimmed;
    }
  }

  // 4. Object with description or details property (Appwrite / OAuth)
  if (typeof err?.description === "string") {
    const trimmed = err.description.trim();
    if (trimmed && trimmed !== "[object Object]" && trimmed !== "{}" && trimmed !== "[]") {
      return trimmed;
    }
  }

  if (typeof err?.details === "string") {
    const trimmed = err.details.trim();
    if (trimmed && trimmed !== "[object Object]" && trimmed !== "{}" && trimmed !== "[]") {
      return trimmed;
    }
  }

  // 5. Nested object message or error
  if (err?.message && typeof err.message === "object") {
    return formatErrorMessage(err.message, fallback);
  }

  if (err?.error && typeof err.error === "object") {
    return formatErrorMessage(err.error, fallback);
  }

  // 6. JSON serialization fallback
  try {
    const serialized = JSON.stringify(err);
    if (serialized && serialized !== "{}" && serialized !== "[]" && serialized !== `"[object Object]"`) {
      return serialized;
    }
  } catch {
    // Ignore serialization failure
  }

  return fallback;
}
