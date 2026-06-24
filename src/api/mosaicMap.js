/**
 * 镶嵌图服务列表（对齐 kjydd getMosaicMap_new）
 * @see D:/6683Web/kjxxfwH5/kjydd/src/main.js
 */

const SERVICE_TYPE_LABELS = {
	qt: '其他',
	rx: '日新图',
	xq: '镶嵌图'
};

const SERVICE_LIST_QUERY = {
	data: JSON.stringify({
		showprops: true,
		props: [
			{
				code: 'servicetype',
				value: 'xq',
				exists: true
			}
		]
	}),
	p: JSON.stringify({ n: 1000 })
};

let cachedMosaicMap = null;
let pendingRequest = null;

function getMosaicMapRuntimeConfig() {
	const config = globalThis.APP_MAP_CONFIG?.mosaicMap || {};
	return {
		serviceListUrl:
			config.serviceListUrl || 'https://www.img.net/api/v1/service/list'
	};
}

function parseServiceProps(props = []) {
	return props.reduce((result, item) => {
		if (item?.propname) {
			result[item.propname] = item.propvalue;
		}
		return result;
	}, {});
}

function appendServiceEntry(mosaicMap, resolution, entry) {
	const year = Number(String(entry.serviceyear || '').slice(0, 4));
	if (!resolution || !Number.isFinite(year)) {
		return;
	}

	if (!mosaicMap[resolution]) {
		mosaicMap[resolution] = {
			start: year,
			end: year,
			typename: SERVICE_TYPE_LABELS[resolution] || resolution,
			data: []
		};
	}

	const bucket = mosaicMap[resolution];
	bucket.start = Math.min(bucket.start, year);
	bucket.end = Math.max(bucket.end, year);
	bucket.data.push(entry);
}

function normalizeMosaicMap(raw = {}) {
	const mosaicMap = JSON.parse(JSON.stringify(raw));

	if (mosaicMap['0.5M']?.data?.length) {
		let endItem = null;
		let endIndex = -1;
		let startItem = null;
		let startIndex = -1;

		mosaicMap['0.5M'].data.forEach((item, index) => {
			if (item.name === '2021-0.5M下半年') {
				endItem = item;
				endIndex = index;
			} else if (item.name === '2021-0.5M上半年') {
				startItem = item;
				startIndex = index;
			}
		});

		if (endItem && startItem && endIndex >= 0 && startIndex >= 0) {
			mosaicMap['0.5M'].data[endIndex] = startItem;
			mosaicMap['0.5M'].data[startIndex] = endItem;
		}
	}

	Object.keys(mosaicMap).forEach((key) => {
		mosaicMap[key]?.data?.sort(
			(a, b) => new Date(a.serviceyear).getTime() - new Date(b.serviceyear).getTime()
		);
	});

	return mosaicMap;
}

function buildMosaicMapFromResult(content = []) {
	const mosaicMap = {};

	for (const service of content) {
		if (!service?.props?.length) {
			continue;
		}

		const props = parseServiceProps(service.props);
		if (!props.serviceyear || !props.dataresolution) {
			continue;
		}

		const year = String(service.name || '').split('_')[0];
		const fullname = `${year}-${service.fullname}`;

		appendServiceEntry(mosaicMap, props.dataresolution, {
			name: fullname,
			name_id: service.name,
			serviceName: service.serviceName,
			description: service.description,
			url: service.resturl,
			serviceid: service.serviceid,
			isbasemap: props.isbasemap,
			maxlevel: props.maxlevel,
			serviceyear: props.serviceyear,
			higislayer: props.higislayer,
			xqkserver: props.xqkserver,
			xqkvectorserver: props.xqkvctserver4326,
			dataresolution: props.dataresolution
		});
	}

	return normalizeMosaicMap(mosaicMap);
}

async function requestMosaicMapList() {
	const { serviceListUrl } = getMosaicMapRuntimeConfig();
	const params = new URLSearchParams();
	params.set('data', SERVICE_LIST_QUERY.data);
	params.set('p', SERVICE_LIST_QUERY.p);

	const joiner = serviceListUrl.includes('?') ? '&' : '?';
	const url = `${serviceListUrl}${joiner}${params.toString()}`;

	const response = await fetch(url, {
		method: 'GET'
	});

	if (!response.ok) {
		throw new Error(`镶嵌图服务列表请求失败（${response.status}）`);
	}

	const payload = await response.json();
	if (!payload?.success || !Array.isArray(payload.result)) {
		throw new Error('镶嵌图服务列表返回格式异常');
	}

	return buildMosaicMapFromResult(payload.result);
}

/**
 * 获取镶嵌图分组数据（按分辨率分组，带缓存）
 * @returns {Promise<Record<string, { start: number, end: number, typename: string, data: object[] }>>}
 */
export async function fetchMosaicMapList(options = {}) {
	const { force = false } = options;

	if (!force && cachedMosaicMap) {
		return cachedMosaicMap;
	}

	if (!force && pendingRequest) {
		return pendingRequest;
	}

	pendingRequest = requestMosaicMapList()
		.then((mosaicMap) => {
			cachedMosaicMap = mosaicMap;
			return mosaicMap;
		})
		.finally(() => {
			pendingRequest = null;
		});

	return pendingRequest;
}

function getLatestServiceFromBucket(bucket) {
	if (!bucket?.data?.length) {
		return null;
	}
	return bucket.data[bucket.data.length - 1];
}

/**
 * 选择默认镶嵌图服务（优先 0.5M 最新一期）
 */
export function pickDefaultMosaicService(mosaicMap = {}) {
	const preferred = getLatestServiceFromBucket(mosaicMap['0.5M']);
	if (preferred?.serviceName) {
		return preferred;
	}

	for (const key of Object.keys(mosaicMap)) {
		const latest = getLatestServiceFromBucket(mosaicMap[key]);
		if (latest?.serviceName) {
			return latest;
		}
	}

	return null;
}

/** 扁平化全部镶嵌图服务（新到旧） */
export function flattenMosaicServices(mosaicMap = {}) {
	const list = [];

	for (const key of Object.keys(mosaicMap)) {
		const bucket = mosaicMap[key];
		if (!bucket?.data?.length) {
			continue;
		}
		for (const item of bucket.data) {
			list.push(item);
		}
	}

	return list.reverse();
}
