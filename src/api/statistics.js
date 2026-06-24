import request from './request.js';
import { geojsonToPositions } from '../utils/geojsonToPositions.js';

/**
 * 面状异物期数树
 * GET /result/abnormalSurface/surfaceTree
 * @returns {Promise<unknown>}
 */
export function fetchSurfaceTree() {
	return request({
		url: '/result/abnormalSurface/surfaceTree',
		method: 'get'
	});
}

/**
 * 年份选项
 * GET /result/abnormalSurface/getAllYear
 * @returns {Promise<{ label: string, value: string }[]>}
 */
export function fetchAllYear() {
	return request({
		url: '/result/abnormalSurface/getAllYear',
		method: 'get'
	});
}

/**
 * 期度选项（依赖年份）
 * GET /result/abnormalSurface/getAllPeriod?year=2026
 * @param {string | number} year
 * @returns {Promise<{ label: string, value: string }[]>}
 */
export function fetchAllPeriod(year) {
	return request({
		url: '/result/abnormalSurface/getAllPeriod',
		method: 'get',
		params: { year: String(year) }
	});
}

/**
 * @param {unknown} payload
 * @returns {{ label: string, value: string }[]}
 */
export function normalizeLabelValueOptions(payload) {
	const list = Array.isArray(payload) ? payload : [];
	return list
		.map((item) => ({
			label: item?.label != null ? String(item.label) : '',
			value: item?.value != null ? String(item.value) : ''
		}))
		.filter((item) => item.value);
}

/**
 * @typedef {Object} PersonalTaskStatsVo
 * @property {number} period 期数
 * @property {string} periodName 期数名称
 * @property {number} totalNum 总任务数
 * @property {number} pendingCheckNum 待核查数
 * @property {number} checkedNum 已核查数
 * @property {number} pendingDisposalNum 待处置数
 * @property {number} disposedNum 已处置数
 */

/**
 * @typedef {Object} PersonalTaskStatsRow
 * @property {number} phase
 * @property {string} periodName
 * @property {number} total
 * @property {number} unverified
 * @property {number} verified
 * @property {number} pending
 * @property {number} disposed
 */

/**
 * 个人任务统计（按年份）
 * GET /result/abnormalSurface/personalTaskStats?year=2026
 * @param {string | number} year
 * @returns {Promise<PersonalTaskStatsVo[]>}
 */
export function fetchPersonalTaskStats(year) {
	return request({
		url: '/result/abnormalSurface/personalTaskStats',
		method: 'get',
		params: { year: String(year) }
	});
}

/**
 * 将 PersonalTaskStatsVo 规范为统计表格行
 * @param {unknown} payload
 * @returns {PersonalTaskStatsRow[]}
 */
export function normalizePersonalTaskStats(payload) {
	const list = Array.isArray(payload) ? payload : [];

	return list
		.map((item) => ({
			phase: Number(item?.period) || 0,
			periodName: item?.periodName || '',
			total: Number(item?.totalNum) || 0,
			unverified: Number(item?.pendingCheckNum) || 0,
			verified: Number(item?.checkedNum) || 0,
			pending: Number(item?.pendingDisposalNum) || 0,
			disposed: Number(item?.disposedNum) || 0
		}))
		.filter((row) => row.phase > 0);
}

export const OBJECT_TYPE_API_MAP = {
	'color-steel': 0,
	mulch: 1,
	'dust-net': 2,
	construction: 3,
	greenhouse: 4
};

const ABNORMAL_TYPE_LABELS = {
	0: { value: 'color-steel', label: '彩钢瓦' },
	1: { value: 'mulch', label: '地膜' },
	2: { value: 'dust-net', label: '防尘网' },
	3: { value: 'construction', label: '施工工地' },
	4: { value: 'greenhouse', label: '塑料大棚' }
};

const CHECK_STATUS_MAP = {
	0: 'unverified',
	1: 'verified'
};

const DISPOSAL_STATUS_MAP = {
	0: 'undisposed',
	1: 'disposed'
};

const VERIFY_STATUS_API_MAP = {
	unverified: 0,
	verified: 1
};

