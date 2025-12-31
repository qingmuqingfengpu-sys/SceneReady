<template>
	<view class="content">
		<!-- 加载中状态 -->
		<view v-if="isCheckingRole" class="loading-container">
			<view class="loading-spinner"></view>
			<text class="loading-text">加载中...</text>
		</view>

		<!-- 主内容（检查完成后显示） -->
		<template v-else>
			<!-- Logo和标题 -->
			<view class="header-section">
				<text class="app-title">SceneReady</text>
				<text class="app-subtitle">短剧行业用工平台</text>
			</view>

			<!-- 角色选择入口（游客和登录用户都可见） -->
			<view class="role-cards">
				<view class="role-card actor-card" @click="goToActor">
					<view class="icon-wrapper">
						<uni-icons type="person-filled" size="80" color="#FFD700"></uni-icons>
					</view>
					<text class="role-title">我是演员</text>
					<text class="role-desc">寻找演出机会</text>
				</view>

				<view class="role-card crew-card" @click="goToCrew">
					<view class="icon-wrapper">
						<uni-icons type="staff-filled" size="80" color="#FFD700"></uni-icons>
					</view>
					<text class="role-title">我是剧组HR</text>
					<text class="role-desc">寻找合适演员</text>
				</view>
			</view>
		</template>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				isCheckingRole: true // 是否正在检查角色
			}
		},
		onLoad() {
			// 监听登录成功事件 - 处理登录后返回的情况
			uni.$on('uni-id-pages-login-success', async (e) => {
				console.log('监听到登录成功事件', e)
				// 检查是否有预设角色（用户先选角色再登录的情况）
				const targetRole = uni.getStorageSync('selected_role')
				if (targetRole) {
					console.log('有预设角色，准备跳转:', targetRole)
					uni.removeStorageSync('selected_role')
					uni.reLaunch({
						url: targetRole === 'crew' ? '/pages/crew/index' : '/pages/actor/index'
					})
				}
			})
		},
		onShow() {
			// 每次显示页面时检查是否已登录且有角色
			this.checkUserRole()
		},
		onUnload() {
			uni.$off('uni-id-pages-login-success')
		},
		methods: {
			// 检查用户是否已登录且已设置角色（仅用于自动跳转）
			async checkUserRole() {
				console.log('checkUserRole 开始执行')
				this.isCheckingRole = true

				try {
					const currentUserInfo = uniCloud.getCurrentUserInfo()

					// 如果没有有效token，直接显示角色选择界面（游客模式）
					if (!currentUserInfo || !currentUserInfo.tokenExpired || currentUserInfo.tokenExpired < Date.now()) {
						console.log('未登录或token过期，显示角色选择界面（游客模式）')
						this.isCheckingRole = false
						return
					}

					// 已登录，检查是否已设置角色
					const userCo = uniCloud.importObject('user-co')
					const res = await userCo.getProfile()

					if (res.code === 0 && res.data) {
						const userRole = res.data.user_role
						// 如果已设置角色，自动跳转到对应端
						if (userRole === 1) {
							uni.reLaunch({ url: '/pages/crew/index' })
							return
						} else if (userRole === 2) {
							uni.reLaunch({ url: '/pages/actor/index' })
							return
						}
					}
				} catch (error) {
					console.error('检查用户角色失败:', error)
				}

				this.isCheckingRole = false
			},

			// 跳转到剧组端（游客可直接进入浏览）
			goToCrew() {
				// 记录用户选择的角色，登录后使用
				uni.setStorageSync('selected_role', 'crew')
				uni.reLaunch({
					url: '/pages/crew/index'
				})
			},

			// 跳转到演员端（游客可直接进入浏览）
			goToActor() {
				// 记录用户选择的角色，登录后使用
				uni.setStorageSync('selected_role', 'actor')
				uni.reLaunch({
					url: '/pages/actor/index'
				})
			}
		}
	}
</script>

