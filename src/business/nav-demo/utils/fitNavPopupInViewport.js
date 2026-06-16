const UI_OBSTACLE_SELECTORS = [
	'.map-floating-tab-bar-wrap',
	'.mapToolsWrap',
	'.baseMapSwitcher',
	'.map-side-menu',
	'.map-control-panel',
	'.mapSideMenu'
];

const DEFAULT_EDGE_PADDING = 12;
const MAX_PAN_ITERATIONS = 3;

let autoPanning = false;

function intersects(a, b) {
	return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function nextFrame() {
	return new Promise((resolve) => {
		requestAnimationFrame(() => resolve());
	});
}

function getCesium() {
	return globalThis.Cesium || null;
}

/**
 * 计算地图容器内可安全展示弹框的区域（避开底部 Tab、右侧工具栏等）
 */
export function getMapSafeViewport(map) {
	const mapEl = map?.container || map?.viewer?.container?.parentElement;
	const mapRect = mapEl?.getBoundingClientRect?.();

	if (!mapRect?.width || !mapRect?.height) {
		return null;
	}

	const padding = {
		top: DEFAULT_EDGE_PADDING,
		right: DEFAULT_EDGE_PADDING,
		bottom: DEFAULT_EDGE_PADDING,
		left: DEFAULT_EDGE_PADDING
	};

	UI_OBSTACLE_SELECTORS.forEach((selector) => {
		document.querySelectorAll(selector).forEach((el) => {
			const uiRect = el.getBoundingClientRect();
			if (!intersects(uiRect, mapRect) || uiRect.width <= 0 || uiRect.height <= 0) {
				return;
			}

			if (uiRect.top > mapRect.top + mapRect.height * 0.45) {
				padding.bottom = Math.max(padding.bottom, mapRect.bottom - uiRect.top + 10);
			}

			if (uiRect.left > mapRect.left + mapRect.width * 0.5) {
				padding.right = Math.max(padding.right, mapRect.right - uiRect.left + 10);
			}

			if (uiRect.bottom < mapRect.top + mapRect.height * 0.35) {
				padding.top = Math.max(padding.top, uiRect.bottom - mapRect.top + 10);
			}

			if (uiRect.right < mapRect.left + mapRect.width * 0.45) {
				padding.left = Math.max(padding.left, uiRect.right - mapRect.left + 10);
			}
		});
	});

	return {
		left: mapRect.left + padding.left,
		top: mapRect.top + padding.top,
		right: mapRect.right - padding.right,
		bottom: mapRect.bottom - padding.bottom
	};
}

function getPopupRootElement(popup) {
	const container = popup?.container;
	if (!container) {
		return null;
	}

	return container.closest?.('.mars3d-popup') || container;
}

/**
 * 计算弹框需要移动的屏幕像素量（正值=向右/向下移入可视区）
 */
function computeScreenShift(rect, safeViewport) {
	if (!safeViewport || safeViewport.right <= safeViewport.left || safeViewport.bottom <= safeViewport.top) {
		return { x: 0, y: 0 };
	}

	let dx = 0;
	let dy = 0;

	if (rect.left < safeViewport.left) {
		dx = safeViewport.left - rect.left;
	} else if (rect.right > safeViewport.right) {
		dx = safeViewport.right - rect.right;
	}

	if (rect.top < safeViewport.top) {
		dy = safeViewport.top - rect.top;
	} else if (rect.bottom > safeViewport.bottom) {
		dy = safeViewport.bottom - rect.bottom;
	}

	const safeWidth = safeViewport.right - safeViewport.left;
	if (rect.width > safeWidth) {
		dx = safeViewport.left + safeWidth / 2 - (rect.left + rect.right) / 2;
	}

	return { x: dx, y: dy };
}

function pickGlobePoint(scene, screenPosition) {
	const Cesium = getCesium();
	if (!Cesium || !scene?.camera) {
		return null;
	}

	const ray = scene.camera.getPickRay(screenPosition);
	if (!ray) {
		return null;
	}

	return scene.globe?.pick(ray, scene) || scene.camera.pickEllipsoid(screenPosition, scene.globe.ellipsoid);
}

/**
 * 按屏幕像素平移地图（弹框相对图标位置不变）
 */
export function panMapByScreenOffset(map, dx, dy) {
	const Cesium = getCesium();
	const viewer = map?.viewer;
	const scene = viewer?.scene;
	const camera = scene?.camera;
	const canvas = scene?.canvas;

	if (!Cesium || !camera || !canvas || (dx === 0 && dy === 0)) {
		return false;
	}

	const center = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
	const target = new Cesium.Cartesian2(center.x - dx, center.y - dy);
	const centerWorld = pickGlobePoint(scene, center);
	const targetWorld = pickGlobePoint(scene, target);

	if (centerWorld && targetWorld) {
		const translation = Cesium.Cartesian3.subtract(centerWorld, targetWorld, new Cesium.Cartesian3());
		camera.position = Cesium.Cartesian3.add(camera.position, translation, new Cesium.Cartesian3());
		return true;
	}

	const distance = camera.positionCartographic?.height || 1000;
	const fovy = camera.frustum?.fovy || Cesium.Math.toRadians(60);
	const pixelScale = (2 * distance * Math.tan(fovy / 2)) / canvas.clientHeight;

	camera.move(camera.right, -dx * pixelScale);
	camera.move(camera.up, dy * pixelScale);
	return true;
}

export function isNavPopupAutoPanning() {
	return autoPanning;
}

/**
 * 弹框超出可视区时平移地图（不改弹框 offset，保持贴在图标正上方）
 * @param {import('mars3d').graphic.Popup} popup
 * @param {import('mars3d').Map} map
 */
export async function panMapToFitNavPopup(popup, map) {
	if (!popup?.show || !map) {
		return;
	}

	autoPanning = true;

	try {
		for (let i = 0; i < MAX_PAN_ITERATIONS; i += 1) {
			popup.updateDivPosition?.();
			await nextFrame();

			const popupEl = getPopupRootElement(popup);
			const safeViewport = getMapSafeViewport(map);

			if (!popupEl || !safeViewport) {
				break;
			}

			const shift = computeScreenShift(popupEl.getBoundingClientRect(), safeViewport);
			if (shift.x === 0 && shift.y === 0) {
				break;
			}

			panMapByScreenOffset(map, shift.x, shift.y);
			await nextFrame();
		}
	} finally {
		autoPanning = false;
	}
}
