const DEBUG_STORAGE_KEY = 'h5_debug';

let vConsoleInstance = null;
let panelVisible = false;

function hideDefaultSwitch() {
	const styleId = 'mobile-debug-hide-vc-switch';
	if (document.getElementById(styleId)) {
		return;
	}

	const style = document.createElement('style');
	style.id = styleId;
	style.textContent = '#__vconsole .vc-switch { display: none !important; }';
	document.head.appendChild(style);
}

/**
 * 是否展示移动端调试按钮。
 * - 开发环境默认开启
 * - 访问地址带 ?debug=1 开启（写入 sessionStorage，刷新仍有效）
 */
export function isMobileDebugEnabled() {
	if (import.meta.env.DEV) {
		return true;
	}

	if (typeof window === 'undefined') {
		return false;
	}

	const params = new URLSearchParams(window.location.search);
	if (params.get('debug') === '1') {
		sessionStorage.setItem(DEBUG_STORAGE_KEY, '1');
		return true;
	}

	return sessionStorage.getItem(DEBUG_STORAGE_KEY) === '1';
}

export function isMobileDebugPanelVisible() {
	return panelVisible;
}

/** 懒加载并打开 vConsole 面板 */
export async function openMobileDebugConsole() {
	if (!vConsoleInstance) {
		const { default: VConsole } = await import('vconsole');
		vConsoleInstance = new VConsole({
			theme: 'dark',
			maxLogNumber: 2000,
			disableLogScrolling: false
		});
		hideDefaultSwitch();
	}

	vConsoleInstance.show();
	panelVisible = true;
	return vConsoleInstance;
}

/** 隐藏 vConsole 面板 */
export function closeMobileDebugConsole() {
	if (!vConsoleInstance) {
		return;
	}

	vConsoleInstance.hide();
	panelVisible = false;
}

/** 切换 vConsole 面板显示 */
export async function toggleMobileDebugConsole() {
	if (panelVisible) {
		closeMobileDebugConsole();
		return false;
	}

	await openMobileDebugConsole();
	return true;
}

/** 输出结构化调试日志（会出现在 vConsole 中） */
export function logMobileDebug(tag, payload) {
	const label = `[${tag}]`;
	if (payload === undefined) {
		console.log(label);
		return;
	}
	console.log(label, payload);
}

export function logMobileDebugError(tag, error, extra) {
	console.error(`[${tag}]`, {
		message: error?.message,
		code: error?.code,
		name: error?.name,
		stack: error?.stack,
		...extra
	});
}
