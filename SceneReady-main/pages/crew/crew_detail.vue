<template>
  <view class="crew-detail-page">
    <!-- 加载状态 -->
    <view v-if="loading" class="loading-container">
      <uni-load-more status="loading" :content-text="loadingText"></uni-load-more>
    </view>

    <!-- 剧组信息 -->
    <view v-else-if="crewInfo" class="crew-content">
      <!-- 头部信息卡片 -->
      <view class="header-card">
        <view class="avatar-section">
          <image class="avatar" :src="displayAvatar" mode="aspectFill"></image>
          <view v-if="crewInfo.is_enterprise_auth" class="verified-badge">
            <uni-icons type="auth" size="16" color="#4CAF50"></uni-icons>
          </view>
        </view>
        <view class="basic-info">
          <view class="name-row">
            <text class="nickname">{{ crewInfo.nickname || '剧组' }}</text>
            <view class="credit-badge" :class="creditClass">
              {{ crewInfo.credit_score_crew || 100 }}
            </view>
          </view>
          <view class="role-tag">
            <uni-icons type="vip" size="14" color="#FFD700"></uni-icons>
            <text>剧组端</text>
          </view>
          <view class="auth-status">
            <uni-icons :type="crewInfo.is_enterprise_auth ? 'auth' : 'info'" size="14" :color="crewInfo.is_enterprise_auth ? '#4CAF50' : '#999'"></uni-icons>
            <text :class="crewInfo.is_enterprise_auth ? 'verified' : 'unverified'">
              {{ crewInfo.is_enterprise_auth ? '已企业认证' : '未企业认证' }}
            </text>
          </view>
        </view>
      </view>

      <!-- 联系方式 -->
      <view class="info-card">
        <view class="card-title">
          <uni-icons type="phone" size="20" color="#FFD700"></uni-icons>
          <text>联系方式</text>
        </view>
        <view class="card-content">
          <view class="contact-row" v-if="crewInfo.mobile">
            <text class="contact-label">手机号</text>
            <view class="contact-value-wrap">
              <text class="contact-value">{{ crewInfo.mobile }}</text>
              <view class="copy-btn" @tap="copyText(crewInfo.mobile, '手机号')">
                <uni-icons type="copy" size="16" color="#FFD700"></uni-icons>
              </view>
            </view>
          </view>
          <view class="contact-row" v-if="crewInfo.wechat_id">
            <text class="contact-label">微信号</text>
            <view class="contact-value-wrap">
              <text class="contact-value">{{ crewInfo.wechat_id }}</text>
              <view class="copy-btn" @tap="copyText(crewInfo.wechat_id, '微信号')">
                <uni-icons type="copy" size="16" color="#FFD700"></uni-icons>
              </view>
            </view>
          </view>
          <view v-if="!crewInfo.mobile && !crewInfo.wechat_id" class="no-contact">
            <text>暂无联系方式</text>
          </view>
        </view>
      </view>

      <!-- 详细信息 -->
      <view class="info-card">
        <view class="card-title">
          <uni-icons type="bars" size="20" color="#FFD700"></uni-icons>
          <text>详细信息</text>
        </view>
        <view class="card-content">
          <view class="detail-row">
            <text class="detail-label">信用分</text>
            <text class="detail-value credit" :class="creditClass">{{ crewInfo.credit_score_crew || 100 }}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">企业认证</text>
            <text class="detail-value" :class="crewInfo.is_enterprise_auth ? 'verified' : 'unverified'">
              {{ crewInfo.is_enterprise_auth ? '已认证' : '未认证' }}
            </text>
          </view>
          <view class="detail-row" v-if="crewInfo.enterprise_auth && crewInfo.enterprise_auth.enterprise_name">
            <text class="detail-label">企业名称</text>
            <text class="detail-value">{{ crewInfo.enterprise_auth.enterprise_name }}</text>
          </view>
        </view>
      </view>

      <!-- 剧组介绍图片 -->
      <view class="info-card" v-if="introImages.length > 0">
        <view class="card-title">
          <uni-icons type="image" size="20" color="#FFD700"></uni-icons>
          <text>剧组介绍</text>
          <text class="card-count">{{ introImages.length }}张</text>
        </view>
        <view class="card-content">
          <view class="intro-images-grid">
            <view class="intro-image-item" v-for="(img, index) in introImages" :key="index" @tap="previewImage(index)">
              <image :src="img.url" mode="aspectFill" class="intro-image"></image>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="empty-container">
      <uni-icons type="info" size="64" color="#999"></uni-icons>
      <text class="empty-text">剧组信息不存在</text>
      <button class="btn-primary" @tap="goBack">返回</button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      crewId: '',
      crewInfo: null,
      loading: true,
      loadingText: {
        contentdown: '加载中...',
        contentrefresh: '加载中...',
        contentnomore: '加载中...'
      }
    }
  },

  computed: {
    displayAvatar() {
      if (!this.crewInfo) return '/static/default-crew.png'
      const avatarFile = this.crewInfo.avatar_file
      const avatarFileUrl = avatarFile && avatarFile.url ? avatarFile.url : null
      return avatarFileUrl || this.crewInfo.avatar || '/static/default-crew.png'
    },
    creditClass() {
      const score = this.crewInfo ? this.crewInfo.credit_score_crew || 100 : 100
      if (score >= 130) return 'credit-gold'
      if (score >= 110) return 'credit-silver'
      return 'credit-normal'
    },
    introImages() {
      if (!this.crewInfo || !this.crewInfo.crew_introduction_images) return []
      return this.crewInfo.crew_introduction_images.filter(img => img && img.url)
    }
  },

  onLoad(options) {
    if (options.id) {
      this.crewId = options.id
      this.loadCrewInfo()
    } else {
      this.loading = false
    }
  },

  onPullDownRefresh() {
    this.loadCrewInfo()
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 1000)
  },

  methods: {
    async loadCrewInfo() {
      try {
        this.loading = true
        const db = uniCloud.database()
        const res = await db.collection('uni-id-users')
          .doc(this.crewId)
          .field({
            nickname: true,
            avatar: true,
            avatar_file: true,
            mobile: true,
            wechat_id: true,
            credit_score_crew: true,
            is_enterprise_auth: true,
            enterprise_auth: true,
            crew_introduction_images: true
          })
          .get()

        if (res.result.data && res.result.data.length > 0) {
          this.crewInfo = res.result.data[0]
        }
      } catch (error) {
        console.error('加载剧组信息失败:', error)
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    },

    copyText(text, label) {
      uni.setClipboardData({
        data: text,
        success: () => {
          uni.showToast({
            title: `${label}已复制`,
            icon: 'success'
          })
        }
      })
    },

    previewImage(index) {
      const urls = this.introImages.map(img => img.url)
      uni.previewImage({
        urls: urls,
        current: index
      })
    },

    goBack() {
      uni.navigateBack()
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.crew-detail-page {
  min-height: 100vh;
  background-color: $bg-primary;
  display: flex;
  flex-direction: column;
}

.loading-container {
  @include flex-center;
  min-height: 60vh;
}

.crew-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: $spacing-base;
  padding-bottom: env(safe-area-inset-bottom);
}

// 头部卡片
.header-card {
  display: flex;
  align-items: flex-start;
  gap: $spacing-lg;
  background-color: $bg-secondary;
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
  margin-bottom: $spacing-base;

  .avatar-section {
    position: relative;
    flex-shrink: 0;

    .avatar {
      width: 160rpx;
      height: 160rpx;
      border-radius: 50%;
      background-color: $gray-4;
      border: 4rpx solid $primary-color;
    }

    .verified-badge {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 40rpx;
      height: 40rpx;
      background-color: $white;
      border-radius: 50%;
      @include flex-center;
    }
  }

  .basic-info {
    flex: 1;
    @include flex-column;
    gap: 12rpx;

    .name-row {
      display: flex;
      align-items: center;
      gap: $spacing-sm;

      .nickname {
        font-size: $font-size-xl;
        font-weight: $font-weight-bold;
        color: $text-primary;
      }

      .credit-badge {
        padding: 4rpx 12rpx;
        border-radius: $border-radius-sm;
        font-size: $font-size-sm;
        font-weight: $font-weight-bold;

        &.credit-gold {
          @include credit-badge('gold');
        }

        &.credit-silver {
          @include credit-badge('silver');
        }

        &.credit-normal {
          @include credit-badge('normal');
        }
      }
    }

    .role-tag {
      display: flex;
      align-items: center;
      gap: 6rpx;

      text {
        font-size: $font-size-sm;
        color: $primary-color;
      }
    }

    .auth-status {
      display: flex;
      align-items: center;
      gap: 6rpx;

      text {
        font-size: $font-size-sm;

        &.verified {
          color: $success-color;
        }

        &.unverified {
          color: $text-hint;
        }
      }
    }
  }
}

// 信息卡片
.info-card {
  @include card;
  margin-bottom: $spacing-base;

  .card-title {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin-bottom: $spacing-base;
    padding-bottom: $spacing-sm;
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);

    text {
      font-size: $font-size-lg;
      font-weight: $font-weight-bold;
      color: $text-primary;
    }

    .card-count {
      margin-left: auto;
      padding: 4rpx 16rpx;
      background-color: rgba($primary-color, 0.2);
      border-radius: 20rpx;
      font-size: $font-size-sm;
      font-weight: $font-weight-bold;
      color: $primary-color;
    }
  }
}

// 联系方式
.contact-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);

  &:last-child {
    border-bottom: none;
  }

  .contact-label {
    font-size: $font-size-sm;
    color: $text-secondary;
  }

  .contact-value-wrap {
    display: flex;
    align-items: center;
    gap: $spacing-sm;

    .contact-value {
      font-size: $font-size-base;
      color: $text-primary;
      font-family: $font-family-monospace;
    }

    .copy-btn {
      padding: 8rpx;
      background-color: rgba($primary-color, 0.15);
      border-radius: $border-radius-sm;

      &:active {
        opacity: 0.7;
      }
    }
  }
}

