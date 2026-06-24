<script setup>
import { onBeforeUnmount, ref } from 'vue';
import { sendSmsCode, smsLogin } from '../../api/auth.js';
import { fetchUserInfo } from '../../api/user.js';
import { setLogin, setUserInfo } from '../../utils/auth.js';
import loginBg from '../../assets/images/bg/space-circle-outer.png';
import rabbitMascot from '../../assets/images/profile/rabbit-mascot.png';

const emit = defineEmits(['success']);

const phone = ref('');
const code = ref('');
const countdown = ref(0);
const sending = ref(false);
const logging = ref(false);
const toast = ref({ visible: false, text: '', type: 'info' });

let timer = null;

const validatePhone = (value) => /^1[3-9]\d{9}$/.test(value);

const showToast = (text, type = 'info') => {
	toast.value = { visible: true, text, type };
	setTimeout(() => {
		toast.value.visible = false;
	}, 2000);
};

const clearTimer = () => {
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
};

const startCountdown = () => {
	clearTimer();
	countdown.value = 60;
	timer = setInterval(() => {
		if (countdown.value <= 1) {
			clearTimer();
			countdown.value = 0;
			return;
		}
		countdown.value -= 1;
	}, 1000);
};

const onSendCode = async () => {
	if (countdown.value > 0 || sending.value) return;

	const phoneValue = phone.value.trim();
	if (!validatePhone(phoneValue)) {
		showToast('请输入正确的手机号');
		return;
	}

	sending.value = true;
	try {
		await sendSmsCode(phoneValue);
		showToast('验证码已发送', 'success');
		startCountdown();
	} catch (error) {
		showToast(error?.message || '验证码发送失败');
	} finally {
		sending.value = false;
	}
};

const onLogin = async () => {
	if (logging.value) return;

	const phoneValue = phone.value.trim();
	const codeValue = code.value.trim();

	if (!validatePhone(phoneValue)) {
		showToast('请输入正确的手机号');
		return;
	}

	if (!/^\d{4,6}$/.test(codeValue)) {
		showToast('请输入验证码');
		return;
	}

	logging.value = true;
	try {
		const { token } = await smsLogin(phoneValue, codeValue);
		setLogin(token, phoneValue);
		const userInfo = await fetchUserInfo();
		setUserInfo(userInfo);
		showToast('登录成功', 'success');
		emit('success');
	} catch (error) {
		showToast(error?.message || '登录失败');
	} finally {
		logging.value = false;
	}
};

onBeforeUnmount(() => {
	clearTimer();
});
</script>

<template>
	<div class="login-page">
		<header class="login-page__hero">
			<img class="login-page__hero-bg" :src="loginBg" alt="" aria-hidden="true" />
			<div class="login-page__hero-mask" aria-hidden="true"></div>
		</header>

		<div class="login-page__content">
			<header class="login-page__brand">
				<div class="login-page__brand-head">
					<h1 class="login-page__title">空间信息服务平台</h1>
				</div>
				<p class="login-page__subtitle">智慧巡检与输电线路监测</p>
			</header>

			<section class="login-page__card" aria-label="账号登录">
				<div class="login-page__field">
					<label class="login-page__label sr-only" for="login-phone">手机号</label>
					<div class="login-page__input-wrap">
						<input
							id="login-phone"
							v-model="phone"
							class="login-page__input"
							type="tel"
							maxlength="11"
							placeholder="请输入手机号"
							autocomplete="tel"
						/>
					</div>
				</div>

				<div class="login-page__field">
					<label class="login-page__label sr-only" for="login-code">验证码</label>
					<div class="login-page__input-wrap login-page__input-wrap--code">
						<input
							id="login-code"
							v-model="code"
							class="login-page__input"
							type="tel"
							maxlength="6"
							placeholder="请输入短信验证码"
							autocomplete="one-time-code"
						/>
						<button
							type="button"
							class="login-page__code-btn"
							:class="{ 'is-disabled': countdown > 0 || sending }"
							:disabled="countdown > 0 || sending"
							@click="onSendCode"
						>
							{{
								countdown > 0 ? `${countdown}s` : sending ? '发送中' : '获取验证码'
							}}
						</button>
					</div>
				</div>

				<button
					type="button"
					class="login-page__submit"
					:class="{ 'is-loading': logging }"
					:disabled="logging"
					@click="onLogin"
				>
					<span v-if="logging" class="login-page__spinner" aria-hidden="true" />
					登录
				</button>
			</section>

			<p class="login-page__tip">
				登录即表示同意平台服务协议与隐私政策
			</p>
		</div>
		<img class="login-page__rabbit" :src="rabbitMascot" alt="" aria-hidden="true" />

		<Transition name="login-toast-fade">
			<div
				v-if="toast.visible"
				class="login-page__toast"
				:class="`login-page__toast--${toast.type}`"
			>
				{{ toast.text }}
			</div>
		</Transition>
	</div>
