<script setup>
import { onBeforeUnmount, ref } from 'vue';
import { setLogin } from '../utils/auth.js';

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

const onSendCode = () => {
	if (countdown.value > 0 || sending.value) return;

	if (!validatePhone(phone.value.trim())) {
		showToast('请输入正确的手机号');
		return;
	}

	sending.value = true;
	showToast('验证码已发送', 'success');
	startCountdown();
	setTimeout(() => {
		sending.value = false;
	}, 600);
};

const onLogin = () => {
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
	const fakeToken = `demo-token-${Date.now()}`;
	setLogin(fakeToken, phoneValue);
	showToast('登录成功', 'success');

	setTimeout(() => {
		logging.value = false;
		emit('success');
	}, 500);
};

onBeforeUnmount(() => {
	clearTimer();
});
</script>

<template>
	<div class="login-page">
		<div class="login-page__backdrop" aria-hidden="true" />

		<div class="login-page__content">
			<header class="login-page__brand">
				<div class="login-page__logo" aria-hidden="true">
					<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
						<rect width="40" height="40" rx="10" fill="#1cded4" />
						<path
							d="M20 9c-4.418 0-8 3.134-8 7 0 5.25 8 12 8 12s8-6.75 8-12c0-3.866-3.582-7-8-7Z"
							fill="#fff"
						/>
						<circle cx="20" cy="16" r="2.5" fill="#1cded4" />
					</svg>
				</div>
				<h1 class="login-page__title">空间信息服务</h1>
				<p class="login-page__subtitle">区域空间信息一体化服务平台</p>
			</header>

			<section class="login-page__card" aria-label="手机验证码登录">
				<div class="login-page__field">
					<label class="login-page__label" for="login-phone">手机号</label>
					<div class="login-page__input-wrap">
						<span class="login-page__prefix">+86</span>
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
					<label class="login-page__label" for="login-code">验证码</label>
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

			<p class="login-page__tip">登录即表示同意平台服务协议与隐私政策</p>
		</div>

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
$login-accent: #1cded4;
$login-primary: var(--app-accent, #{$login-accent});
$login-primary-pressed: #24b8a6;
$login-bg: #111418;
$login-surface: #1a1d24;
$login-text: rgba(255, 255, 255, 0.92);
$login-text-secondary: rgba(255, 255, 255, 0.45);
$login-text-muted: rgba(255, 255, 255, 0.28);
$login-border: rgba(255, 255, 255, 0.08);

.login-page {
	--login-primary: #{$login-primary};

	position: relative;
	min-height: 100vh;
	min-height: 100dvh;
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	padding: calc(10vh + env(safe-area-inset-top, 0px)) 24px
		calc(20px + env(safe-area-inset-bottom, 0px));
	box-sizing: border-box;
	background: $login-bg;
	color: $login-text;
	overflow: hidden;
}

.login-page__backdrop {
	position: absolute;
	inset: 0;
	pointer-events: none;
	background:
		radial-gradient(ellipse 70% 40% at 50% -8%, rgba($login-accent, 0.07) 0%, transparent 70%),
		linear-gradient(180deg, #13161c 0%, $login-bg 38%, #0f1217 100%);
}

.login-page__content {
	position: relative;
	z-index: 1;
	width: 100%;
	max-width: 360px;
	margin: 0 auto;
}

.login-page__brand {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-bottom: 20px;
	text-align: center;
	animation: login-brand-enter 0.5s ease-out both;
}

.login-page__logo {
	width: 36px;
	height: 36px;
	margin-bottom: 10px;
}

.login-page__logo svg {
	display: block;
	width: 100%;
	height: 100%;
}

.login-page__title {
	margin: 0;
	font-size: 20px;
	font-weight: 600;
	line-height: 1.35;
	letter-spacing: 0;
	color: $login-text;
}

.login-page__subtitle {
	margin: 4px 0 0;
	font-size: 12px;
	line-height: 1.5;
	color: $login-text-secondary;
}

.login-page__card {
	padding: 4px 0 0;
	border-radius: 0;
	background: transparent;
	border: 0;
	box-shadow: none;
}

.login-page__field + .login-page__field {
	margin-top: 18px;
}

.login-page__label {
	display: block;
	margin-bottom: 8px;
	font-size: 14px;
	font-weight: 500;
	color: rgba(255, 255, 255, 0.72);
}

.login-page__input-wrap {
	display: flex;
	align-items: center;
	height: 50px;
	padding: 0 16px;
	border-radius: 10px;
	background: $login-surface;
	border: 1px solid $login-border;
	transition:
		border-color 0.18s ease,
		background 0.18s ease;

	&:focus-within {
		border-color: rgba($login-accent, 0.45);
		background: #1e2229;
	}
}

.login-page__input-wrap--code {
	padding-right: 8px;
}

.login-page__prefix {
	flex-shrink: 0;
	margin-right: 10px;
	padding-right: 10px;
	font-size: 16px;
	font-weight: 500;
	color: rgba(255, 255, 255, 0.78);
	border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.login-page__input {
	flex: 1;
	min-width: 0;
	border: 0;
	background: transparent;
	font-size: 16px;
	color: $login-text;
	outline: none;

	&::placeholder {
		color: $login-text-muted;
	}
}

.login-page__code-btn {
	flex-shrink: 0;
	height: 34px;
	padding: 0 10px;
	border: 0;
	border-radius: 8px;
	background: transparent;
	color: $login-primary;
	font-size: 13px;
	font-weight: 500;
	line-height: 1;
	cursor: pointer;
	transition:
		opacity 0.15s ease,
		background 0.15s ease;

	&:active:not(.is-disabled) {
		background: rgba($login-accent, 0.1);
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
	height: 50px;
	margin-top: 28px;
	border: 0;
	border-radius: 10px;
	background: $login-primary;
	color: #0a1412;
	font-size: 16px;
	font-weight: 600;
	line-height: 1;
	letter-spacing: 0;
	cursor: pointer;
	box-shadow: none;
	transition:
		background 0.15s ease,
		transform 0.1s ease,
		opacity 0.15s ease;

	&:active:not(:disabled) {
		background: $login-primary-pressed;
		transform: scale(0.985);
	}

	&.is-loading {
		opacity: 0.72;
	}
}

.login-page__spinner {
	width: 14px;
	height: 14px;
	border: 2px solid rgba(10, 20, 18, 0.2);
	border-top-color: #0a1412;
	border-radius: 50%;
	animation: login-spin 0.7s linear infinite;
}

.login-page__tip {
	margin: 16px 0 0;
	text-align: center;
	font-size: 11px;
	line-height: 1.6;
	color: $login-text-muted;
}

.login-page__toast {
	position: fixed;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	z-index: 100;
	padding: 10px 18px;
	border-radius: 8px;
	background: rgba(26, 29, 36, 0.94);
	color: $login-text;
	font-size: 14px;
	white-space: nowrap;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.24);
}

.login-page__toast--success {
	background: rgba(26, 29, 36, 0.96);
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

@keyframes login-brand-enter {
	from {
		opacity: 0;
		transform: translateY(8px);
	}

	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@media (prefers-reduced-motion: reduce) {
	.login-page__brand {
		animation: none;
	}
}
</style>
