<!-- 用户资料页 -->
<template>
	<view class="uni-content">
		<view class="avatar">
			<uni-id-pages-avatar width="260rpx" height="260rpx"></uni-id-pages-avatar>
		</view>
		<uni-list>
			<uni-list-item class="item" @click="setNickname('')" title="昵称" :rightText="userInfo.nickname||'未设置'" link>
			</uni-list-item>
			<uni-list-item class="item" @click="setGender" title="性别" :rightText="genderText" link>
			</uni-list-item>
			<uni-list-item class="item" @click="setHeight" title="身高" :rightText="heightText" link>
			</uni-list-item>
			<uni-list-item class="item" @click="setWechatId" title="微信号" :rightText="userInfo.wechat_id||'未设置'" link>
			</uni-list-item>
			<!-- #ifdef MP-WEIXIN -->
			<view class="phone-item">
				<text class="phone-label">手机号</text>
				<button class="phone-btn" open-type="getPhoneNumber" @getphonenumber="onGetPhoneNumber">
					<text class="phone-text">{{ userInfo.mobile || '点击获取' }}</text>
				</button>
			</view>
			<!-- #endif -->
			<!-- #ifndef MP-WEIXIN -->
			<uni-list-item class="item" @click="bindMobile" title="手机号" :rightText="userInfo.mobile||'未绑定'" link>
			</uni-list-item>
			<!-- #endif -->
			<uni-list-item v-if="userInfo.email" class="item" title="电子邮箱" :rightText="userInfo.email">
			</uni-list-item>
			<!-- #ifdef APP -->
      <!-- 如未开通实人认证服务，可以将实名认证入口注释 -->
			<uni-list-item class="item" @click="realNameVerify" title="实名认证" :rightText="realNameStatus !== 2 ? '未认证': '已认证'" link>
			</uni-list-item>
			<!-- #endif -->
			<uni-list-item v-if="hasPwd" class="item" @click="changePassword" title="修改密码" link>
			</uni-list-item>
		</uni-list>
		<!-- #ifndef MP -->
		<uni-list class="mt10">
			<uni-list-item @click="deactivate" title="注销账号" link="navigateTo"></uni-list-item>
		</uni-list>
		<!-- #endif -->
		<uni-popup ref="dialog" type="dialog">
			<uni-popup-dialog mode="input" :value="userInfo.nickname" @confirm="setNickname" :inputType="setNicknameIng?'nickname':'text'"
				title="设置昵称" placeholder="请输入要设置的昵称">
			</uni-popup-dialog>
		</uni-popup>
		<uni-id-pages-bind-mobile ref="bind-mobile-by-sms" @success="bindMobileSuccess"></uni-id-pages-bind-mobile>
		<template v-if="showLoginManage">
			<button v-if="userInfo._id" @click="logout">退出登录</button>
			<button v-else @click="login">去登录</button>
		</template>
	</view>
