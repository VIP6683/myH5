import { mkdir, readFile, writeFile } from 'node:fs/promises';
import subsetFont from 'subset-font';

const FONT_CDN = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.2.8/files';
const SOURCE_DIR = new URL('./', import.meta.url);
const OUT_DIR = new URL('../../public/fonts/', import.meta.url);

function addRange(chars, start, end) {
	for (let code = start; code <= end; code += 1) {
		chars.add(String.fromCodePoint(code));
	}
}

function buildCharset() {
	const chars = new Set();

	addRange(chars, 0x20, 0x7e);
	addRange(chars, 0xa0, 0xff);
	addRange(chars, 0x2000, 0x206f);
	addRange(chars, 0x3000, 0x303f);
	addRange(chars, 0xff00, 0xffef);
	chars.add('\u00b0');
	chars.add('\u2103');
	chars.add('\u2013');
	chars.add('\u2014');
	chars.add('\u2018');
	chars.add('\u2019');
	chars.add('\u201c');
	chars.add('\u201d');

	const decoder = new TextDecoder('gbk');
	for (let hi = 0xb0; hi <= 0xf7; hi += 1) {
		for (let lo = 0xa1; lo <= 0xfe; lo += 1) {
			if (hi === 0xd7 && lo > 0xf9) {
				continue;
			}
			const text = decoder.decode(Buffer.from([hi, lo]));
			if (text && !text.includes('\uFFFD')) {
				chars.add(text);
			}
		}
	}

	'图斑编号拍摄时间核查人距中心定位未知㎡'.split('').forEach((char) => chars.add(char));
	return [...chars].join('');
}

async function download(name) {
	const response = await fetch(`${FONT_CDN}/${name}`);
	if (!response.ok) {
		throw new Error(`download ${name} failed: ${response.status}`);
	}
	const bytes = Buffer.from(await response.arrayBuffer());
	const fileUrl = new URL(name, SOURCE_DIR);
	await writeFile(fileUrl, bytes);
	return fileUrl;
}

await mkdir(OUT_DIR, { recursive: true });

const chineseSource = await download('noto-sans-sc-chinese-simplified-400-normal.woff2');
const charset = buildCharset();
const sourceBuffer = await readFile(chineseSource);

// woff：opentype.js 可解析，体积小于 ttf；用于 Canvas 路径绘制（绕开微信系统字体）
const woff = await subsetFont(sourceBuffer, charset, { targetFormat: 'woff' });
await writeFile(new URL('NotoSansSC-Regular.woff', OUT_DIR), woff);

console.log(`chinese woff=${woff.length} bytes`);