<style lang="scss">
	@import "@/common/theme.scss";

	.content {
		height: 100vh;
		background: $bg-primary;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 40rpx;
		position: relative;
		overflow: hidden;

		// 添加微妙的背景纹理
		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: radial-gradient(circle at 20% 30%, rgba(255, 215, 0, 0.05) 0%, transparent 50%),
						radial-gradient(circle at 80% 70%, rgba(255, 215, 0, 0.03) 0%, transparent 50%);
			pointer-events: none;
		}
	}

	// 头部区域
	.header-section {
		text-align: center;
		margin-bottom: 80rpx;
		position: relative;
		z-index: 1;

		.app-title {
			display: block;
			font-size: 80rpx;
			font-weight: $font-weight-bold;
			background: linear-gradient(135deg, $primary-color 0%, #FFED4E 100%);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
			margin-bottom: 16rpx;
			letter-spacing: 6rpx;
			text-shadow: 0 0 40rpx rgba(255, 215, 0, 0.3);
		}

		.app-subtitle {
			display: block;
			font-size: 26rpx;
			color: $text-secondary;
			letter-spacing: 3rpx;
		}
	}

	// 角色卡片
	.role-cards {
		display: flex;
		flex-direction: column;
		gap: 32rpx;
		padding: 0 32rpx;
		position: relative;
		z-index: 1;
		flex: 1;
		justify-content: center;
	}

	.role-card {
		background: $bg-secondary;
		border-radius: $border-radius-lg;
		padding: 60rpx 48rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24rpx;
		box-shadow: $shadow-lg;
		border: 2rpx solid rgba(255, 215, 0, 0.1);
		transition: all 0.3s;
		position: relative;
		overflow: hidden;

		// 卡片内部光效
		&::before {
			content: '';
			position: absolute;
			top: -50%;
			left: -50%;
			width: 200%;
			height: 200%;
			background: radial-gradient(circle, rgba(255, 215, 0, 0.08) 0%, transparent 70%);
			opacity: 0;
			transition: opacity 0.3s;
		}

		&:active {
			transform: scale(0.98);
			box-shadow: 0 8rpx 32rpx rgba(255, 215, 0, 0.25);
			border-color: rgba(255, 215, 0, 0.3);

			&::before {
				opacity: 1;
			}

			.icon-wrapper {
				transform: scale(1.1);
				box-shadow: 0 0 48rpx rgba(255, 215, 0, 0.5);
			}
		}

		.icon-wrapper {
			width: 140rpx;
			height: 140rpx;
			border-radius: 50%;
			background: linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 237, 78, 0.1) 100%);
			display: flex;
			align-items: center;
			justify-content: center;
			box-shadow: 0 8rpx 24rpx rgba(255, 215, 0, 0.2);
			transition: all 0.3s;
			border: 2rpx solid rgba(255, 215, 0, 0.2);
		}

		.role-title {
			font-size: 42rpx;
			font-weight: $font-weight-bold;
			color: $text-primary;
			letter-spacing: 2rpx;
		}

		.role-desc {
			font-size: 26rpx;
			color: $text-secondary;
			text-align: center;
			letter-spacing: 2rpx;
		}
	}

	// 加载状态
	.loading-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 32rpx;
	}

	.loading-spinner {
		width: 80rpx;
		height: 80rpx;
		border: 6rpx solid rgba(255, 215, 0, 0.2);
		border-top-color: #FFD700;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-text {
		font-size: 28rpx;
		color: $text-secondary;
	}

	// 登录入口区域
	.login-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 48rpx;
		position: relative;
		z-index: 1;
	}

	.login-hint {
		font-size: 32rpx;
		color: $text-secondary;
		letter-spacing: 2rpx;
	}

	.login-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16rpx;
		background: linear-gradient(135deg, $primary-color 0%, #FFED4E 100%);
		padding: 32rpx 80rpx;
		border-radius: $border-radius-lg;
		box-shadow: 0 8rpx 32rpx rgba(255, 215, 0, 0.3);
		transition: all 0.3s;

		&:active {
			transform: scale(0.96);
			box-shadow: 0 4rpx 16rpx rgba(255, 215, 0, 0.4);
		}
	}

	.login-btn-text {
		font-size: 36rpx;
		font-weight: $font-weight-bold;
		color: #1A1A2E;
		letter-spacing: 2rpx;
	}
</style>