</template>
<script>
const uniIdCo = uniCloud.importObject("uni-id-co")
  import {
    store,
    mutations
  } from '@/uni_modules/uni-id-pages/common/store.js'
	export default {
    computed: {
      userInfo() {
        return store.userInfo
      },
	  realNameStatus () {
		  if (!this.userInfo.realNameAuth) {
			  return 0
		  }

		  return this.userInfo.realNameAuth.authStatus
	  },
	  genderText() {
		  const genderMap = { 0: '未设置', 1: '男', 2: '女' }
		  return genderMap[this.userInfo.gender] || '未设置'
	  },
	  heightText() {
		  return this.userInfo.height ? `${this.userInfo.height}cm` : '未设置'
	  }
    },
		data() {
			return {
				univerifyStyle: {
					authButton: {
						"title": "本机号码一键绑定", // 授权按钮文案
					},
					otherLoginButton: {
						"title": "其他号码绑定",
					}
				},
				// userInfo: {
				// 	mobile:'',
				// 	nickname:''
				// },
				hasPwd: false,
				showLoginManage: false ,//通过页面传参隐藏登录&退出登录按钮
				setNicknameIng:false
			}
		},
		async onShow() {
			this.univerifyStyle.authButton.title = "本机号码一键绑定"
			this.univerifyStyle.otherLoginButton.title = "其他号码绑定"
		},
		async onLoad(e) {
			if (e.showLoginManage) {
				this.showLoginManage = true //通过页面传参隐藏登录&退出登录按钮
			}
			//判断当前用户是否有密码，否则就不显示密码修改功能
			let res = await uniIdCo.getAccountInfo()
			this.hasPwd = res.isPasswordSet
		},
		methods: {
			login() {
				uni.navigateTo({
					url: '/uni_modules/uni-id-pages/pages/login/login-withoutpwd',
					complete: (e) => {
						// console.log(e);
					}
				})
			},
			logout() {
				mutations.logout()
			},
			bindMobileSuccess() {
				mutations.updateUserInfo()
			},
			changePassword() {
				uni.navigateTo({
					url: '/uni_modules/uni-id-pages/pages/userinfo/change_pwd/change_pwd',
					complete: (e) => {
						// console.log(e);
					}
				})
			},
			bindMobile() {
				// #ifdef APP-PLUS
				uni.preLogin({
					provider: 'univerify',
					success: this.univerify(), //预登录成功
					fail: (res) => { // 预登录失败
						// 不显示一键登录选项（或置灰）
						console.log(res)
						this.bindMobileBySmsCode()
					}
				})
				// #endif

				// #ifdef MP-WEIXIN
				this.$refs['bind-mobile-by-sms'].open()
				// #endif

				// #ifdef H5
				//...去用验证码绑定
				this.bindMobileBySmsCode()
				// #endif
			},
			univerify() {
				uni.login({
					"provider": 'univerify',
					"univerifyStyle": this.univerifyStyle,
					success: async e => {
						uniIdCo.bindMobileByUniverify(e.authResult).then(res => {
							mutations.updateUserInfo()
						}).catch(e => {
							console.log(e);
						}).finally(e => {
							// console.log(e);
							uni.closeAuthView()
						})
					},
					fail: (err) => {
						console.log(err);
						if (err.code == '30002' || err.code == '30001') {
							this.bindMobileBySmsCode()
						}
					}
				})
			},
			bindMobileBySmsCode() {
				uni.navigateTo({
					url: './bind-mobile/bind-mobile'
				})
			},
			setNickname(nickname) {
				if (nickname) {
					mutations.updateUserInfo({
						nickname
					})
					this.setNicknameIng = false
					this.$refs.dialog.close()
				} else {
					this.$refs.dialog.open()
				}
			},
			deactivate(){
				uni.navigateTo({
					url:"/uni_modules/uni-id-pages/pages/userinfo/deactivate/deactivate"
				})
			},
			async bindThirdAccount(provider) {
				const uniIdCo = uniCloud.importObject("uni-id-co")
				const bindField = {
					weixin: 'wx_openid',
					alipay: 'ali_openid',
					apple: 'apple_openid',
					qq: 'qq_openid'
				}[provider.toLowerCase()]

				if (this.userInfo[bindField]) {
					await uniIdCo['unbind' + provider]()
					await mutations.updateUserInfo()
				} else {
					uni.login({
						provider: provider.toLowerCase(),
						onlyAuthorize: true,
						success: async e => {
							const res = await uniIdCo['bind' + provider]({
								code: e.code
							})
							if (res.errCode) {
								uni.showToast({
									title: res.errMsg || '绑定失败',
									duration: 3000
								})
							}
							await mutations.updateUserInfo()
						},
						fail: async (err) => {
							console.log(err);
							uni.hideLoading()
						}
					})
				}
			},
			realNameVerify () {
				uni.navigateTo({
					url: "/uni_modules/uni-id-pages/pages/userinfo/realname-verify/realname-verify"
				})
			},
			setGender() {
				uni.showActionSheet({
					itemList: ['男', '女'],
					success: (res) => {
						const gender = res.tapIndex + 1 // 1:男, 2:女
						mutations.updateUserInfo({ gender })
					}
				})
			},
			setHeight() {
				uni.showModal({
					title: '设置身高',
					editable: true,
					placeholderText: '请输入身高(cm)，如170',
					content: this.userInfo.height ? String(this.userInfo.height) : '',
					success: (res) => {
						if (res.confirm && res.content) {
							const height = parseInt(res.content)
							if (height >= 100 && height <= 250) {
								mutations.updateUserInfo({ height })
							} else {
								uni.showToast({
									title: '请输入有效身高(100-250cm)',
									icon: 'none'
								})
							}
						}
					}
				})
			},
			setWechatId() {
				uni.showModal({
					title: '设置微信号',
					editable: true,
					placeholderText: '请输入您的微信号',
					content: this.userInfo.wechat_id || '',
					success: (res) => {
						if (res.confirm && res.content !== undefined) {
							const wechat_id = res.content.trim()
							if (wechat_id) {
								mutations.updateUserInfo({ wechat_id })
							}
						}
					}
				})
			},
			async onGetPhoneNumber(e) {
				console.log('getPhoneNumber result:', e.detail)
				if (e.detail.errMsg !== 'getPhoneNumber:ok') {
					console.log('用户拒绝授权手机号')
					return
				}
				try {
					uni.showLoading({ title: '获取中...', mask: true })
					// 新版API使用code，旧版使用encryptedData+iv
					let res
					if (e.detail.code) {
						// 新版API (2023年后)
						res = await uniIdCo.bindMobileByMpWeixin({
							phoneCode: e.detail.code
						})
					} else {
						// 旧版API
						res = await uniIdCo.bindMobileByMpWeixin({
							encryptedData: e.detail.encryptedData,
							iv: e.detail.iv
						})
					}
					if (res.errCode === 0) {
						uni.showToast({ title: '绑定成功', icon: 'success' })
						mutations.updateUserInfo()
					} else {
						uni.showToast({ title: res.errMsg || '绑定失败', icon: 'none' })
					}
				} catch (err) {
					console.error('绑定手机号失败:', err)
					uni.showToast({ title: err.message || '绑定失败', icon: 'none' })
				} finally {
					uni.hideLoading()
				}
			}
		}
	}
