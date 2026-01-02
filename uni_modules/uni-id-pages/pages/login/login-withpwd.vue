<!-- 登录页 - 简化版 -->
<template>
  <view class="login-page">
    <!-- 背景装饰 -->
    <view class="login-bg">
      <view class="bg-circle circle-1"></view>
      <view class="bg-circle circle-2"></view>
    </view>

    <!-- 主内容区 -->
    <view class="login-content">
      <!-- Logo和标题 -->
      <view class="login-header">
        <image class="login-logo" src="/static/logo.png" mode="aspectFit"></image>
        <text class="login-title"SceneReady</text>
        <text class="login-subtitle">短剧行业用工平台</text>
      </view>

      <!-- 角色提示 -->
      <view class="role-hint" v-if="selectedRoleText">
        <uni-icons type="info" size="16" color="#FFD700"></uni-icons>
        <text>您正在以 <text class="role-text">{{ selectedRoleText }}</text> 身份登录</text>
      </view>

      <!-- 登录按钮区 -->
      <view class="login-buttons">
        <!-- 微信登录按钮 - 主色调 -->
        <!-- #ifdef MP-WEIXIN -->
        <button class="login-btn wechat-btn" open-type="getPhoneNumber" @getphonenumber="wechatPhoneLogin">
          <view class="btn-icon wechat-icon">
            <uni-icons type="weixin" size="28" color="#fff"></uni-icons>
          </view>
          <text class="btn-text">微信一键登录</text>
        </button>
        <!-- #endif -->

        <!-- #ifndef MP-WEIXIN -->
        <button class="login-btn wechat-btn" @tap="wechatLogin">
          <view class="btn-icon wechat-icon">
            <uni-icons type="weixin" size="28" color="#fff"></uni-icons>
          </view>
          <text class="btn-text">微信登录</text>
        </button>
        <!-- #endif -->

        <!-- 验证码登录按钮 - 辅助色调 -->
        <button class="login-btn sms-btn" @tap="goToSmsLogin">
          <view class="btn-icon sms-icon">
            <uni-icons type="phone" size="24" color="#fff"></uni-icons>
          </view>
          <text class="btn-text">手机验证码登录</text>
        </button>

      </view>

      <!-- 协议 -->
      <view class="agreement-section">
        <uni-id-pages-agreements scope="register" ref="agreements"></uni-id-pages-agreements>
      </view>
    </view>
  </view>
</template>

<script>
import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';