</template>

<style scoped lang="scss">
$login-accent: #00d8ff;
$login-primary: #1f4fd1;
$login-primary-pressed: #1a43b3;
$login-bg: #060b14;
$login-surface: #101923;
$login-text: rgba(255, 255, 255, 0.94);
$login-text-secondary: rgba(255, 255, 255, 0.68);
$login-text-muted: rgba(255, 255, 255, 0.36);
$login-border: rgba(255, 255, 255, 0.1);

.login-page {
	position: relative;
	min-height: 100vh;
	min-height: 100dvh;
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	padding: 0 16px calc(18px + env(safe-area-inset-bottom, 0px));
	box-sizing: border-box;
	background: linear-gradient(180deg, #0d1422 0%, #0a111d 52%, #060b14 100%);
	color: $login-text;
	overflow: hidden;
}

.login-page__hero {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	overflow: hidden;
}

.login-page__hero-bg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	object-position: center;
	transform: scale(1.08) translate3d(-2.2%, -1.2%, 0);
	animation: login-hero-drift 12s ease-in-out infinite alternate;
	will-change: transform;
}

.login-page__hero-mask {
	position: absolute;
	inset: 0;
	background:
		radial-gradient(56% 38% at 50% 36%, rgba(255, 143, 65, 0.12) 0%, rgba(255, 143, 65, 0) 100%),
		linear-gradient(180deg, rgba(8, 14, 24, 0.42) 0%, rgba(8, 14, 24, 0.76) 58%, rgba(8, 14, 24, 0.9) 100%);
}

.login-page__content {
	position: relative;
	z-index: 1;
	width: 100%;
	max-width: 360px;
	margin: 0 auto;
	padding-top: calc(112px + env(safe-area-inset-top, 0px));
}

.login-page__brand {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-bottom: 16px;
	padding: 0 6px;
	text-align: center;
	min-height: auto;
}

.login-page__brand-head {
	display: inline-flex;
	align-items: center;
	gap: 10px;
}

.login-page__title {
	margin: 0;
	font-size: 28px;
	font-weight: 700;
	line-height: 1.2;
	letter-spacing: 0;
	color: rgba(255, 255, 255, 0.94);
}

.login-page__subtitle {
	margin: 8px 0 0;
	font-size: 13px;
	color: rgba(255, 255, 255, 0.56);
}

.login-page__rabbit {
	position: absolute;
	right: 12px;
	bottom: calc(20px + env(safe-area-inset-bottom, 0px));
	height: 72px;
	width: auto;
	z-index: 1;
	opacity: 0.52;
	pointer-events: none;
	filter: saturate(0.82) blur(0.2px);
}

.login-page__card {
	padding: 0;
	border-radius: 0;
	background: transparent;
	border: 0;
	box-shadow: none;
}

.login-page__field + .login-page__field {
	margin-top: 8px;
}

.login-page__label {
	display: block;
	margin-bottom: 0;
}

.login-page__input-wrap {
	display: flex;
	align-items: center;
	height: 48px;
	padding: 0 14px;
	border-radius: 10px;
	background: rgba(255, 255, 255, 0.12);
	border: 1px solid rgba(255, 255, 255, 0.08);
	transition:
		border-color 0.18s ease,
		background 0.18s ease;

	&:focus-within {
		border-color: rgba(0, 216, 255, 0.46);
		background: rgba(18, 34, 49, 0.88);
	}
}

