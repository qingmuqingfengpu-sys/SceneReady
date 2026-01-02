<template>
	<view>
		<view class="fab-login-box">
			<view class="item" v-for="(item,index) in servicesList" :key="index"
				@click="item.path?toPage(item.path):login_before(item.id,false)">
				<image class="logo" :src="item.logo" mode="scaleToFill"></image>
				<text class="login-title">{{item.text}}</text>
			</view>
		</view>
	</view>
</template>
<script>
	import config from '@/uni_modules/uni-id-pages/config.js'
	import {store,mutations} from '@/uni_modules/uni-id-pages/common/store.js'
	let allServicesList = []
	export default {
		computed: {
			agreements() {
				if (!config.agreements) {
					return []
				}
				let {
					serviceUrl,
					privacyUrl
				} = config.agreements
				return [{
						url: serviceUrl,
						title: "用户服务协议"
					},
					{
						url: privacyUrl,
						title: "隐私政策条款"
					}
				]
			},
			agree: {
				get() {
					return this.getParentComponent().agree
				},
				set(agree) {
					return this.getParentComponent().agree = agree
				}
			}
		},
		data() {
			return {
				servicesList: [{
						"id": "username",
						"text": "账号登录",
						"logo": "/uni_modules/uni-id-pages/static/login/uni-fab-login/user.png",
						"path": "/uni_modules/uni-id-pages/pages/login/login-withpwd"
					},
					{
						"id": "smsCode",
						"text": "短信验证码",
						"logo": "/uni_modules/uni-id-pages/static/login/uni-fab-login/sms.png",
						"path": "/uni_modules/uni-id-pages/pages/login/login-withoutpwd?type=smsCode"
					},
					{
						"id": "weixin",
						"text": "微信登录",
						"logo": "/uni_modules/uni-id-pages/static/login/uni-fab-login/weixin.png",
					},
					// #ifndef MP-WEIXIN
					{
						"id": "apple",
						"text": "苹果登录",
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/apple.png",
					},
					{
						"id": "univerify",
						"text": "一键登录",
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/univerify.png",
					},
					{
						"id": "taobao",
						"text": "淘宝登录",
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/taobao.png",
					},
					{
						"id": "facebook",
						"text": "脸书登录",
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/facebook.png",
					},
					{
						"id": "alipay",
						"text": "支付宝登录",
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/alipay.png",
					},
					{
						"id": "qq",
						"text": "QQ登录",
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/qq.png",
					},
					{
						"id": "google",
						"text": "谷歌登录",
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/google.png",
					},
					{
						"id": "douyin",
						"text": "抖音登录",
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/douyin.png",
					},
					{
						"id": "sinaweibo",
						"text": "新浪微博",
						"logo": "/uni_modules/uni-id-pages/static/app-plus/uni-fab-login/sinaweibo.png",
					}
					// #endif
				],
				univerifyStyle: {
					"fullScreen": true,
					"backgroundColor": "#ffffff",
					"buttons": {
						"iconWidth": "45px",
						"list": []
					},
					"privacyTerms": {
						"defaultCheckBoxState": false,
						"textColor": "#BBBBBB",
						"termsColor": "#5496E3",
						"prefix": "我已阅读并同意",
						"suffix": "并使用本机号码登录",
						"privacyItems": []
					}
				}
			}
		},
		watch: {
			agree(agree) {
				this.univerifyStyle.privacyTerms.defaultCheckBoxState = agree
			}
		},
		async created() {
			let servicesList = this.servicesList
			let loginTypes = config.loginTypes

			servicesList = servicesList.filter(item => {

				// #ifndef APP
				if (item.id == 'apple') {
					return false
				}
				// #endif

				// #ifdef APP
				if (item.id == 'apple' && uni.getSystemInfoSync().osName != 'ios') {
					return false
				}
				// #endif

				return loginTypes.includes(item.id)
			})
			if (loginTypes.includes('univerify')) {
				this.univerifyStyle.privacyTerms.privacyItems = this.agreements
				servicesList.forEach(({
					id,
					logo,
					path
				}) => {
					if (id != 'univerify') {
						this.univerifyStyle.buttons.list.push({
							"iconPath": logo,
							"provider": id,
							path
						})
					}
				})
			}

			this.servicesList = servicesList.filter(item => {
				let path = item.path ? item.path.split('?')[0] : '';
				return path != this.getRoute(1)
			})
		},
		methods: {
			getParentComponent(){
				// #ifndef H5
				return this.$parent;
				// #endif

				// #ifdef H5
				return this.$parent.$parent;
				// #endif
			},
			setUserInfo(e) {
				console.log('setUserInfo', e);
			},
			getRoute(n = 0) {
				let pages = getCurrentPages();
				if (n > pages.length) {
					return ''
				}
				return '/' + pages[pages.length - n].route
			},
			toPage(path,index = 0) {
				if (this.getRoute(1) == path.split('?')[0] && this.getRoute(1) ==
					'/uni_modules/uni-id-pages/pages/login/login-withoutpwd') {
					let loginType = path.split('?')[1].split('=')[1]
					uni.$emit('uni-id-pages-setLoginType', loginType)
				} else if (this.getRoute(2) == path) {
					uni.navigateBack();
				} else if (this.getRoute(1) != path) {
					if(index === 0){
						uni.navigateTo({
							url: path,
							animationType: 'slide-in-left',
							complete(e) {
							}
						})
					}else{
						uni.redirectTo({
							url: path,
							animationType: 'slide-in-left',
							complete(e) {
							}
						})
					}
				} else {
					console.log('unexpected path:' + path);
				}
			},
			// 获取角色文本
			getRoleText() {
				const selectedRole = uni.getStorageSync('selected_role') || ''
				return selectedRole === 'actor' ? '演员' : (selectedRole === 'crew' ? '剧组' : '')
			},
			async login_before(type, navigateBack = true, options = {}) {
				console.log(type);
				if (["qq",
						"xiaomi",
						"sinaweibo",
						"taobao",
						"facebook",
						"google",
						"alipay",
						"douyin",
					].includes(type)) {
					return uni.showToast({
						title: '该登录方式暂未实现',
						icon: 'none',
						duration: 3000
					});
				}

				// 第三方登录前确认角色（微信等可能是新用户注册）
				const selectedRole = uni.getStorageSync('selected_role') || ''
				const roleText = this.getRoleText()
				if (roleText && ['weixin', 'apple', 'qq'].includes(type)) {
					const confirmed = await new Promise((resolve) => {
						uni.showModal({
							title: '登录确认',
							content: `您即将登录/注册的账号是${roleText}账号，如果是新用户注册后角色不可更改，是否继续？`,
							confirmText: '继续',
							cancelText: '取消',
							success: (res) => {
								resolve(res.confirm)
							}
						})
					})
					if (!confirmed) {
						return
					}
				}

				// #ifdef APP
				let isAppExist = true
				await new Promise((callback) => {
					plus.oauth.getServices(oauthServices => {
						let index = oauthServices.findIndex(e => e.id == type)
						if(index != -1){
							isAppExist = oauthServices[index].nativeClient
							callback()
						}else{
							return uni.showToast({
								title: '当前设备不支持此登录',
								icon: 'none',
								duration: 3000
							});
						}
					}, err => {
						throw new Error('获取服务供应商失败：' + JSON.stringify(err))
					})
				})
				// #endif

				if (
					// #ifdef APP
					!isAppExist
					// #endif

					// #ifndef APP
					["univerify","apple"].includes(type)
					// #endif

				) {
					return uni.showToast({
						title: '当前设备不支持此登录',
						icon: 'none',
						duration: 3000
					});
				}

				let needAgreements = (config?.agreements?.scope || []).includes('register')
				if (type != 'univerify' && needAgreements && !this.agree) {
					let agreementsRef = this.getParentComponent().$refs.agreements
					return agreementsRef.popup(() => {
						this.login_before(type, navigateBack, options)
					})
				}

				// #ifdef H5
				if(type == 'weixin'){
					// #ifdef VUE2
					const baseUrl = process.env.BASE_URL
					// #endif
					// #ifdef VUE3
					const baseUrl = import.meta.env.BASE_URL
					// #endif

					let redirectUrl = location.protocol +
						'//' +
						location.host +
						baseUrl.replace(/\/$/, '') +
						(window.location.href.includes('#')?'/#':'') +
						'/uni_modules/uni-id-pages/pages/login/login-withoutpwd?is_weixin_redirect=true&type=weixin'

					redirectUrl=redirectUrl.replace(location.host,config.webWXAuthBackDomain)

					let ua = window.navigator.userAgent.toLowerCase();
					if (ua.match(/MicroMessenger/i) == 'micromessenger'){
						return window.open(`https://open.weixin.qq.com/connect/oauth2/authorize?
									appid=${config.appid.weixin.h5}
									&redirect_uri=${encodeURIComponent(redirectUrl)}
									&response_type=code
									&scope=snsapi_userinfo
									&state=STATE&connect_redirect=1#wechat_redirect`);

					}else{
						return location.href = `https://open.weixin.qq.com/connect/qrconnect?appid=${config.appid.weixin.web}
										&redirect_uri=${encodeURIComponent(redirectUrl)}
										&response_type=code&scope=snsapi_login&state=STATE#wechat_redirect`
					}
				}
				// #endif

				uni.showLoading({
					mask: true
				})

				if (type == 'univerify') {
					let univerifyManager = uni.getUniverifyManager()
					let clickAnotherButtons = false
					let onButtonsClickFn = async res => {
						console.log('provider:', res, res.provider, this.univerifyStyle.buttons.list);
						clickAnotherButtons = true
						let checkBoxState = await uni.getCheckBoxState();
						// #ifdef VUE2
						this.agree = checkBoxState[1].state
						// #endif
						// #ifdef VUE3
						this.agree = checkBoxState.state
						// #endif
						let {
							path
						} = this.univerifyStyle.buttons.list[res.index]
						if (path) {
							if( this.getRoute(1).includes('login-withoutpwd') && path.includes('login-withoutpwd') ){
								this.getParentComponent().showCurrentWebview()
							}
							this.toPage(path,1)
							closeUniverify()
						} else {
							if (this.agree) {
								closeUniverify()
								setTimeout(() => {
									this.login_before(res.provider)
								}, 500)
							} else {
								uni.showToast({
									title: "你未同意隐私政策协议",
									icon: 'none',
									duration: 3000
								});
							}
						}
					}

					function closeUniverify() {
						uni.hideLoading()
						univerifyManager.close()
						univerifyManager.offButtonsClick(onButtonsClickFn)
					}
					univerifyManager.onButtonsClick(onButtonsClickFn)
					return univerifyManager.login({
						"univerifyStyle": this.univerifyStyle,
						success: res => {
							this.login(res.authResult, 'univerify')
						},
						fail(err) {
							console.log(err)
							if(!clickAnotherButtons){
								uni.navigateBack()
							}
						},
						complete: async e => {
							uni.hideLoading()
							univerifyManager.offButtonsClick(onButtonsClickFn)
						}
					})
				}

				if (type === 'weixinMobile') {
					return this.login({
						phoneCode: options.phoneNumberCode
					}, type)
				}

				uni.login({
					"provider": type,
					"onlyAuthorize": true,
					// #ifdef APP
					"univerifyStyle": this.univerifyStyle,
					// #endif
					success: async e => {
						if (type == 'apple') {
							let res = await this.getUserInfo({
								provider: "apple"
							})
							Object.assign(e.authResult, res.userInfo)
							uni.hideLoading()
						}
						this.login(type == 'weixin' ? {
							code: e.code
						} : e.authResult, type)
					},
					fail: async (err) => {
						console.log(err);
						uni.hideLoading()
					}
				})
			},
			login(params, type) {
				console.log({params,type});
				// hideLoading before login request to avoid mismatch
				uni.hideLoading();

				let action = 'loginBy' + type.trim().replace(type[0], type[0].toUpperCase())
				const uniIdCo = uniCloud.importObject("uni-id-co",{
					customUI:true
				})
				uniIdCo[action](params).then(async result => {
					console.log('login success:', result);

					// 检查是否需要设置角色（新用户注册的情况）
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

					uni.showToast({
						title: '登录成功',
						icon: 'none',
						duration: 2000
					});
					// #ifdef H5
					result.loginType = type
					// #endif
					// autoBack: false, showToast: false - 让index.vue的事件监听器控制跳转
					mutations.loginSuccess({...result, autoBack: false, showToast: false})
					// 登录成功后跳转到首页，让首页处理角色检查和跳转
					setTimeout(() => {
						uni.reLaunch({
							url: '/pages/index/index'
						})
					}, 500)
				})
				.catch(e=>{
					console.error('login failed:', e);
					uni.showModal({
						content: e.message,
						confirmText:"知道了",
						showCancel: false
					});
				})
				.finally(e => {
					if (type == 'univerify') {
						uni.closeAuthView()
					}
				})
			},
			async getUserInfo(e) {
				return new Promise((resolve, reject) => {
					uni.getUserInfo({
						...e,
						success: (res) => {
							resolve(res);
						},
						fail: (err) => {
							uni.showModal({
								content: JSON.stringify(err),
								showCancel: false
							});
							reject(err);
						}
					})
				})
			}
		}
	}
</script>

<style lang="scss">
	/* #ifndef APP-NVUE */
	.fab-login-box,
	.item {
		display: flex;
		box-sizing: border-box;
		flex-direction: column;
	}
	/* #endif */

	.fab-login-box {
		flex-direction: row;
		flex-wrap: wrap;
		width: 750rpx;
		justify-content: space-around;
		position: fixed;
		left: 0;
	}

	.item {
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 200rpx;
		cursor: pointer;
	}

	/* #ifndef APP-NVUE */
	@media screen and (min-width: 690px) {
		.fab-login-box {
			max-width: 500px;
			margin-left: calc(50% - 250px);
		}
		.item {
			height: 160rpx;
		}
	}

	@media screen and (max-width: 690px) {
		.fab-login-box {
			bottom: 10rpx;
		}
	}

	/* #endif */

	.logo {
		width: 60rpx;
		height: 60rpx;
		max-width: 40px;
		max-height: 40px;
		border-radius: 100%;
		border: solid 1px #F6F6F6;
	}

	.login-title {
		text-align: center;
		margin-top: 6px;
		color: #999;
		font-size: 10px;
		width: 70px;
	}
</style>
