/**
 * 禁止浏览器对整页进行缩放（双击放大、双指捏合、Ctrl+滚轮等）。
 * viewport meta 在部分 WebView / iOS 上会被忽略，需配合 CSS touch-action 与事件拦截。
 */
export function installPreventPageZoom() {
	const blockGesture = (event) => {
		event.preventDefault();
	};

	const blockCtrlWheel = (event) => {
		if (event.ctrlKey) {
			event.preventDefault();
		}
	};

	const options = { passive: false };

	document.addEventListener('gesturestart', blockGesture, options);
	document.addEventListener('gesturechange', blockGesture, options);
	document.addEventListener('gestureend', blockGesture, options);
	document.addEventListener('wheel', blockCtrlWheel, options);

	return () => {
		document.removeEventListener('gesturestart', blockGesture, options);
		document.removeEventListener('gesturechange', blockGesture, options);
		document.removeEventListener('gestureend', blockGesture, options);
		document.removeEventListener('wheel', blockCtrlWheel, options);
	};
}
