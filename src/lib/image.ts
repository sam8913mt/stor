/** Client-side image optimisation before upload: longest side ≤ maxSide, re-encoded as WebP (keeps transparency). Falls back to the original file. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.84): Promise<{ blob: Blob; type: string; ext: string }> {
  try {
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type) || typeof createImageBitmap !== 'function') throw new Error('skip');
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)); const h = Math.max(1, Math.round(bmp.height * k));
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('skip');
    ctx.drawImage(bmp, 0, 0, w, h); bmp.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', quality));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size * 1.05 && k === 1) throw new Error('skip');
    return { blob, type: 'image/webp', ext: 'webp' };
  } catch {
    return { blob: file, type: file.type, ext: file.type.split('/')[1] ?? 'jpg' };
  }
}
