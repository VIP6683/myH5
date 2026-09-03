import opentype from 'opentype.js';

function formatShotTime(date = new Date()) {
	const d = date instanceof Date ? date : new Date(date);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	const hours = String(d.getHours()).padStart(2, '0');
	const minutes = String(d.getMinutes()).padStart(2, '0');
	const seconds = String(d.getSeconds()).padStart(2, '0');
	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function loadImageFromFile(file) {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('图片加载失败'));
		};
		img.src = url;
	});
}

function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error('水印图片生成失败'));
				}
			},
			type,
			quality
		);
	});
}

function buildWatermarkLines(options) {
	const patchNo = options.patchNo || '未知';
	const inspector = options.inspector || '未知';
	const shotTime = options.shotTime ? formatShotTime(options.shotTime) : formatShotTime();
	const distance = options.distance || '未知';
	// 暂隐藏经纬度展示，需要时恢复下方代码
	// const lng = options.lng ?? '';
	// const lat = options.lat ?? '';
	const address = options.address || '';

	// const coordText = lng !== '' && lat !== '' ? `${lng},${lat}` : '未知';
	// const locationText = address ? `${coordText} ${address}` : coordText;
	const locationText = address || '未知';

	return [
		`图斑编号：${patchNo}`,
		`拍摄时间：${shotTime}`,
		`核查人：${inspector}`,
		`距图斑中心：${distance}`,
		`定位：${locationText}`
	];
}

/** 内置子集字体；用路径绘制，不走 Canvas fillText / 系统字体 */
const WATERMARK_FONT_URL = `${import.meta.env.BASE_URL}fonts/NotoSansSC-Regular.woff`;

let watermarkFontReady;
/** @type {import('opentype.js').Font | null} */
let watermarkFont = null;

function measureFontText(font, text, fontSize) {
	return font.getAdvanceWidth(text || '', fontSize);
}

function wrapTextLine(font, text, fontSize, maxWidth) {
	if (!text || measureFontText(font, text, fontSize) <= maxWidth) {
		return [text];
	}

	const lines = [];
	let current = '';

	for (const char of text) {
		const next = current + char;
		if (measureFontText(font, next, fontSize) > maxWidth && current) {
			lines.push(current);
			current = char;
		} else {
			current = next;
		}
	}

	if (current) {
		lines.push(current);
	}

	return lines.length ? lines : [text];
}

function expandWatermarkLines(font, lines, fontSize, maxTextWidth) {
	return lines.flatMap((line) => wrapTextLine(font, line, fontSize, maxTextWidth));
}

function fillTextPath(ctx, font, text, x, y, fontSize) {
	const path = font.getPath(text || '', x, y, fontSize);
	const fill = ctx.fillStyle;
	path.fill = typeof fill === 'string' ? fill : '#ffffff';
	path.stroke = null;
	path.draw(ctx);
}

async function loadWatermarkFont() {
	const response = await fetch(WATERMARK_FONT_URL, { cache: 'force-cache' });
	if (!response.ok) {
		throw new Error(`watermark font http ${response.status}`);
	}

	const buffer = await response.arrayBuffer();
	const font = opentype.parse(buffer);
	if (!font?.unitsPerEm) {
		throw new Error('watermark font parse failed');
	}

	watermarkFont = font;
	return font;
}

async function ensureWatermarkFont() {
	if (watermarkFont) {
		return watermarkFont;
	}
	if (watermarkFontReady) {
		return watermarkFontReady;
	}

	watermarkFontReady = loadWatermarkFont().catch((error) => {
		watermarkFontReady = null;
		watermarkFont = null;
		console.error('[addPhotoWatermark] load font failed', error);
		return null;
	});

	return watermarkFontReady;
}

export function preloadWatermarkFont() {
	return ensureWatermarkFont();
}

function drawWatermark(ctx, canvas, lines, font) {
	const padding = Math.max(8, Math.round(canvas.width * 0.014));
	const fontSize = Math.max(14, Math.round(canvas.width * 0.022));
	const lineHeight = Math.round(fontSize * 1.4);
	const maxTextWidth = Math.max(160, Math.round(canvas.width * 0.72));

	const wrappedLines = expandWatermarkLines(font, lines, fontSize, maxTextWidth);
	const textWidth = Math.max(
		...wrappedLines.map((line) => measureFontText(font, line, fontSize)),
		0
	);
	const boxWidth = Math.min(canvas.width - padding * 2, textWidth + padding * 2);
	const boxHeight = wrappedLines.length * lineHeight + padding * 2;
	const boxX = padding;
	const boxY = canvas.height - boxHeight - padding;

	ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
	ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

	ctx.fillStyle = '#ffffff';
	wrappedLines.forEach((line, index) => {
		const y = boxY + padding + (index + 1) * lineHeight - Math.round(fontSize * 0.2);
		fillTextPath(ctx, font, line, boxX + padding, y, fontSize);
	});
}

/**
 * 使用 Canvas 为照片添加巡检水印
 * @param {File|Blob} imageFile
 * @param {{
 *   patchNo?: string,
 *   inspector?: string,
 *   shotTime?: Date|string,
 *   distance?: string,
 *   lng?: number|string,
 *   lat?: number|string,
 *   address?: string
 * }} [options]
 * @returns {Promise<File>}
 */
export async function addPhotoWatermark(imageFile, options = {}) {
	const img = await loadImageFromFile(imageFile);
	const canvas = document.createElement('canvas');
	canvas.width = img.naturalWidth;
	canvas.height = img.naturalHeight;

	console.log('[addPhotoWatermark] image size', {
		naturalWidth: img.naturalWidth,
		naturalHeight: img.naturalHeight,
		fileName: imageFile instanceof File ? imageFile.name : '',
		fileType: imageFile?.type,
		fileSize: imageFile?.size
	});

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Canvas 不可用');
	}

	const font = await ensureWatermarkFont();
	if (!font) {
		throw new Error('水印字体加载失败');
	}

	ctx.drawImage(img, 0, 0);
	drawWatermark(ctx, canvas, buildWatermarkLines(options), font);

	const blob = await canvasToBlob(canvas);
	const originalName = imageFile instanceof File ? imageFile.name : 'photo.jpg';
	const baseName = originalName.replace(/\.[^.]+$/, '') || 'photo';

	return new File([blob], `${baseName}_watermark.jpg`, {
		type: 'image/jpeg',
		lastModified: Date.now()
	});
}