</script>
<style lang="scss" scoped>
	@import "@/uni_modules/uni-id-pages/common/login-page.scss";

	.uni-content {
		padding: 0;
	}

	/* #ifndef APP-NVUE */
	view {
		display: flex;
		box-sizing: border-box;
		flex-direction: column;
	}

	@media screen and (min-width: 690px) {
		.uni-content {
			padding: 0;
			max-width: 690px;
			margin-left: calc(50% - 345px);
			border: none;
			max-height: none;
			border-radius: 0;
			box-shadow: none;
		}
	}

	/* #endif */
	.avatar {
		align-items: center;
		justify-content: center;
		margin: 22px 0;
		width: 100%;
	}

	.item {
		flex: 1;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
	}

	button {
		margin: 10%;
		margin-top: 40px;
		border-radius: 0;
		background-color: #FFFFFF;
		width: 80%;
	}

	.mt10 {
		margin-top: 10px;
	}

	.phone-item {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		padding: 12px 15px;
		background-color: #fff;
		border-bottom: 1px solid #eee;

		.phone-label {
			font-size: 14px;
			color: #333;
		}

		.phone-btn {
			display: flex;
			align-items: center;
			background-color: transparent;
			border: none;
			padding: 0;
			margin: 0;
			line-height: 1;

			&::after {
				border: none;
			}

			.phone-text {
				font-size: 14px;
				color: #999;
			}
		}
	}
</style>
