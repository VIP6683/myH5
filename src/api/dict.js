import request from './request.js';

/**
 * 按字典类型查询字典数据（若依标准接口）
 * GET /system/dict/data/type/{dictType}
 * @param {string} dictType
 * @returns {Promise<unknown>}
 */
export function fetchDictByType(dictType) {
	return request({
		url: `/system/dict/data/type/${encodeURIComponent(String(dictType))}`,
		method: 'get'
	});
}

/**
 * 将字典接口结果规范为 { label, value } 选项
 * @param {unknown} payload
 * @returns {Array<{ label: string, value: string }>}
 */
export function normalizeDictOptions(payload) {
	const list = Array.isArray(payload) ? payload : [];
	return list
		.map((item) => ({
			label:
				item?.dictLabel != null
					? String(item.dictLabel)
					: item?.label != null
						? String(item.label)
						: '',
			value:
				item?.dictValue != null
					? String(item.dictValue)
					: item?.value != null
						? String(item.value)
						: ''
		}))
		.filter((item) => item.value !== '');
}

/**
 * 改正类型字典
 * @returns {Promise<Array<{ label: string, value: string }>>}
 */
export async function fetchAbnormalCorrectTypeOptions() {
	const data = await fetchDictByType('abnormal_correct_type');
	return normalizeDictOptions(data);
}

/**
 * 核查状态字典（处置关注状态）
 * 0 无影响也无变化之后不用关注
 * 1 暂时无影响但会有变化需要短期关注
 * 2 有影响且有变化需要长期关注
 * @returns {Promise<Array<{ label: string, value: string }>>}
 */
export async function fetchCorrectStatusOptions() {
	const data = await fetchDictByType('correct_staus');
	return normalizeDictOptions(data);
}