const DISPOSE_STATUS_API_MAP = {
	undisposed: 0,
	disposed: 1
};

/**
 * @typedef {Object} TaskListCountVo
 * @property {number} pendingCheckCount 待核查数
 * @property {number} pendingDisposalCount 待处置数
 * @property {number} totalPendingCount 待办总数（底部菜单角标）
 */

/**
 * @typedef {Object} TaskListCountQuery
 * @property {string | number} [year]
 * @property {string | number} [period]
 * @property {string} [abnormalCode]
 * @property {string} [keyword]
 * @property {string} [objectType]
 * @property {string} [verifyStatus]
 * @property {string} [disposeStatus]
 */

function appendQueryParam(params, key, value) {
	if (value === undefined || value === null || value === '') {
		return;
	}
	params[key] = String(value);
}

function pickDefaultYearPeriod(filters = {}) {
	if (filters.year) {
		return {
			year: Number(filters.year),
			period: Number(filters.period) || 1
		};
	}

	const currentYear = new Date().getFullYear();
	return { year: currentYear, period: 1 };
}

/**
 * @typedef {Object} TaskListQueryOptions
 * @property {string} [headerTab] pending-verify | pending-dispose
 * @property {number} [pageNum]
 * @property {number} [pageSize]
 * @property {string} [abnormalCode]
 * @property {string} [keyword]
 */

/**
 * @typedef {Object} TaskListPatch
 * @property {string} id
 * @property {[number, number][]} positions
 * @property {Record<string, unknown>} attr
 */

/**
 * @typedef {Object} TaskListVo
 * @property {number} total
 * @property {TaskListPatch[]} patches
 */

function appendTaskListFilters(params, query = {}, options = {}) {
	const { year, period } = pickDefaultYearPeriod(query);

	appendQueryParam(params, 'year', year);
	appendQueryParam(params, 'period', query.period ?? period);

	const abnormalCode =
		options.abnormalCode?.trim?.() ||
		options.abnormalCode ||
		query.abnormalCode?.trim?.() ||
		query.abnormalCode;
	appendQueryParam(params, 'abnormalCode', abnormalCode);

	const keyword =
		options.keyword?.trim?.() ||
		options.keyword ||
		query.keyword?.trim?.() ||
		query.keyword;
	appendQueryParam(params, 'keyword', keyword);

	const objectType = Array.isArray(query.objectType) ? query.objectType[0] : query.objectType;
	if (objectType && OBJECT_TYPE_API_MAP[objectType] !== undefined) {
		appendQueryParam(params, 'abnormalType', OBJECT_TYPE_API_MAP[objectType]);
	}

	if (query.verifyStatus && VERIFY_STATUS_API_MAP[query.verifyStatus] !== undefined) {
		appendQueryParam(params, 'checkStatus', VERIFY_STATUS_API_MAP[query.verifyStatus]);
	} else if (options.headerTab === 'pending-verify') {
		appendQueryParam(params, 'checkStatus', 0);
	}

	if (query.disposeStatus && DISPOSE_STATUS_API_MAP[query.disposeStatus] !== undefined) {
		appendQueryParam(params, 'disposalStatus', DISPOSE_STATUS_API_MAP[query.disposeStatus]);
	} else if (options.headerTab === 'pending-dispose') {
		appendQueryParam(params, 'disposalStatus', 0);
	}
}

function buildTaskListCountParams(query = {}) {
	const params = {};
	appendTaskListFilters(params, query);
	return params;
}

function buildTaskListParams(query = {}, options = {}) {
	const params = {};
	appendTaskListFilters(params, query, options);
	appendQueryParam(params, 'pageNum', options.pageNum ?? 1);
	appendQueryParam(params, 'pageSize', options.pageSize ?? 20);
	return params;
}

/**
 * 任务列表角标统计
 * GET /result/abnormalSurface/taskList/count
 * @param {TaskListCountQuery} [query]
 * @returns {Promise<TaskListCountVo>}
 */
export function fetchTaskListCount(query = {}) {
	return request({
		url: '/result/abnormalSurface/taskList/count',
		method: 'get',
		params: buildTaskListCountParams(query)
	});
}

