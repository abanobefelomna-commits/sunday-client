export interface UploadResult {
  url: string;
  filename: string;
  size: number;
}

export async function processUploadedImage(
  file: File,
  _folder = 'images',
): Promise<UploadResult> {
  if (!file || !(file instanceof File)) {
    throw new Error('الملف مطلوب');
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];

  if (!allowedTypes.includes(file.type) && (!ext || !allowedExts.includes(ext))) {
    throw new Error('الصور المسموح بها: JPG, JPEG, PNG, WEBP فقط');
  }

  // 5MB limit
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('حجم الصورة يجب أن يكون أقل من 5 ميجا');
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mime = file.type || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
  const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

  return {
    url: dataUrl,
    filename: file.name,
    size: file.size,
  };
}
