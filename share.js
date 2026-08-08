/**
 * LA SOFT AI — share.js
 * ------------------------------------------------------------
 * Renders an AI response as an attractive branded PNG card
 * (canvas-based, fully offline, no server round-trip) so users
 * can naturally share/promote La Soft when they share a response.
 * ------------------------------------------------------------
 */

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildShareCard(responseText, logoImg) {
  const W = 1080;
  const PAD = 72;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  const ctx = canvas.getContext('2d');

  // Measure body text first to size the canvas height.
  ctx.font = '500 34px Inter, sans-serif';
  const bodyMaxWidth = W - PAD * 2;
  const clipped = responseText.length > 600 ? responseText.slice(0, 600) + '…' : responseText;
  const lines = wrapText(ctx, clipped, bodyMaxWidth);
  const lineHeight = 48;
  const headerHeight = 190;
  const footerHeight = 160;
  const bodyHeight = lines.length * lineHeight;
  const H = headerHeight + bodyHeight + footerHeight + PAD;
  canvas.height = H;

  // Background gradient (brand navy).
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0A1428');
  grad.addColorStop(1, '#050912');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial glow accents.
  const glow = ctx.createRadialGradient(W * 0.85, 0, 50, W * 0.85, 0, 500);
  glow.addColorStop(0, 'rgba(46,143,255,0.25)');
  glow.addColorStop(1, 'rgba(46,143,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Header: logo + wordmark.
  const logoSize = 64;
  if (logoImg) {
    ctx.save();
    const r = 16;
    const x = PAD, y = 56;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + logoSize, y, x + logoSize, y + logoSize, r);
    ctx.arcTo(x + logoSize, y + logoSize, x, y + logoSize, r);
    ctx.arcTo(x, y + logoSize, x, y, r);
    ctx.arcTo(x, y, x + logoSize, y, r);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logoImg, x, y, logoSize, logoSize);
    ctx.restore();
  }
  ctx.fillStyle = '#F5F8FC';
  ctx.font = '700 40px "Space Grotesk", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('LA SOFT AI', PAD + logoSize + 24, 56 + logoSize / 2);

  // Divider
  ctx.strokeStyle = 'rgba(95,177,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, headerHeight);
  ctx.lineTo(W - PAD, headerHeight);
  ctx.stroke();

  // Body text.
  ctx.fillStyle = '#E7EEF8';
  ctx.font = '500 34px Inter, sans-serif';
  ctx.textBaseline = 'alphabetic';
  let ty = headerHeight + 56;
  for (const line of lines) {
    ctx.fillText(line, PAD, ty);
    ty += lineHeight;
  }

  // Footer.
  const footerY = H - footerHeight;
  ctx.strokeStyle = 'rgba(95,177,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(PAD, footerY);
  ctx.lineTo(W - PAD, footerY);
  ctx.stroke();

  ctx.fillStyle = '#5FB1FF';
  ctx.font = '600 26px "Space Grotesk", sans-serif';
  ctx.fillText('Your AI. Your Device.', PAD, footerY + 58);

  ctx.fillStyle = '#8DA2C4';
  ctx.font = '500 22px Inter, sans-serif';
  ctx.fillText('✨ Powered by La Soft', PAD, footerY + 96);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export async function shareResponse(responseText, logoSrc) {
  const logoImg = await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = logoSrc;
  });

  const blob = await buildShareCard(responseText, logoImg);
  const file = new File([blob], 'la-soft-ai.png', { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'LA SOFT AI',
        text: 'Shared from LA SOFT AI — Your AI. Your Device.',
      });
      return { method: 'share' };
    } catch (e) {
      if (e?.name === 'AbortError') return { method: 'cancelled' };
      // fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'la-soft-ai.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { method: 'download' };
}
