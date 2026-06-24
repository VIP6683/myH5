<script setup>
import { computed, ref } from 'vue';
import { useAuthSession } from '../../composables/useAuthSession.js';
import { getUserProfile } from '../../utils/auth.js';
import MineConfirmDialog from './components/MineConfirmDialog.vue';
import headerBg from '../../assets/images/profile/header-bg.png';
import rabbitMascot from '../../assets/images/profile/rabbit-mascot.png';
import defaultAvatar from '../../assets/images/profile/default-avatar.png';
import packageInfo from '../../../package.json';

const { logout, clearAllData } = useAuthSession();

const profile = computed(() => {
	const { username, phone, role, organization } = getUserProfile();

	return {
		username: username || '—',
		role: role || organization || '—',
		phone: phone || '—',
		organization: organization || '—'
	};
});

const appVersion = computed(() => `V${packageInfo.version ?? '0.0.0'}`);

const confirmDialogVisible = ref(false);
const confirmDialogAction = ref(null);
const confirmDialogState = ref({
	title: '',
	message: ''
});

const openConfirmDialog = (title, message, onConfirm) => {
	confirmDialogState.value = { title, message };
	confirmDialogAction.value = onConfirm ?? null;
	confirmDialogVisible.value = true;
};

const onConfirmDialogConfirm = () => {
	const action = confirmDialogAction.value;
	confirmDialogVisible.value = false;
	confirmDialogAction.value = null;
	action?.();
};

const closeConfirmDialog = () => {
	confirmDialogVisible.value = false;
	confirmDialogAction.value = null;
};

const openClearCacheDialog = () => {
	openConfirmDialog(
		'清除缓存',
		'确认后将清除浏览器内的所有本地数据，并返回登录页。',
		clearAllData
	);
};

const onSwitchAccount = () => {
	openConfirmDialog('切换账号', '确认切换账号？切换后将返回登录页。', logout);
};

const onLogout = () => {
	openConfirmDialog('退出登录', '确认退出登录？退出后将返回登录页。', logout);
};
</script>

<template>
	<main class="mine-page">
		<header class="mine-page__hero">
			<img class="mine-page__hero-bg" :src="headerBg" alt="" aria-hidden="true" />

			<div class="mine-page__profile">
				<img class="mine-page__avatar" :src="defaultAvatar" alt="用户头像" />
				<div class="mine-page__profile-meta">
					<h1 class="mine-page__username">{{ profile.username }}</h1>
					<p class="mine-page__role">{{ profile.role }}</p>
				</div>
			</div>

			<img class="mine-page__rabbit" :src="rabbitMascot" alt="" aria-hidden="true" />
		</header>

		<div class="mine-page__body">
			<section class="mine-page__card mine-page__card--floating">
				<div class="mine-page__row">
					<span class="mine-page__label">联系方式</span>
					<span class="mine-page__value">{{ profile.phone }}</span>
				</div>
				<div class="mine-page__row">
					<span class="mine-page__label">所属单位</span>
					<span class="mine-page__value">{{ profile.organization }}</span>
				</div>
				<button type="button" class="mine-page__action" @click="openClearCacheDialog">
					<span class="mine-page__label">清除缓存</span>
					<span class="mine-page__chevron" aria-hidden="true">›</span>
				</button>
				<div class="mine-page__row">
					<span class="mine-page__label">当前版本</span>
					<span class="mine-page__value mine-page__value--accent">{{ appVersion }}</span>
				</div>
			</section>

			<div class="mine-page__actions">
				<button type="button" class="mine-page__btn" @click="onSwitchAccount">
					切换账号
				</button>
				<button
					type="button"
					class="mine-page__btn mine-page__btn--danger"
					@click="onLogout"
				>
					安全退出
				</button>
			</div>
		</div>

		<MineConfirmDialog
			v-model:visible="confirmDialogVisible"
			:title="confirmDialogState.title"
			:message="confirmDialogState.message"
			confirm-text="确认"
			cancel-text="取消"
			@confirm="onConfirmDialogConfirm"
			@cancel="closeConfirmDialog"
			@close="closeConfirmDialog"
		/>
	</main>
