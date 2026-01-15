<template>
  <view class="settings-page">
    <view class="card">
      <view class="setting-row">
        <view class="text-wrap">
          <text class="title">外观模式</text>
          <text class="desc">白天（白底黑字） / 夜间（黑底白字）</text>
        </view>
        <switch
          :checked="theme === 'dark'"
          @change="onToggle"
          color="#FFD700"
        />
      </view>
    </view>

    <view class="hint">
      当前：{{ theme === 'light' ? '白天模式' : '夜间模式' }}
    </view>

    <!-- 账号与安全 -->
    <view class="section-title">账号与安全</view>
    <view class="card">
      <view class="menu-item" @tap="goToDeactivate">
        <view class="menu-left">
          <uni-icons type="closeempty" size="24" color="#FF5252"></uni-icons>
          <text class="menu-text">注销账号</text>
        </view>
        <uni-icons type="forward" size="16" color="#999"></uni-icons>
      </view>
    </view>
  </view>
</template>

<script>
import { getTheme, setTheme } from '@/common/theme.js'

export default {
  data() {
    return {
      theme: getTheme()
    }
  },

  onShow() {
    this.theme = getTheme()
  },

  methods: {
    onToggle(e) {
      const next = e.detail.value ? 'dark' : 'light'
      this.theme = setTheme(next)
      uni.showToast({
        title: this.theme === 'light' ? '已切换到白天模式' : '已切换到夜间模式',
        icon: 'none'
      })
    },

    goToDeactivate() {
      uni.showModal({
        title: '注销账号',
        content: '注销账号是不可逆操作，所有数据将被清除。确定要继续吗？',
        confirmText: '继续',
        cancelText: '取消',
        confirmColor: '#FF5252',
        success: (res) => {
          if (res.confirm) {
            uni.navigateTo({
              url: '/uni_modules/uni-id-pages/pages/userinfo/deactivate/deactivate'
            })
          }
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.settings-page {
  min-height: 100vh;
  background-color: $bg-primary;
  padding: $spacing-base;
  color: $text-primary;
}

.card {
  @include card;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-base;
}

.text-wrap {
  display: flex;
  flex-direction: column;
  gap: 6rpx;

  .title {
    font-size: $font-size-lg;
    font-weight: $font-weight-bold;
    color: $text-primary;
  }

  .desc {
    font-size: $font-size-sm;
    color: $text-secondary;
  }
}

.hint {
  margin-top: $spacing-base;
  font-size: $font-size-sm;
  color: $text-secondary;
}

.section-title {
  margin-top: $spacing-xl;
  margin-bottom: $spacing-base;
  font-size: $font-size-base;
  font-weight: $font-weight-bold;
  color: $text-secondary;
  padding-left: $spacing-sm;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-base 0;
  cursor: pointer;
  transition: background-color 0.3s;

  &:active {
    background-color: $bg-tertiary;
  }

  .menu-left {
    display: flex;
    align-items: center;
    gap: $spacing-sm;

    .menu-text {
      font-size: $font-size-base;
      color: $text-primary;
    }
  }
}
</style>
