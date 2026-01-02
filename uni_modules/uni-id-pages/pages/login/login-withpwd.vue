<!-- 账号密码登录页 -->
<template>
	<view class="uni-content">
		<view class="login-logo">
			<image :src="logo"></image>
		</view>
		<!-- 顶部文字 -->
		<text class="title title-box">账号密码登录</text>
		<uni-forms>
			<uni-forms-item name="username">
				<uni-easyinput :focus="focusUsername" @blur="focusUsername = false" class="input-box"
					:inputBorder="false" v-model="username" placeholder="请输入手机号/用户名/邮箱" />
			</uni-forms-item>
			<uni-forms-item name="password">
				<uni-easyinput :focus="focusPassword" @blur="focusPassword = false" class="input-box" clearable
					type="password" :inputBorder="false" v-model="password" placeholder="请输入密码" />
			</uni-forms-item>
		</uni-forms>
		<uni-captcha v-if="needCaptcha" focus ref="captcha" scene="login-by-pwd" v-model="captcha" />
		<!-- 带选择框的隐私政策协议组件 -->
		<uni-id-pages-agreements scope="login" ref="agreements"></uni-id-pages-agreements>
		<button class="uni-btn" type="primary" @click="pwdLogin">登录</button>
		<!-- 忘记密码 -->
		<view class="link-box">
			<view v-if="!config.isAdmin">
				<text class="forget">忘记了？</text>
				<text class="link" @click="toRetrievePwd">找回密码</text>
			</view>
			<text class="link" @click="toRegister">{{config.isAdmin ? '注册管理员账号': '注册账号'}}</text>
			<!-- <text class="link" @click="toRegister" v-if="!config.isAdmin">注册账号</text> -->
		</view>
		<!-- 悬浮登录方式组件 -->
		<uni-id-pages-fab-login ref="uniFabLogin"></uni-id-pages-fab-login>
	</view>
</template>

<script>
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
	const uniIdCo = uniCloud.importObject("uni-id-co", {
		errorOptions: {
			type: 'toast'
		}
	})
	export default {
		mixins: [mixin],
		data() {
			return {
				"password": "",
				"username": "",
				"captcha": "",
				"needCaptcha": false,
				"focusUsername": false,
				"focusPassword": false,
				"logo": "/static/logo.png"
			}
		},
		onShow() {
			// #ifdef H5
			document.onkeydown = event => {
				var e = event || window.event;
				if (e && e.keyCode == 13) { //回车键的键值为13
					this.pwdLogin()
				}
			};
			// #endif

			// 检查是否已登录，如果已登录则根据角色跳转
			this.checkLoginAndRedirect()
		},
		methods: {
			// 检查登录状态并自动跳转
			async checkLoginAndRedirect() {
				try {
					const token = uni.getStorageSync('uni_id_token')
					const tokenExpired = uni.getStorageSync('uni_id_token_expired')

					// 如果没有token或已过期，不跳转
					if (!token || !tokenExpired || tokenExpired < Date.now()) {
						return
					}

					// 有有效token，验证并获取用户角色
					const userCo = uniCloud.importObject('user-co')
					const res = await userCo.getProfile()

					if (res.code === 0 && res.data) {
						const userRole = res.data.user_role

						// 根据角色跳转到对应页面
						if (userRole === 1) {
							// 剧组角色，跳转到剧组端
							uni.reLaunch({
								url: '/pages/crew/index'
							})
						} else if (userRole === 2) {
							// 演员角色，跳转到演员端
							uni.reLaunch({
								url: '/pages/actor/index'
							})
						} else {
							// 未设置角色，跳转到角色选择页
							uni.reLaunch({
								url: '/pages/index/index'
							})
						}
					}
				} catch (error) {
					console.error('检查登录状态失败:', error)
				}
			},
			// 页面跳转，找回密码
			toRetrievePwd() {
				let url = '/uni_modules/uni-id-pages/pages/retrieve/retrieve'
				//如果刚好用户名输入框的值为手机号码，就把它传到retrieve页面，根据该手机号找回密码
				if (/^1\d{10}$/.test(this.username)) {
					url += `?phoneNumber=${this.username}`
				}
				uni.navigateTo({
					url
				})
			},
		// 获取角色文本
			getRoleText() {
				const selectedRole = uni.getStorageSync('selected_role') || ''
				return selectedRole === 'actor' ? '演员' : (selectedRole === 'crew' ? '剧组' : '')
			},
			/**
			 * 密码登录
			 */
			pwdLogin() {
				if (!this.password.length) {
					this.focusPassword = true
					return uni.showToast({
						title: '请输入密码',
						icon: 'none',
						duration: 3000
					});
				}
				if (!this.username.length) {
					this.focusUsername = true
					return uni.showToast({
						title: '请输入手机号/用户名/邮箱',
						icon: 'none',
						duration: 3000
					});
				}
				if (this.needCaptcha && this.captcha.length != 4) {
					this.$refs.captcha.getImageCaptcha()
					return uni.showToast({
						title: '请输入验证码',
						icon: 'none',
						duration: 3000
					});
				}

				if (this.needAgreements && !this.agree) {
					return this.$refs.agreements.popup(this.pwdLogin)
				}

				let data = {
					"password": this.password,
					"captcha": this.captcha
				}

				if (/^1\d{10}$/.test(this.username)) {
					data.mobile = this.username
				} else if (/@/.test(this.username)) {
					data.email = this.username
				} else {
					data.username = this.username
				}

				uniIdCo.login(data).then(async e => {
					// 检查是否需要设置角色
					const selectedRole = uni.getStorageSync('selected_role') || ''
					if (selectedRole) {
						try {
							const userCo = uniCloud.importObject('user-co')
							const role = selectedRole === 'crew' ? 1 : 2 // crew=1, actor=2
							const setRoleResult = await userCo.setRole(role)
							console.log('角色设置结果:', setRoleResult)
						} catch (err) {
							// 可能是老用户已经有角色了，忽略错误
							console.log('角色设置跳过（可能已存在）:', err.message)
						}
					}

					// 登录成功后跳转到角色选择页，不自动返回上一页
					this.loginSuccess({
						...e,
						autoBack: false,
						showToast: true,
						toastText: '登录成功'
					})
					// 跳转到角色选择页面（首页会根据用户角色自动跳转）
					setTimeout(() => {
						uni.reLaunch({
							url: '/pages/index/index'
						})
					}, 500)
				}).catch(e => {
					if (e.errCode == 'uni-id-captcha-required') {
						this.needCaptcha = true
					} else if (this.needCaptcha) {
						//登录失败，自动重新获取验证码
						this.$refs.captcha.getImageCaptcha()
					}
				})
			},
			/* 前往注册 */
			toRegister() {
				uni.navigateTo({
					url: this.config.isAdmin ? '/uni_modules/uni-id-pages/pages/register/register-admin' :
						'/uni_modules/uni-id-pages/pages/register/register',
					fail(e) {
						console.error(e);
					}
				})
			}
		}
	}
</script>

<style lang="scss" scoped>
	@import "@/uni_modules/uni-id-pages/common/login-page.scss";

	@media screen and (min-width: 690px) {
		.uni-content {
			height: auto;
		}
	}

	.forget {
		font-size: 12px;
		color: #8a8f8b;
	}

	.link-box {
		/* #ifndef APP-NVUE */
		display: flex;
		/* #endif */
		flex-direction: row;
		justify-content: space-between;
		margin-top: 20px;
	}

	.link {
		font-size: 12px;
	}
</style>
