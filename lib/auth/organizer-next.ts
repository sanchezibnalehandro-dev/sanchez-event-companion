const FALLBACK = "/organizer";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ENCODED_SEPARATOR = /%(?:2f|5c)/i;

export function safeOrganizerNext(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("#") ||
    CONTROL_CHARACTERS.test(value) ||
    ENCODED_SEPARATOR.test(value)
  ) {
    return FALLBACK;
  }

  try {
    const parsed = new URL(value, "https://organizer.invalid");
    const path = parsed.pathname;
    if (parsed.origin !== "https://organizer.invalid") return FALLBACK;
    if (path !== "/organizer" && !path.startsWith("/organizer/")) return FALLBACK;
    if (path === "/organizer/login" || path.startsWith("/organizer/login/")) return FALLBACK;
    return `${path}${parsed.search}`;
  } catch {
    return FALLBACK;
  }
}
