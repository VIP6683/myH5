import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'mars2d/mars2d.css';
import * as mars2d from 'mars2d';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
	iconRetinaUrl: markerIcon2x,
	iconUrl: markerIcon,
	shadowUrl: markerShadow
});

function buildCompatEventType() {
	const base = { ...mars2d.EventType };
	return {
		...base,
		cameraChanged: base.move,
		cameraMoveStart: base.movestart,
		cameraMoveEnd: base.moveend,
		wheel: base.zoom,
		popupOpen: base.popupopen,
		popupClose: base.popupclose
	};
}

function buildCompatGraphic() {
	return {
		...mars2d.graphic,
		BillboardEntity: mars2d.graphic.Marker,
		PolygonEntity: mars2d.graphic.Polygon,
		PolylineEntity: mars2d.graphic.Polyline
	};
}

/** 挂载 Mars2D，并为仍引用 mars3d 名称的代码提供图形类兼容别名 */
export function installMars2d() {
	if (globalThis.mars2d) {
		return globalThis.mars2d;
	}

	globalThis.L = L;
	globalThis.mars2d = mars2d;
	globalThis.mars3d = {
		...mars2d,
		graphic: buildCompatGraphic(),
		layer: { ...mars2d.layer },
		thing: mars2d.thing,
		EventType: buildCompatEventType(),
		Token: mars2d.Token,
		PointTrans: mars2d.PointTrans,
		MeasureUtil: mars2d.MeasureUtil,
		Log: mars2d.Log,
		Map: mars2d.Map
	};

	return mars2d;
}
