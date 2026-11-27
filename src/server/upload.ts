export interface UploadResult {
  url: string;
  filename: string;
  size: number;
}

/**
 * A user-correctable upload problem (missing file, unsupported type, too
 * large). Route handlers may return its message to the client; any other
 * upload failure must stay generic.
 */
export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

/**
 * Identify the real image type from the file's leading bytes. The browser
 * supplied MIME type and file extension are attacker-controlled, so they are
 * never trusted to decide what gets stored and later rendered.
 */
export function sniffImageMime(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return 'image/png';
  const ascii = (start: number, text: string) =>
    bytes.length >= start + text.length &&
    [...text].every((ch, i) => bytes[start + i] === ch.charCodeAt(0));
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  return null;
}

export async function processUploadedImage(
  file: File,
  _folder = 'images',
): Promise<UploadResult> {
  if (!file || !(file instanceof File)) {
    throw new UploadValidationError('الملف مطلوب');
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];

  if (!allowedTypes.includes(file.type) && (!ext || !allowedExts.includes(ext))) {
    throw new UploadValidationError('الصور المسموح بها: JPG, JPEG, PNG, WEBP فقط');
  }

  // 5MB limit
  if (file.size > 5 * 1024 * 1024) {
    throw new UploadValidationError('حجم الصورة يجب أن يكون أقل من 5 ميجا');
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mime = sniffImageMime(buffer);
  if (!mime) {
    throw new UploadValidationError('الملف ليس صورة صالحة (JPG أو PNG أو WEBP)');
  }
  const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

  return {
    url: dataUrl,
    filename: file.name,
    size: file.size,
  };
}
