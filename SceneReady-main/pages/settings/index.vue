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
</style>