/**
 * @param {unknown} payload
 * @returns {TaskListCountVo}
 */
export function normalizeTaskListCount(payload) {
	return {
		pendingCheckCount: Number(payload?.pendingCheckCount) || 0,
		pendingDisposalCount: Number(payload?.pendingDisposalCount) || 0,
		totalPendingCount: Number(payload?.totalPendingCount) || 0
	};
}

/**
 * 任务列表
 * GET /result/abnormalSurface/taskList
 * @param {TaskListCountQuery} [query]
 * @param {TaskListQueryOptions} [options]
 * @returns {Promise<{ total: number, rows: unknown[] }>}
 */
export function fetchTaskList(query = {}, options = {}) {
	return request({
		url: '/result/abnormalSurface/taskList',
		method: 'get',
		params: buildTaskListParams(query, options)
	});
}

/**
 * 面状异物监测详细信息
 * GET /result/abnormalSurface/{id}
 * @param {string | number} id
 * @returns {Promise<unknown>}
 */
export function fetchAbnormalSurfaceDetail(id) {
	return request({
		url: `/result/abnormalSurface/${encodeURIComponent(String(id))}`,
		method: 'get'
	});
}

/**
 * 将面状异物详情转为图斑详情展示结构
 * @param {unknown} row
 * @returns {Record<string, unknown> | null}
 */
export function normalizeAbnormalSurfaceDetail(row) {
	const id = row?.id;
	if (id === undefined || id === null || id === '') {
		return null;
	}

	const abnormalType = ABNORMAL_TYPE_LABELS[Number(row?.abnormalType)] || {
		value: '',
		label: '-'
	};
	const period = Number(row?.period) || 0;
	const lng = row?.lng;
	const lat = row?.lat;
	const hasCoordinates =
		lng !== undefined &&
		lng !== null &&
		lng !== '' &&
		lat !== undefined &&
		lat !== null &&
		lat !== '';
	const coordinates = hasCoordinates ? { lng: Number(lng), lat: Number(lat) } : undefined;
	const additionalInfo = row?.additionalInfo;
	const additionalInfoId = additionalInfo?.id;

	return {
		kind: 'area',
		id,
		additionalInfoId:
			additionalInfoId !== undefined && additionalInfoId !== null && additionalInfoId !== ''
				? additionalInfoId
				: undefined,
		additionalInfo:
			additionalInfo && typeof additionalInfo === 'object' ? additionalInfo : undefined,
		year: row?.year != null ? String(row.year) : '',
		period,
		phase: period ? `第${period}期` : '',
		objectType: abnormalType.value,
		objectTypeLabel: abnormalType.label,
		objectNo: row?.abnormalCode != null ? String(row.abnormalCode) : '',
		substationNo: row?.substationCode != null ? String(row.substationCode) : '',
		substationName: row?.substationName || '',
		patchArea: row?.areaSqMeter,
		objectDistance: row?.distanceSubstation,
		imageTime: row?.imageTime || '',
		city: row?.city || '',
		district: row?.district || '',
		coordinates,
		lng: coordinates?.lng,
		lat: coordinates?.lat
	};
}

/**
 * 将 taskList 单条记录转为地图图斑
 * @param {unknown} row
 * @returns {TaskListPatch | null}
 */
export function normalizeTaskListRow(row) {
	const id = row?.id;
	if (id === undefined || id === null || id === '') {
		return null;
	}

	const positions = geojsonToPositions(row?.geojson);
	if (!positions.length) {
		return null;
	}

	const abnormalType = ABNORMAL_TYPE_LABELS[Number(row?.abnormalType)] || {
		value: '',
		label: '-'
	};
	const period = Number(row?.period) || 0;

	return {
		id: String(id),
		positions,
		attr: {
			kind: 'area',
			id,
			year: row?.year != null ? String(row.year) : '',
			period,
			phase: period ? `第${period}期` : '',
			objectType: abnormalType.value,
			objectTypeLabel: abnormalType.label,
			verifyStatus: CHECK_STATUS_MAP[Number(row?.checkStatus)] ?? 'unverified',
			disposeStatus: DISPOSAL_STATUS_MAP[Number(row?.disposalStatus)] ?? 'undisposed',
			objectNo: row?.abnormalCode != null ? String(row.abnormalCode) : '',
			substationNo: row?.substationCode != null ? String(row.substationCode) : '',
			substationName: row?.substationName || '',
			patchArea: row?.areaSqMeter,
			objectDistance: row?.distanceSubstation,
			name: abnormalType.label !== '-' ? abnormalType.label : `图斑-${id}`
		}
	};
}

