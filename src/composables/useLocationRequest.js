import { ref } from 'vue';
import {
	canUseNativeGeolocation,
	getCurrentLocation,
	getLocationErrorMessage,
	getLocationProvider,
	queryGeolocationPermission,
	LOCATION_ERROR
} from '../utils/locationPermission.js';
import { isWeChatEnv } from '../business/nav-demo/utils/wechatJssdk.js';
import { isMobileDebugEnabled, logMobileDebug, logMobileDebugError } from '../utils/mobileDebugConsole.js';

/**
 * 定位请求：直接触发系统/微信原生授权弹框，仅在失败时展示提示。
 *
 * @param {{ onSuccess?: (coords: { lng: number, lat: number }) => void, onError?: (error: Error, message: string) => void }} [handlers]
 */
export function useLocationRequest(handlers = {}) {
	const dialogVisible = ref(false);
	const dialogMode = ref('error');
	const dialogErrorMessage = ref('');

	let pendingResolve = null;
	let pendingReject = null;

	const settlePending = (fn) => {
		const resolve = pendingResolve;
		const reject = pendingReject;
		pendingResolve = null;
		pendingReject = null;
		fn(resolve, reject);
	};

	const openDialog = (mode, errorMessage = '') => {
		dialogMode.value = mode;
		dialogErrorMessage.value = errorMessage;
		dialogVisible.value = true;
	};

	const closeDialog = () => {
		dialogVisible.value = false;
	};

	const fetchLocation = async () => {
		const provider = getLocationProvider();
		logMobileDebug('location', `开始定位 provider=${provider}`);
		try {
			const coords = await getCurrentLocation();
			logMobileDebug('location:success', coords);
			handlers.onSuccess?.(coords);
			settlePending((resolve) => resolve?.(coords));
			return coords;
		} catch (error) {
			const message = getLocationErrorMessage(error);
			if (isMobileDebugEnabled()) {
				logMobileDebugError('location:fail', error, {
					userMessage: message,
					provider: getLocationProvider(),
					secureContext: canUseNativeGeolocation(),
					permission: await queryGeolocationPermission(),
					href: typeof window !== 'undefined' ? window.location.href : '',
					ua: navigator.userAgent
				});
			}
			handlers.onError?.(error, message);

			if (error?.code === LOCATION_ERROR.PERMISSION_DENIED) {
				const permission = await queryGeolocationPermission();
				if (permission === 'denied' && error.reason !== 'insecure' && error.reason !== 'wechat_jssdk_not_configured') {
					openDialog('denied');
				} else {
					openDialog('error', message);
				}
			} else {
				openDialog('error', message);
			}

			settlePending((_, reject) => reject?.(error));
			return null;
		}
	};

	/** 直接调起系统/微信定位授权，返回 Promise<{ lng, lat }> */
	const requestLocation = () => {
		return new Promise(async (resolve, reject) => {
			pendingResolve = resolve;
			pendingReject = reject;

			logMobileDebug('location:permission', {
				provider: getLocationProvider(),
				secureContext: canUseNativeGeolocation(),
				isWeChat: isWeChatEnv(),
				href: typeof window !== 'undefined' ? window.location.href : ''
			});

			if (typeof navigator === 'undefined' && getLocationProvider() !== 'wechat') {
				const error = new Error('当前浏览器不支持定位');
				openDialog('error', '当前位置获取失败，请稍后重试');
				handlers.onError?.(error, error.message);
				settlePending((_, rej) => rej?.(error));
				return;
			}

			if (getLocationProvider() === 'unsupported') {
				const error = new Error('insecure');
				error.reason = 'insecure';
				error.code = LOCATION_ERROR.PERMISSION_DENIED;
				const message = getLocationErrorMessage(error);
				openDialog('error', message);
				handlers.onError?.(error, message);
				settlePending((_, rej) => rej?.(error));
				return;
			}

			await fetchLocation();
		});
	};

	const onDialogConfirm = () => {
		closeDialog();
	};

	return {
		dialogVisible,
		dialogMode,
		dialogErrorMessage,
		requestLocation,
		onDialogConfirm
	};
}
