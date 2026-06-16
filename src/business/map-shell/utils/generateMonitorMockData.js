import {
	clampLngLatInChangsha,
	randomLngLatInChangshaBBox
} from '../constants/changshaBounds.js';

/** 面/线模拟数据默认数量（约 150 个） */
export const MOCK_PATCH_COUNT = 150;

const OBJECT_TYPES = [
	{ value: 'color-steel', label: '彩钢瓦' },
	{ value: 'mulch', label: '地膜' },
	{ value: 'dust-net', label: '防尘网' },
	{ value: 'construction', label: '施工工地' },
	{ value: 'greenhouse', label: '塑料大棚' }
];

const VERIFY_STATUSES = ['verified', 'unverified'];
const DISPOSE_STATUSES = ['disposed', 'undisposed', 'no-need'];

function randomInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1));
}

function pickRandom(list) {
	return list[Math.floor(Math.random() * list.length)];
}

/**
 * 以中心点为基准生成不规则多边形坐标
 */
function buildRandomPolygonPositions(center, vertexCount = 5) {
	const radiusLng = 0.008 + Math.random() * 0.02;
	const radiusLat = 0.006 + Math.random() * 0.015;
	const rotation = Math.random() * Math.PI * 2;
	const positions = [];

	for (let i = 0; i < vertexCount; i += 1) {
		const angle = rotation + (Math.PI * 2 * i) / vertexCount + (Math.random() - 0.5) * 0.35;
		const scale = 0.55 + Math.random() * 0.45;
		const { lng, lat } = clampLngLatInChangsha(
			center.lng + Math.cos(angle) * radiusLng * scale,
			center.lat + Math.sin(angle) * radiusLat * scale
		);
		positions.push([lng, lat]);
	}

	return positions;
}

/**
 * 生成随机折线坐标
 */
function buildRandomLinePositions(pointCount = 4) {
	const start = randomLngLatInChangshaBBox();
	const positions = [[start.lng, start.lat]];
	let lng = start.lng;
	let lat = start.lat;

	for (let i = 1; i < pointCount; i += 1) {
		lng += (Math.random() - 0.5) * 0.025;
		lat += (Math.random() - 0.5) * 0.018;
		const next = clampLngLatInChangsha(lng, lat);
		positions.push([next.lng, next.lat]);
		lng = next.lng;
		lat = next.lat;
	}

	return positions;
}

const PHASES = ['第一期', '第二期', '第三期', '第四期'];

function buildMockAttr(kind, index) {
	const objectType = pickRandom(OBJECT_TYPES);
	return {
		kind,
		name: kind === 'area' ? `面状异物-${index + 1}` : `线状异物-${index + 1}`,
		patchNo: String(randomInt(1000, 9999)),
		substationName: `变电站#${randomInt(1, 5)}`,
		substationNo: String(randomInt(100000, 999999)),
		phase: pickRandom(PHASES),
		patchArea: randomInt(80, 500),
		lineLength: randomInt(100, 2000),
		objectNo: String(randomInt(100, 999)),
		objectType: objectType.value,
		objectTypeLabel: objectType.label,
		objectDistance: randomInt(10, 200),
		verifyStatus: pickRandom(VERIFY_STATUSES),
		disposeStatus: pickRandom(DISPOSE_STATUSES),
		year: String(randomInt(2023, 2026))
	};
}

/** 随机生成面状监测模拟面（默认约 150 个，均匀分布在长沙市内） */
export function generateAreaMockData(count = MOCK_PATCH_COUNT) {
	return Array.from({ length: count }, (_, index) => {
		const center = randomLngLatInChangshaBBox();
		return {
			id: `mock_area_${Date.now()}_${index}`,
			positions: buildRandomPolygonPositions(center, randomInt(4, 6)),
			attr: buildMockAttr('area', index)
		};
	});
}

/** 随机生成线状监测模拟线（默认约 150 条，均匀分布在长沙市内） */
export function generateLineMockData(count = MOCK_PATCH_COUNT) {
	return Array.from({ length: count }, (_, index) => ({
		id: `mock_line_${Date.now()}_${index}`,
		positions: buildRandomLinePositions(randomInt(3, 6)),
		attr: buildMockAttr('line', index)
	}));
}
