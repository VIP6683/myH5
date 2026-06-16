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
	const inspector = options.inspector || '未知';
	const shotTime = options.shotTime ? formatShotTime(options.shotTime) : formatShotTime();
	const lng = options.lng ?? '';
	const lat = options.lat ?? '';
	const deviceName = options.deviceName || '未知设备';

	return [
		`巡检人员：${inspector}`,
		`拍摄时间：${shotTime}`,
		`经纬度：${lng},${lat}`,
		`设备名称：${deviceName}`
	];
}

function drawWatermark(ctx, canvas, lines) {
	const padding = Math.max(12, Math.round(canvas.width * 0.02));
	const fontSize = Math.max(18, Math.round(canvas.width * 0.028));
	const lineHeight = Math.round(fontSize * 1.45);

	ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
	ctx.textBaseline = 'alphabetic';

	const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
	const boxWidth = textWidth + padding * 2;
	const boxHeight = lines.length * lineHeight + padding * 2;
	const boxX = padding;
	const boxY = canvas.height - boxHeight - padding;

	ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
	ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

	ctx.fillStyle = '#ffffff';
	lines.forEach((line, index) => {
		const y = boxY + padding + (index + 1) * lineHeight - Math.round(fontSize * 0.2);
		ctx.fillText(line, boxX + padding, y);
	});
}

/**
 * 使用 Canvas 为照片添加巡检水印
 * @param {File|Blob} imageFile
 * @param {{
 *   inspector?: string,
 *   shotTime?: Date|string,
 *   lng?: number|string,
 *   lat?: number|string,
 *   deviceName?: string
 * }} [options]
 * @returns {Promise<File>}
 */
export async function addPhotoWatermark(imageFile, options = {}) {
	const img = await loadImageFromFile(imageFile);
	const canvas = document.createElement('canvas');
	canvas.width = img.naturalWidth;
	canvas.height = img.naturalHeight;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Canvas 不可用');
	}

	ctx.drawImage(img, 0, 0);
	drawWatermark(ctx, canvas, buildWatermarkLines(options));

	const blob = await canvasToBlob(canvas);
	const originalName = imageFile instanceof File ? imageFile.name : 'photo.jpg';
	const baseName = originalName.replace(/\.[^.]+$/, '') || 'photo';

	return new File([blob], `${baseName}_watermark.jpg`, {
		type: 'image/jpeg',
		lastModified: Date.now()
	});
}
