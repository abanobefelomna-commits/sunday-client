/**
 * Shared upload limits. Kept in a dependency-free module so both the browser
 * picker and the server validator enforce the same values.
 */
export const MAX_ATTACHMENTS = 4;
export const MAX_ATTACHMENT_BYTES = Math.floor(2.5 * 1024 * 1024);
export const MAX_TOTAL_ATTACHMENT_BYTES = Math.floor(3 * 1024 * 1024);
export const MAX_TEXT_CHARS = 120_000;
export const MAX_ATTACHMENT_NAME_LENGTH = 160;