export default {
  mixins: [mixin],
  data() {
    return {
      phone: '',
      selectedRole: '',
      logo: '/static/logo.png'
    }
  },

  computed: {
    selectedRoleText() {
      if (this.selectedRole === 'actor') return '演员';
      if (this.selectedRole === 'crew') return '剧组';
      return '';
    }
  },

  onLoad() {
    this.selectedRole = uni.getStorageSync('selected_role') || '';
  },

  onShow() {
    // 检查是否已登录
    this.checkLoginAndRedirect();
  },

  methods: {
    // 检查登录状态并自动跳转
    async checkLoginAndRedirect() {
      try {
        const token = uni.getStorageSync('uni_id_token');
        const tokenExpired = uni.getStorageSync('uni_id_token_expired');

        if (!token || !tokenExpired || tokenExpired < Date.now()) {
          return;
        }

        const userCo = uniCloud.importObject('user-co');
        const res = await userCo.getProfile();

        if (res.code === 0 && res.data) {
          const userRole = res.data.user_role;
          if (userRole === 1) {
            uni.reLaunch({ url: '/pages/crew/index' });
          } else if (userRole === 2) {
            uni.reLaunch({ url: '/pages/actor/index' });
          } else {
            uni.reLaunch({ url: '/pages/index/index' });
          }
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
      }
    },

    // 微信一键登录（小程序）
    async wechatPhoneLogin(e) {
      if (e.detail.errMsg !== 'getPhoneNumber:ok') {
        uni.showToast({
          title: '需要授权手机号才能登录',
          icon: 'none'
        });
        return;
      }

      try {
        uni.showLoading({ title: '登录中...', mask: true });

        const uniIdCo = uniCloud.importObject("uni-id-co", {
          errorOptions: { type: 'toast' }
        });

        // 使用手机号快捷登录
        const result = await uniIdCo.loginByWeixinMobile({
          phoneCode: e.detail.code
        });

        uni.hideLoading();

        // 设置角色
        if (this.selectedRole) {
          try {
            const userCo = uniCloud.importObject('user-co');
            const role = this.selectedRole === 'crew' ? 1 : 2;
            await userCo.setRole(role);
          } catch (err) {
            console.log('角色设置跳过:', err.message);
          }
        }

        this.loginSuccess(result);

        // 跳转到首页
        setTimeout(() => {
          uni.reLaunch({ url: '/pages/index/index' });
        }, 500);

      } catch (error) {
        uni.hideLoading();
        console.error('微信登录失败:', error);
        uni.showToast({
          title: error.message || '登录失败，请重试',
          icon: 'none'
        });
      }
    },

    // 微信登录（非小程序）
    wechatLogin() {
      // #ifdef APP-PLUS
      uni.login({
        provider: 'weixin',
        success: async (loginRes) => {
          try {
            uni.showLoading({ title: '登录中...', mask: true });
            const uniIdCo = uniCloud.importObject("uni-id-co");
            const result = await uniIdCo.loginByWeixin({
              code: loginRes.code
            });
            uni.hideLoading();

            if (this.selectedRole) {
              try {
                const userCo = uniCloud.importObject('user-co');
                const role = this.selectedRole === 'crew' ? 1 : 2;
                await userCo.setRole(role);
              } catch (err) {
                console.log('角色设置跳过:', err.message);
              }
            }

            this.loginSuccess(result);
            setTimeout(() => {
              uni.reLaunch({ url: '/pages/index/index' });
            }, 500);
          } catch (error) {
            uni.hideLoading();
            uni.showToast({
              title: error.message || '登录失败',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          uni.showToast({
            title: '微信登录取消',
            icon: 'none'
          });
        }
      });
      // #endif

      // #ifdef H5
      uni.showToast({
        title: 'H5暂不支持微信登录，请使用验证码登录',
        icon: 'none'
      });
      // #endif
    },

    // 跳转验证码登录
    goToSmsLogin(agreed = false) {
      // 如果已经同意了就直接跳转，不再检查
      if (!agreed && this.$refs.agreements && !this.$refs.agreements.isAgree) {
        return this.$refs.agreements.popup(() => this.goToSmsLogin(true));
      }
      uni.navigateTo({
        url: '/uni_modules/uni-id-pages/pages/login/login-withoutpwd'
      });
    }
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%);
  position: relative;
  overflow: hidden;
}

// 背景装饰
.login-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;

  .bg-circle {
    position: absolute;
    border-radius: 50%;

    &.circle-1 {
      width: 500rpx;
      height: 500rpx;
      background: radial-gradient(circle, rgba(255, 215, 0, 0.15) 0%, transparent 70%);
      top: -100rpx;
      right: -100rpx;
    }

    &.circle-2 {
      width: 400rpx;
      height: 400rpx;
      background: radial-gradient(circle, rgba(41, 121, 255, 0.1) 0%, transparent 70%);
      bottom: 200rpx;
      left: -100rpx;
    }
  }
}

// 主内容
.login-content {
  position: relative;
  z-index: 1;
  padding: 120rpx 60rpx 60rpx;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  box-sizing: border-box;
}

// 头部Logo
.login-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 80rpx;

  .login-logo {
    width: 160rpx;
    height: 160rpx;
    margin-bottom: 32rpx;
    border-radius: 32rpx;
    background-color: rgba(255, 255, 255, 0.1);
  }

  .login-title {
    font-size: 56rpx;
    font-weight: bold;
    color: #FFD700;
    margin-bottom: 16rpx;
    letter-spacing: 4rpx;
  }

  .login-subtitle {
    font-size: 28rpx;
    color: rgba(255, 255, 255, 0.6);
  }
}

// 角色提示
.role-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 24rpx;
  background-color: rgba(255, 215, 0, 0.1);
  border-radius: 16rpx;
  margin-bottom: 60rpx;

  text {
    font-size: 26rpx;
    color: rgba(255, 255, 255, 0.8);
  }

  .role-text {
    color: #FFD700;
    font-weight: bold;
  }
}

// 登录按钮区
.login-buttons {
  display: flex;
  flex-direction: column;
  gap: 32rpx;

  .login-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20rpx;
    height: 100rpx;
    border-radius: 50rpx;
    font-size: 32rpx;
    font-weight: bold;
    border: none;
    transition: all 0.3s;

    &::after {
      border: none;
    }

    &:active {
      transform: scale(0.98);
      opacity: 0.9;
    }

    .btn-icon {
      width: 48rpx;
      height: 48rpx;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-text {
      color: #fff;
    }
  }

  // 微信登录按钮 - 绿色主色
  .wechat-btn {
    background: linear-gradient(135deg, #07C160 0%, #1AAD19 100%);
    box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.4);
  }

  // 验证码登录按钮 - 蓝色辅助色
  .sms-btn {
    background: linear-gradient(135deg, #2979FF 0%, #448AFF 100%);
    box-shadow: 0 8rpx 24rpx rgba(41, 121, 255, 0.4);
  }

}

// 协议区域
.agreement-section {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 60rpx;
}
</style>
