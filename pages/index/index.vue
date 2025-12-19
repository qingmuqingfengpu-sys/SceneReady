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
				<text class="app-title">艺拍即合</text>
				<text class="app-subtitle">短剧行业用工平台</text>
			</view>

			<!-- 未登录时显示登录入口 -->
			<view v-if="!isLoggedIn" class="login-section">
				<text class="login-hint">请先登录以继续使用</text>
				<view class="login-btn" @click="toLogin">
					<uni-icons type="person" size="24" color="#1A1A2E"></uni-icons>
					<text class="login-btn-text">立即登录</text>
				</view>
			</view>

			<!-- 角色选择入口（登录后显示） -->
			<view v-else class="role-cards">
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
				loginType: "username", // 默认使用账号密码登录
				isCheckingRole: true, // 是否正在检查角色
				isLoggedIn: false // 是否已登录
			}
		},
		onLoad() {
			// 监听登录成功事件 - 处理预设角色的情况
			uni.$on('uni-id-pages-login-success', async (e) => {
				console.log('监听到登录成功事件', e)

				// 注意: 不要手动存储 token，uni-id-co.login() 成功后 SDK 会自动处理
				// 手动存储可能会干扰 SDK 的内部 token 管理机制

				// 检查是否有预设角色（用户先选角色再登录的情况）
				const targetRole = uni.getStorageSync('selected_role')
				if (targetRole) {
					console.log('有预设角色，准备设置并跳转:', targetRole)
					try {
						// 等待 SDK token 状态同步
						await this.waitForTokenReady()
						await this.saveUserRole(targetRole === 'crew' ? 1 : 2)
						uni.removeStorageSync('selected_role')

						uni.reLaunch({
							url: targetRole === 'crew' ? '/pages/crew/index' : '/pages/actor/index'
						})
					} catch (error) {
						console.error('设置预设角色失败:', error)
						uni.removeStorageSync('selected_role')
					}
				} else {
					// 没有预设角色，延迟后重新检查用户状态
					// 这是为了处理 loginBack 可能没有正确 reLaunch 的情况
					console.log('无预设角色，延迟后检查用户状态')
					// 等待 SDK token 状态完全同步后再检查
					await this.waitForTokenReady()
					this.checkUserRole()
				}
			})
		},
		onShow() {
			// 每次显示页面时检查用户角色
			// 添加小延迟确保 token 已被正确存储（解决 reLaunch 后的时序问题）
			setTimeout(() => {
				this.checkUserRole()
			}, 100)
		},
		onUnload() {
			// 移除监听
			uni.$off('uni-id-pages-login-success')
		},
		methods: {
			// 等待 token 准备就绪（SDK 内部状态同步）
			waitForTokenReady(maxWait = 1000) {
				return new Promise((resolve) => {
					const startTime = Date.now()
					const checkToken = () => {
						const userInfo = uniCloud.getCurrentUserInfo()
						console.log('waitForTokenReady 检查:', userInfo)
						// 如果有有效的 uid 和未过期的 token，认为准备好了
						if (userInfo && userInfo.uid && userInfo.tokenExpired > Date.now()) {
							console.log('Token 已就绪')
							resolve(true)
						} else if (Date.now() - startTime >= maxWait) {
							console.log('等待 token 超时')
							resolve(false)
						} else {
							// 继续等待
							setTimeout(checkToken, 100)
						}
					}
					// 先等待一小段时间让 SDK 完成存储
					setTimeout(checkToken, 100)
				})
			},

			// 检查用户是否已登录且已设置角色
			async checkUserRole() {
				console.log('checkUserRole 开始执行')
				this.isCheckingRole = true

				try {
					// 使用 uniCloud 提供的方法获取当前用户信息（更可靠）
					const currentUserInfo = uniCloud.getCurrentUserInfo()
					console.log('currentUserInfo:', JSON.stringify(currentUserInfo))

					// 检查 token 是否有效（确保 currentUserInfo 存在且有效）
					if (!currentUserInfo || !currentUserInfo.tokenExpired || currentUserInfo.tokenExpired < Date.now()) {
						console.log('token无效或过期，显示登录入口')
						this.isLoggedIn = false
						this.isCheckingRole = false
						return
					}

					// 本地有有效token，向服务端验证并获取用户信息
					console.log('向服务端验证token...')
					const userCo = uniCloud.importObject('user-co')
					const res = await userCo.getProfile()
					console.log('getProfile 返回:', res)

					// 服务端返回未登录，清除本地状态
					if (res.code === 401 || res.code !== 0) {
						console.log('服务端验证失败，清除登录状态')
						this.clearLoginState()
						this.isCheckingRole = false
						return
					}

					// 验证成功，用户已登录
					this.isLoggedIn = true
					console.log('用户已登录，isLoggedIn =', this.isLoggedIn)

					if (res.data) {
						const userRole = res.data.user_role
						console.log('用户角色 user_role =', userRole)

						// 如果用户已设置角色，直接跳转到对应端
						if (userRole === 1) {
							console.log('用户已是剧组角色，跳转到剧组端')
							uni.reLaunch({
								url: '/pages/crew/index'
							})
							return
						} else if (userRole === 2) {
							console.log('用户已是演员角色，跳转到演员端')
							uni.reLaunch({
								url: '/pages/actor/index'
							})
							return
						}
						// user_role === 0 或 undefined 表示未设置角色，显示选择界面
						console.log('用户未设置角色，将显示角色选择界面')
					}
				} catch (error) {
					console.error('检查用户角色失败:', error)
					this.clearLoginState()
				}

				this.isCheckingRole = false
				console.log('checkUserRole 执行完毕, isCheckingRole =', this.isCheckingRole, ', isLoggedIn =', this.isLoggedIn)
			},

			// 清除登录状态
			clearLoginState() {
				this.isLoggedIn = false
				uni.removeStorageSync('uni_id_token')
				uni.removeStorageSync('uni_id_token_expired')
			},

			// 保存用户角色到数据库
			async saveUserRole(role) {
				try {
					const userCo = uniCloud.importObject('user-co')
					const res = await userCo.setRole(role)
					console.log('设置用户角色结果:', res)
					return res
				} catch (error) {
					console.error('设置用户角色失败:', error)
					return { code: 500, message: error.message }
				}
			},

			// 跳转到剧组端
			async goToCrew() {
				try {
					uni.showLoading({ title: '设置中...' })
					const res = await this.saveUserRole(1) // 1 = 剧组
					uni.hideLoading()

					if (res.code === 0) {
						// 设置成功，跳转到剧组端
						uni.reLaunch({
							url: '/pages/crew/index'
						})
					} else if (res.code === 400) {
						// 角色已设置，检查实际角色并跳转
						await this.checkUserRole()
					} else {
						uni.showToast({
							title: res.message || '设置失败',
							icon: 'none'
						})
					}
				} catch (error) {
					console.error('设置角色失败:', error)
					uni.hideLoading()
					// 可能是登录过期，重新检查状态
					this.isLoggedIn = false
					uni.showToast({
						title: '登录已过期，请重新登录',
						icon: 'none'
					})
				}
			},

			// 跳转到演员端
			async goToActor() {
				try {
					uni.showLoading({ title: '设置中...' })
					const res = await this.saveUserRole(2) // 2 = 演员
					uni.hideLoading()

					if (res.code === 0) {
						// 设置成功，跳转到演员端
						uni.reLaunch({
							url: '/pages/actor/index'
						})
					} else if (res.code === 400) {
						// 角色已设置，检查实际角色并跳转
						await this.checkUserRole()
					} else {
						uni.showToast({
							title: res.message || '设置失败',
							icon: 'none'
						})
					}
				} catch (error) {
					console.error('设置角色失败:', error)
					uni.hideLoading()
					// 可能是登录过期，重新检查状态
					this.isLoggedIn = false
					uni.showToast({
						title: '登录已过期，请重新登录',
						icon: 'none'
					})
				}
			},

			toLogin() {
				if (this.loginType == 'username') {
					uni.navigateTo({
						url: "/uni_modules/uni-id-pages/pages/login/login-withpwd"
					})
				} else {
					uni.navigateTo({
						url: "/uni_modules/uni-id-pages/pages/login/login-withoutpwd?type=" + this.loginType,
						animationType:"none",
						animationDuration:0
					})
				}
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
