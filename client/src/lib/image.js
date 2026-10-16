// Shrinks/converts the chosen design image in the browser so uploads stay small and always JPEG
export function toJpeg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 2480 / img.naturalWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the image'))), 'image/jpeg', 0.92);
    };
    img.onerror = () => reject(new Error('That file is not an image CertiFlow can read. Use PNG or JPG.'));
    img.src = url;
  });
}
