<script setup>
import { ref } from 'vue';
import { useAuthSession } from '../../composables/useAuthSession.js';
import MineConfirmDialog from './components/MineConfirmDialog.vue';
import headerBg from '../../assets/images/profile/header-bg.png';
import rabbitMascot from '../../assets/images/profile/rabbit-mascot.png';
import defaultAvatar from '../../assets/images/profile/default-avatar.png';

const { logout, clearAllData } = useAuthSession();

const profile = {
	username: '超管账号',
	phone: '13752634636',
	organization: '国网省公司'
};

const confirmDialogVisible = ref(false);
const confirmDialogState = ref({
	title: '',
	message: '',
	onConfirm: null
});

const openConfirmDialog = (title, message, onConfirm) => {
	confirmDialogState.value = { title, message, onConfirm };
	confirmDialogVisible.value = true;
};

const onConfirmDialogConfirm = () => {
	confirmDialogState.value.onConfirm?.();
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
				<h1 class="mine-page__username">{{ profile.username }}</h1>
			</div>

			<img class="mine-page__rabbit" :src="rabbitMascot" alt="" aria-hidden="true" />
		</header>

		<div class="mine-page__body">
			<section class="mine-page__card">
				<div class="mine-page__row">
					<span class="mine-page__label">联系方式</span>
					<span class="mine-page__value">{{ profile.phone }}</span>
				</div>
				<div class="mine-page__row">
					<span class="mine-page__label">所属单位</span>
					<span class="mine-page__value">{{ profile.organization }}</span>
				</div>
			</section>

			<section class="mine-page__card">
				<button type="button" class="mine-page__action" @click="openClearCacheDialog">
					<span class="mine-page__label">清除缓存</span>
					<span class="mine-page__chevron" aria-hidden="true">›</span>
				</button>
			</section>

			<div class="mine-page__actions">
				<button type="button" class="mine-page__btn" @click="onSwitchAccount">
					切换账号
				</button>
				<button type="button" class="mine-page__btn" @click="onLogout">退出登录</button>
			</div>
		</div>

		<MineConfirmDialog
			v-model:visible="confirmDialogVisible"
			:title="confirmDialogState.title"
			:message="confirmDialogState.message"
			confirm-text="确认"
			cancel-text="取消"
			@confirm="onConfirmDialogConfirm"
		/>
	</main>
</template>

<style scoped lang="scss">
.mine-page {
	display: flex;
	flex-direction: column;
	height: 100%;
	background: #0a0a0a;
	color: #fff;
	overflow: hidden;
	gap: 14px;
}

.mine-page__hero {
	position: relative;
	flex-shrink: 0;
	height: 168px;
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

.mine-page__hero::after {
	content: '';
	position: absolute;
	inset: 0;
	background: linear-gradient(180deg, rgba(10, 10, 10, 0.1) 0%, rgba(10, 10, 10, 0.55) 100%);
	pointer-events: none;
}

.mine-page__profile {
	position: relative;
	z-index: 1;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: calc(28px + env(safe-area-inset-top, 0px)) 16px 20px;
}

.mine-page__avatar {
	flex-shrink: 0;
	width: 56px;
	height: 56px;
	border: 2px solid rgba(255, 255, 255, 0.9);
	border-radius: 50%;
	object-fit: cover;
	background: #1a1a1a;
}

.mine-page__username {
	margin: 0;
	font-size: 20px;
	font-weight: 700;
	line-height: 1.3;
	color: #fff;
}

.mine-page__rabbit {
	position: absolute;
	right: 8px;
	bottom: -4px;
	z-index: 1;
	width: 108px;
	height: auto;
	pointer-events: none;
	animation: mine-rabbit-jump 1.8s ease-in-out infinite;
	transform-origin: center bottom;
}

@keyframes mine-rabbit-jump {
	0%,
	100% {
		transform: translateY(0) scale(1);
	}
	18% {
		transform: translateY(-10px) scale(1.02, 0.98);
	}
	36% {
		transform: translateY(0) scale(0.98, 1.02);
	}
	52% {
		transform: translateY(-6px) scale(1.01, 0.99);
	}
	68% {
		transform: translateY(0) scale(1);
	}
}

.mine-page__body {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-height: 0;
	padding: 0 16px 16px;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
}

.mine-page__card {
	margin-bottom: 12px;
	border-radius: 10px;
	background: #1a1a1a;
	overflow: hidden;
}

.mine-page__row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	min-height: 52px;
	padding: 0 16px;
}

.mine-page__row + .mine-page__row {
	border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.mine-page__action {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	min-height: 52px;
	padding: 0 16px;
	border: 0;
	background: transparent;
	color: inherit;
	font: inherit;
	text-align: left;
	cursor: pointer;
}

.mine-page__label {
	font-size: 15px;
	color: #fff;
}

.mine-page__value {
	font-size: 14px;
	color: rgba(255, 255, 255, 0.45);
	text-align: right;
}

.mine-page__chevron {
	font-size: 22px;
	line-height: 1;
	color: rgba(255, 255, 255, 0.35);
}

.mine-page__actions {
	margin-top: auto;
	padding-top: 24px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.mine-page__btn {
	width: 100%;
	height: 48px;
	border: 0;
	border-radius: 10px;
	background: #1a1a1a;
	color: #fff;
	font-size: 16px;
	font-weight: 500;
	line-height: 1;
	cursor: pointer;
}
</style>
