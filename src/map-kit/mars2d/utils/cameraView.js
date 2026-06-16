const DEFAULT_VIEWPORT_HEIGHT = 800;

export function altToZoom(alt, lat) {
	const altitude = Number(alt);
	const latitude = Number(lat);
	if (!Number.isFinite(altitude) || altitude <= 0 || !Number.isFinite(latitude)) {
		return 8;
	}

	const metersPerPixel = Math.max(altitude / DEFAULT_VIEWPORT_HEIGHT, 1);
	const zoom = Math.log2((156543.03392 * Math.cos((latitude * Math.PI) / 180)) / metersPerPixel);
	return Math.max(1, Math.min(22, zoom));
}

export function zoomToAlt(zoom, lat) {
	const latitude = Number(lat);
	const level = Number(zoom);
	if (!Number.isFinite(level) || !Number.isFinite(latitude)) {
		return 120000;
	}

	const metersPerPixel = (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** level;
	return metersPerPixel * DEFAULT_VIEWPORT_HEIGHT;
}

export function resolveCameraView(view = {}) {
	const lng = Number(view.lng);
	const lat = Number(view.lat);
	const zoom =
		view.zoom != null ? Number(view.zoom) : altToZoom(view.alt ?? 800000, lat);

	return {
		lng: Number.isFinite(lng) ? lng : 111.526034,
		lat: Number.isFinite(lat) ? lat : 27.381146,
		zoom: Number.isFinite(zoom) ? zoom : 8
	};
}

export function applyCameraView(map, view, options = {}) {
	if (!map) {
		return false;
	}

	const cameraView = resolveCameraView(view);
	const center = { lng: cameraView.lng, lat: cameraView.lat };
	const duration = Number(options.duration ?? 0);

	if (duration > 0 && map.flyTo) {
		map.flyTo(center, cameraView.zoom, { animate: true, duration });
		return true;
	}

	map.setView?.(center, cameraView.zoom, { animate: false });
	return true;
}
