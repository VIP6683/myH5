<script setup>
import { computed, ref } from 'vue';
import { useAuthSession } from '../../composables/useAuthSession.js';
import MineConfirmDialog from './components/MineConfirmDialog.vue';
import headerBg from '../../assets/images/profile/header-bg.png';
import rabbitMascot from '../../assets/images/profile/rabbit-mascot.png';
import defaultAvatar from '../../assets/images/profile/default-avatar.png';
import packageInfo from '../../../package.json';

const { logout, clearAllData } = useAuthSession();

const profile = {
	username: '超级账号',
	role: '系统管理员',
	phone: '13752634636',
	organization: '国网省公司'
};

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
			<div class="mine-page__hero-mask" aria-hidden="true"></div>

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
				<button type="button" class="mine-page__logout-text" @click="onLogout">
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
	background: #060b14;
	color: #fff;
	overflow: hidden;
	gap: 0;
}

.mine-page__hero {
	position: relative;
	flex-shrink: 0;
	height: 172px;
	overflow: hidden;
}

.mine-page__hero-bg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	object-position: center;
}

.mine-page__hero-mask {
	position: absolute;
	inset: 0;
	background: linear-gradient(
		180deg,
		rgba(6, 11, 20, 0.2) 0%,
		rgba(6, 11, 20, 0.72) 62%,
		rgba(6, 11, 20, 0.92) 100%
	);
	pointer-events: none;
}

.mine-page__profile {
	position: relative;
	z-index: 1;
	top: 30px;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: calc(16px + env(safe-area-inset-top, 0px)) 16px 14px;
}

.mine-page__avatar {
	flex-shrink: 0;
	width: 54px;
	height: 54px;
	border: 1px solid rgba(255, 255, 255, 0.32);
	border-radius: 50%;
	object-fit: cover;
	background: #10151d;
}

.mine-page__profile-meta {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.mine-page__username {
	margin: 0;
	font-size: 21px;
	font-weight: 700;
	line-height: 1.3;
	color: #fff;
}

.mine-page__role {
	margin: 0;
	font-size: 13px;
	line-height: 1.3;
	color: rgba(255, 255, 255, 0.65);
}

.mine-page__rabbit {
	position: absolute;
	right: 14px;
	bottom: 6px;
	z-index: 1;
	height: 112px;
	width: auto;
	opacity: 0.62;
	pointer-events: none;
}

.mine-page__body {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-height: 0;
	padding: 0 16px calc(16px + env(safe-area-inset-bottom, 0px));
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
}

.mine-page__card {
	margin-bottom: 12px;
	border-radius: 18px;
	background: #10151d;
	border: 1px solid rgba(255, 255, 255, 0.06);
	backdrop-filter: blur(8px);
	overflow: hidden;
}

.mine-page__card--floating {
	margin-top: 10px;
	position: relative;
	z-index: 2;
}

.mine-page__row,
.mine-page__action {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	min-height: 56px;
	padding: 0 16px;
}

.mine-page__row + .mine-page__action,
.mine-page__action + .mine-page__row,
.mine-page__row + .mine-page__row {
	border-top: 1px solid rgba(255, 255, 255, 0.06);
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
	font-size: 15px;
	font-weight: 500;
	color: #fff;
}

.mine-page__value {
	font-size: 14px;
	color: rgba(255, 255, 255, 0.65);
	text-align: right;
}

.mine-page__value--accent {
	color: #00d8ff;
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
	height: 52px;
	border-radius: 16px;
	border: 1px solid rgba(0, 216, 255, 0.28);
	background: #10151d;
	box-shadow:
		inset 0 0 0 1px rgba(255, 255, 255, 0.04),
		0 8px 24px rgba(0, 0, 0, 0.32);
	color: #fff;
	font-size: 16px;
	font-weight: 600;
	line-height: 1;
	cursor: pointer;
}

.mine-page__logout-text {
	align-self: center;
	border: 0;
	padding: 4px 10px;
	background: transparent;
	font-size: 14px;
	line-height: 1.3;
	color: rgba(255, 255, 255, 0.55);
	cursor: pointer;
}
</style>