/**
 * @param {unknown} payload
 * @returns {TaskListVo}
 */
export function normalizeTaskList(payload) {
	const rows = Array.isArray(payload?.rows) ? payload.rows : [];
	const patches = rows.map(normalizeTaskListRow).filter(Boolean);

	return {
		total: Number(payload?.total) || patches.length,
		patches
	};
}

/**
 * 从上传接口响应中解析文件 url
 * @param {unknown} payload
 * @returns {string | null}
 */
export function resolveUploadFileUrl(payload) {
	if (payload === undefined || payload === null || payload === '') {
		return null;
	}

	if (typeof payload === 'string') {
		return payload;
	}

	if (typeof payload === 'object') {
		return payload.url ?? null;
	}

	return null;
}

/**
 * 上传面状异物附件（核查/处置照片）
 * POST /oss/oss/upload
 * @param {File | Blob} file
 * @param {Record<string, string | number>} [query]
 * @returns {Promise<unknown>}
 */
export function uploadAbnormalSurfaceShpFile(file, query = {}) {
	const formData = new FormData();
	formData.append('file', file);

	return request({
		url: '/oss/oss/upload',
		method: 'post',
		params: query,
		data: formData
	});
}

/**
 * 解析 additionalInfo 中的照片字段（JSON 数组字符串或数组）
 * @param {unknown} value
 * @returns {string[]}
 */
export function parseAbnormalPhotoUrls(value) {
	if (!value) {
		return [];
	}

	if (Array.isArray(value)) {
		return value.map((item) => String(item || '').trim()).filter(Boolean);
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return [];
		}

		try {
			const parsed = JSON.parse(trimmed);
			if (Array.isArray(parsed)) {
				return parsed.map((item) => String(item || '').trim()).filter(Boolean);
			}
		} catch {
			// 非 JSON 字符串时按单个 url 处理
		}

		return [trimmed];
	}

	return [];
}

/**
 * @typedef {Object} AbnormalMonitorAdditionalInfoPayload
 * @property {number | string} id 异物附加信息 id（详情 additionalInfo.id）
 * @property {number} [isAccounted] 是否纳入台账：0 否，1 是
 * @property {number} [checkStatus] 核查状态：0 待核查，1 已核查
 * @property {number} [checkType] 核查类型：0 线下，1 线上
 * @property {number} [disposalStatus] 处置状态：0 待处置，1 已处置
 * @property {string} [checkOpinion] 核查意见
 * @property {string} [checkRemark] 备注
 * @property {string} [checkPhotos] 核查照片 url 列表（JSON 数组字符串）
 * @property {string} [disposalPhotos] 处置照片 url 列表（JSON 数组字符串）
 */

/**
 * 保存异物附加信息（核查提交）
 * POST /result/abnormalMonitorAdditionalInfo/save
 * @param {AbnormalMonitorAdditionalInfoPayload} data
 * @returns {Promise<unknown>}
 */
export function saveAbnormalMonitorAdditionalInfo(data) {
	return request({
		url: '/result/abnormalMonitorAdditionalInfo/save',
		method: 'post',
		data
	});
}

/**
 * 批量上传照片并返回文件 url 列表
 * @param {Array<File | Blob>} files
 * @param {Record<string, string | number>} [query]
 * @returns {Promise<string[]>}
 */
export async function uploadAbnormalSurfacePhotoUrls(files, query = {}) {
	const urls = [];

	for (const file of files) {
		const payload = await uploadAbnormalSurfaceShpFile(file, query);
		const fileUrl = resolveUploadFileUrl(payload);
		if (!fileUrl) {
			throw new Error('照片上传失败，未返回文件地址');
		}
		urls.push(fileUrl);
	}

	return urls;
}
