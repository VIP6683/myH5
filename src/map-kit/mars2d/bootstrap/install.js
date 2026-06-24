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

/** 挂载 Mars2D 与 Leaflet 到全局 */
export function installMars2d() {
	if (globalThis.mars2d) {
		return globalThis.mars2d;
	}

	globalThis.L = L;
	globalThis.mars2d = mars2d;
	return mars2d;
}
