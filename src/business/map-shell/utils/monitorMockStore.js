import {
	generateAreaMockData,
	generateLineMockData,
	MOCK_PATCH_COUNT
} from './generateMonitorMockData.js';

export const MONITOR_LAYER_ID = '__monitor_mock_graphics__';

let areaPatches = [];
let linePatches = [];

export function ensureMonitorMockData() {
	if (!areaPatches.length) {
		areaPatches = generateAreaMockData(MOCK_PATCH_COUNT);
	}
	if (!linePatches.length) {
		linePatches = generateLineMockData(MOCK_PATCH_COUNT);
	}
	return { areaPatches, linePatches };
}

export function getMonitorPatches(kind) {
	const { areaPatches, linePatches } = ensureMonitorMockData();
	return kind === 'line' ? linePatches : areaPatches;
}

export function resetMonitorMockData() {
	areaPatches = generateAreaMockData(MOCK_PATCH_COUNT);
	linePatches = generateLineMockData(MOCK_PATCH_COUNT);
}
