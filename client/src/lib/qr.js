// The server sends event QR codes as SVG (sharp at any size, with the college logo inside).
// For "Save QR" we turn it into a PNG, because WhatsApp, Word and PowerPoint handle PNG best.
export async function downloadQrPng(svgDataUrl, filename, size = 1600) {
  try {
    const img = new Image();
    img.src = svgDataUrl;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG failed'))), 'image/png'));
    save(URL.createObjectURL(blob), filename, true);
  } catch {
    // Older browsers: save the SVG itself, which still opens everywhere
    save(svgDataUrl, filename.replace(/\.png$/, '.svg'), false);
  }
}

function save(href, filename, revoke) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(href), 5000);
}