.no-contact {
  text-align: center;
  padding: $spacing-lg;

  text {
    font-size: $font-size-sm;
    color: $text-hint;
  }
}

// 详细信息
.detail-row {
  display: flex;
  align-items: flex-start;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);

  &:last-child {
    border-bottom: none;
  }

  .detail-label {
    width: 140rpx;
    font-size: $font-size-sm;
    color: $text-secondary;
    flex-shrink: 0;
  }

  .detail-value {
    flex: 1;
    font-size: $font-size-base;
    color: $text-primary;

    &.verified {
      color: $success-color;
    }

    &.unverified {
      color: $text-hint;
    }

    &.credit {
      font-weight: $font-weight-bold;

      &.credit-gold {
        color: #FFD700;
      }

      &.credit-silver {
        color: #C0C0C0;
      }

      &.credit-normal {
        color: $text-primary;
      }
    }
  }
}

// 剧组介绍图片
.intro-images-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-sm;

  .intro-image-item {
    aspect-ratio: 1;
    border-radius: $border-radius-base;
    overflow: hidden;
    background-color: $bg-tertiary;

    &:active {
      opacity: 0.8;
    }

    .intro-image {
      width: 100%;
      height: 100%;
    }
  }
}

// 空状态
.empty-container {
  @include flex-center;
  @include flex-column;
  min-height: 60vh;
  gap: $spacing-lg;

  .empty-text {
    font-size: $font-size-lg;
    color: $text-secondary;
  }

  .btn-primary {
    @include button-primary;
    margin-top: $spacing-base;
  }
}
</style>
