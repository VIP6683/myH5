import { onBeforeUnmount, watch } from 'vue';
import { lockScroll, resetScrollLock, unlockScroll } from './useScrollLock.js';

/**
 * 弹层通用生命周期：打开时锁定页面滚动，关闭后恢复。
 * 适用于 BottomSheet / Picker / ActionSheet / Dialog 等 Teleport 弹层。
 */
export function usePopupLayer(options = {}) {
	const { lockMap = false, onOpen, onClose } = options;
	let acquired = false;

	const lockOptions = () => (lockMap ? { map: true } : {});

	const acquire = () => {
		if (acquired) {
			return;
		}
		lockScroll(lockOptions());
		acquired = true;
		onOpen?.();
	};

	const release = () => {
		if (!acquired) {
			return;
		}
		unlockScroll(lockOptions());
		acquired = false;
		onClose?.();
	};

	const bindVisible = (visibleSource, { immediate = false } = {}) => {
		const stop = watch(
			visibleSource,
			(open) => {
				if (open) {
					acquire();
				} else {
					release();
				}
			},
			{ immediate }
		);

		onBeforeUnmount(() => {
			stop();
			release();
		});
	};

	onBeforeUnmount(() => {
		release();
	});

	return {
		acquire,
		release,
		bindVisible
	};
}

export { resetScrollLock };
