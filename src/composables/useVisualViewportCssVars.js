/**
 * 将 visualViewport 同步为 CSS 变量，避免 fixed 层盖住移动端浏览器底栏/顶栏。
 */
export function installVisualViewportCssVars() {
	if (typeof window === 'undefined') {
		return () => {};
	}

	const root = document.documentElement;

	const sync = () => {
		const vv = window.visualViewport;
		const top = vv?.offsetTop ?? 0;
		const left = vv?.offsetLeft ?? 0;
		const height = vv?.height ?? window.innerHeight;
		const width = vv?.width ?? window.innerWidth;

		root.style.setProperty('--app-vv-offset-top', `${top}px`);
		root.style.setProperty('--app-vv-offset-left', `${left}px`);
		root.style.setProperty('--app-vv-height', `${height}px`);
		root.style.setProperty('--app-vv-width', `${width}px`);
	};

	sync();
	window.visualViewport?.addEventListener('resize', sync);
	window.visualViewport?.addEventListener('scroll', sync);
	window.addEventListener('resize', sync);

	return () => {
		window.visualViewport?.removeEventListener('resize', sync);
		window.visualViewport?.removeEventListener('scroll', sync);
		window.removeEventListener('resize', sync);
		root.style.removeProperty('--app-vv-offset-top');
		root.style.removeProperty('--app-vv-offset-left');
		root.style.removeProperty('--app-vv-height');
		root.style.removeProperty('--app-vv-width');
	};
}