.login-page__input-wrap--code {
	padding-right: 6px;
}

.login-page__input {
	flex: 1;
	min-width: 0;
	border: 0;
	background: transparent;
	font-size: 15px;
	color: $login-text;
	outline: none;
	font-weight: 500;

	&::placeholder {
		color: rgba(255, 255, 255, 0.45);
		font-size: 15px;
		font-weight: 500;
	}

	&:-webkit-autofill,
	&:-webkit-autofill:hover,
	&:-webkit-autofill:focus,
	&:-webkit-autofill:active {
		-webkit-box-shadow: 0 0 0 1000px rgba(255, 255, 255, 0.12) inset;
		box-shadow: 0 0 0 1000px rgba(255, 255, 255, 0.12) inset;
		-webkit-text-fill-color: $login-text;
		caret-color: $login-text;
		transition: background-color 9999s ease-out 0s;
	}
}

.login-page__input-wrap:focus-within .login-page__input:-webkit-autofill {
	-webkit-box-shadow: 0 0 0 1000px rgba(18, 34, 49, 0.88) inset;
	box-shadow: 0 0 0 1000px rgba(18, 34, 49, 0.88) inset;
}

.login-page__code-btn {
	flex-shrink: 0;
	height: 26px;
	padding: 0 8px;
	border: 0;
	border-radius: 6px;
	background: transparent;
	color: rgba(255, 255, 255, 0.62);
	font-size: 12px;
	font-weight: 500;
	line-height: 1;
	cursor: pointer;
	transition:
		opacity 0.15s ease,
		background 0.15s ease;

	&:active:not(.is-disabled) {
		background: rgba(255, 255, 255, 0.08);
	}

	&.is-disabled {
		color: $login-text-muted;
		cursor: not-allowed;
	}
}

.login-page__submit {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	width: 100%;
	height: 46px;
	margin-top: 14px;
	border-radius: 8px;
	border: 0;
	background: rgba(255, 255, 255, 0.92);
	color: #1a2639;
	font-size: 16px;
	font-weight: 600;
	line-height: 1;
	letter-spacing: 0;
	cursor: pointer;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.24);
	transition:
		background 0.15s ease,
		transform 0.1s ease,
		opacity 0.15s ease;

	&:active:not(:disabled) {
		background: #fff;
		transform: translateY(1px);
	}

	&.is-loading {
		opacity: 0.72;
	}
}

.login-page__spinner {
	width: 14px;
	height: 14px;
	border: 2px solid rgba(255, 255, 255, 0.3);
	border-top-color: #fff;
	border-radius: 50%;
	animation: login-spin 0.7s linear infinite;
}

.login-page__tip {
	margin: 12px 0 0;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	line-height: 1.6;
	color: rgba(255, 255, 255, 0.48);
}

.login-page__toast {
	position: fixed;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	z-index: 100;
	padding: 10px 18px;
	border-radius: 8px;
	background: rgba(25, 35, 53, 0.88);
	color: $login-text;
	font-size: 14px;
	white-space: nowrap;
	box-shadow: 0 4px 18px rgba(0, 0, 0, 0.32);
}

.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	border: 0;
	white-space: nowrap;
}

.login-page__toast--success {
	background: rgba(16, 21, 29, 0.96);
	color: $login-text;
}

.login-toast-fade-enter-active,
.login-toast-fade-leave-active {
	transition: opacity 0.2s ease;
}

.login-toast-fade-enter-from,
.login-toast-fade-leave-to {
	opacity: 0;
}

@keyframes login-spin {
	to {
		transform: rotate(360deg);
	}
}

@keyframes login-hero-drift {
	0% {
		transform: scale(1.08) translate3d(-2.2%, -1.2%, 0);
	}

	100% {
		transform: scale(1.14) translate3d(2.2%, 1.3%, 0);
	}
}
</style>