</template>

<style scoped lang="scss">
.mine-page {
	display: flex;
	flex-direction: column;
	height: 100%;
	background: #141414;
	color: #fff;
	overflow: hidden;
	gap: 0;
}

.mine-page__hero {
	position: relative;
	flex-shrink: 0;
	height: 212px;
	overflow: hidden;
	background: #141414;
	z-index: 1;
}

.mine-page__hero-bg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	object-position: center top;
}

.mine-page__profile {
	position: relative;
	z-index: 1;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: calc(16px + env(safe-area-inset-top, 0px)) 16px 12px;
	margin-top: 34px;
}

.mine-page__avatar {
	flex-shrink: 0;
	width: 60px;
	height: 60px;
	border: 2px solid rgba(255, 255, 255, 0.25);
	border-radius: 50%;
	object-fit: cover;
	background: #1b1b1b;
	box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45);
}

.mine-page__profile-meta {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.mine-page__username {
	margin: 0;
	font-size: 22px;
	font-weight: 700;
	line-height: 1.3;
	color: #fff;
	text-shadow: 0 6px 18px rgba(0, 0, 0, 0.55);
}

.mine-page__role {
	margin: 0;
	font-size: 13px;
	line-height: 1.3;
	color: rgba(255, 255, 255, 0.65);
	text-shadow: 0 6px 18px rgba(0, 0, 0, 0.55);
}

.mine-page__rabbit {
	position: absolute;
	right: 14px;
	bottom: 6px;
	z-index: 1;
	height: 120px;
	width: auto;
	opacity: 1;
	pointer-events: none;
}

.mine-page__body {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-height: 0;
	padding: 36px 16px calc(16px + env(safe-area-inset-bottom, 0px));
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
	position: relative;
	z-index: 2;
}

.mine-page__card {
	margin-bottom: 12px;
	border-radius: 14px;
	background: #1b1b1b;
	border: 1px solid rgba(255, 255, 255, 0.08);
	overflow: hidden;
}

.mine-page__card--floating {
	margin-top: -18px;
	position: relative;
	z-index: 2;
}

.mine-page__row,
.mine-page__action {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	min-height: 48px;
	padding: 0 14px;
}

.mine-page__row + .mine-page__action,
.mine-page__action + .mine-page__row,
.mine-page__row + .mine-page__row {
	border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.mine-page__action {
	width: 100%;
	border: 0;
	background: transparent;
	color: inherit;
	font: inherit;
	text-align: left;
	cursor: pointer;
}

.mine-page__label {
	font-size: 14px;
	font-weight: 500;
	color: #fff;
}

.mine-page__value {
	font-size: 13px;
	color: rgba(255, 255, 255, 0.65);
	text-align: right;
}

.mine-page__value--accent {
	color: rgba(255, 255, 255, 0.75);
}

.mine-page__chevron {
	font-size: 18px;
	line-height: 1;
	color: rgba(255, 255, 255, 0.4);
}

.mine-page__actions {
	margin-top: auto;
	padding-top: 16px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.mine-page__btn {
	width: 100%;
	height: 46px;
	border-radius: 12px;
	border: 1px solid rgba(255, 255, 255, 0.12);
	background: #1f1f1f;
	color: #fff;
	font-size: 15px;
	font-weight: 600;
	line-height: 1;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
	transition:
		background 0.15s ease,
		border-color 0.15s ease,
		transform 0.12s ease,
		opacity 0.15s ease;

	&:active {
		transform: scale(0.99);
		opacity: 0.92;
	}
}

.mine-page__btn--danger {
	border-color: rgba(255, 90, 90, 0.35);
	background: rgba(255, 90, 90, 0.08);
	color: rgba(255, 255, 255, 0.94);

	&:active {
		opacity: 0.9;
	}
}
</style>
