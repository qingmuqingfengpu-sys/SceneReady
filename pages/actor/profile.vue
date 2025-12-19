<template>
  <view class="profile-page">
    <!-- 用户信息头部 -->
    <view class="profile-header">
      <view class="user-info">
        <view class="avatar-section" @tap="editAvatar">
          <image class="user-avatar" :src="userInfo.avatar || '/static/default-avatar.png'" mode="aspectFill"></image>
          <view class="avatar-edit">
            <uni-icons type="camera" size="16" color="#fff"></uni-icons>
          </view>
        </view>
        <view class="user-detail">
          <text class="user-name">{{ userInfo.nickname || '演员' }}</text>
          <view class="user-tags">
            <text class="tag" v-if="userInfo.gender">{{ userInfo.gender === 1 ? '男' : '女' }}</text>
            <text class="tag" v-if="userInfo.height">{{ userInfo.height }}cm</text>
            <text class="tag" v-if="userInfo.body_type">{{ userInfo.body_type }}</text>
          </view>
        </view>
        <view class="edit-btn" @tap="goToEditProfile">
          <uni-icons type="compose" size="24" color="#FFD700"></uni-icons>
        </view>
      </view>

      <!-- 视频模卡预览 -->
      <view class="video-card-section" @tap="manageVideoCard">
        <view v-if="userInfo.video_card_url" class="video-preview">
          <video
            :src="userInfo.video_card_url"
            :controls="false"
            :show-play-btn="false"
            :autoplay="false"
            :muted="true"
            :loop="true"
            class="video-thumbnail"
            object-fit="cover"
          ></video>
          <view class="video-mask">
            <uni-icons type="videocam" size="32" color="#fff"></uni-icons>
            <text>视频模卡</text>
          </view>
        </view>
        <view v-else class="video-upload">
          <uni-icons type="plusempty" size="40" color="#FFD700"></uni-icons>
          <text>上传视频模卡</text>
          <text class="upload-hint">提升接单成功率</text>
        </view>
      </view>

      <!-- 信用分展示 -->
      <view class="credit-card">
        <view class="credit-left">
          <text class="credit-label">信用分</text>
          <view class="credit-score">
            <text class="score-value">{{ userInfo.credit_score_actor || 100 }}</text>
            <text class="score-max">/150</text>
          </view>
        </view>
        <view class="credit-right">
          <view :class="['credit-level', actorCreditLevelClass]">
            {{ actorCreditLevel }}
          </view>
        </view>
      </view>
    </view>

    <!-- 统计数据 -->
    <view class="stats-section">
      <view class="stat-item" @tap="goToOrders(1)">
        <text class="stat-value">{{ stats.ongoing }}</text>
        <text class="stat-label">进行中</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item" @tap="goToOrders(3)">
        <text class="stat-value">{{ stats.completed }}</text>
        <text class="stat-label">已完成</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">{{ stats.totalEarned }}</text>
        <text class="stat-label">总收入(元)</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">{{ stats.goodRate }}%</text>
        <text class="stat-label">好评率</text>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu-section">
      <view class="menu-group">
        <view class="menu-item" @tap="goToOrders()">
          <view class="menu-icon">
            <uni-icons type="list" size="24" color="#FFD700"></uni-icons>
          </view>
          <text class="menu-text">我的订单</text>
          <uni-icons type="forward" size="16" color="#666"></uni-icons>
        </view>

        <view class="menu-item" @tap="goToFavorites">
          <view class="menu-icon">
            <uni-icons type="heart" size="24" color="#FFD700"></uni-icons>
          </view>
          <text class="menu-text">收藏工作</text>
          <uni-icons type="forward" size="16" color="#666"></uni-icons>
        </view>

        <view class="menu-item" @tap="goToSkills">
          <view class="menu-icon">
            <uni-icons type="star" size="24" color="#FFD700"></uni-icons>
          </view>
          <text class="menu-text">我的特长</text>
          <view class="menu-tags">
            <text v-for="skill in (userInfo.skills || []).slice(0, 2)" :key="skill" class="mini-tag">{{ getSkillLabel(skill) }}</text>
            <text v-if="(userInfo.skills || []).length > 2" class="more-tag">+{{ userInfo.skills.length - 2 }}</text>
          </view>
          <uni-icons type="forward" size="16" color="#666"></uni-icons>
        </view>
      </view>

      <view class="menu-group">
        <view class="menu-item" @tap="goToVerification">
          <view class="menu-icon">
            <uni-icons type="auth" size="24" color="#FFD700"></uni-icons>
          </view>
          <text class="menu-text">身份认证</text>
          <view class="menu-status" :class="verificationStatus">
            {{ getVerificationText() }}
          </view>
          <uni-icons type="forward" size="16" color="#666"></uni-icons>
        </view>

        <view class="menu-item" @tap="goToCreditHistory">
          <view class="menu-icon">
            <uni-icons type="flag" size="24" color="#FFD700"></uni-icons>
          </view>
          <text class="menu-text">信用记录</text>
          <uni-icons type="forward" size="16" color="#666"></uni-icons>
        </view>

        <view class="menu-item" @tap="goToWallet">
          <view class="menu-icon">
            <uni-icons type="wallet" size="24" color="#FFD700"></uni-icons>
          </view>
          <text class="menu-text">我的钱包</text>
          <text class="menu-value">{{ walletBalance }}</text>
          <uni-icons type="forward" size="16" color="#666"></uni-icons>
        </view>
      </view>

      <view class="menu-group">
        <view class="menu-item" @tap="goToSettings">
          <view class="menu-icon">
            <uni-icons type="gear" size="24" color="#FFD700"></uni-icons>
          </view>
          <text class="menu-text">设置</text>
          <uni-icons type="forward" size="16" color="#666"></uni-icons>
        </view>

        <view class="menu-item" @tap="goToHelp">
          <view class="menu-icon">
            <uni-icons type="help" size="24" color="#FFD700"></uni-icons>
          </view>
          <text class="menu-text">帮助与反馈</text>
          <uni-icons type="forward" size="16" color="#666"></uni-icons>
        </view>

        <view class="menu-item" @tap="goToAbout">
          <view class="menu-icon">
            <uni-icons type="info" size="24" color="#FFD700"></uni-icons>
          </view>
          <text class="menu-text">关于我们</text>
          <uni-icons type="forward" size="16" color="#666"></uni-icons>
        </view>
      </view>
    </view>

    <!-- 切换角色 -->
    <view class="switch-role-section">
      <button class="switch-role-btn" @tap="switchToCrew">
        <uni-icons type="refreshempty" size="20" color="#2979FF"></uni-icons>
        <text>切换到剧组端</text>
      </button>
    </view>

    <!-- 退出登录 -->
    <view class="logout-section">
      <button class="logout-btn" @tap="logout">退出登录</button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      userInfo: {},
      stats: {
        ongoing: 0,
        completed: 0,
        totalEarned: 0,
        goodRate: 100
      },
      verificationStatus: 'none',
      walletBalance: '0.00',
      skillMap: {
        'driving': '开车',
        'dancing': '跳舞',
        'singing': '唱歌',
        'martial_arts': '武术',
        'swimming': '游泳',
        'riding': '骑马',
        'instrument': '乐器',
        'language': '外语'
      }
    }
  },

  computed: {
    actorCreditLevelClass() {
      const score = this.userInfo.credit_score_actor || 100
      if (score >= 130) return 'level-gold'
      if (score >= 110) return 'level-silver'
      return 'level-normal'
    },
    actorCreditLevel() {
      return this.getCreditLevel(this.userInfo.credit_score_actor)
    }
  },

  onLoad() {
    this.loadUserInfo()
    this.loadStats()
  },

  onShow() {
    this.loadUserInfo()
    this.loadStats()
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadUserInfo(),
      this.loadStats()
    ]).finally(() => {
      uni.stopPullDownRefresh()
    })
  },

  methods: {
    async loadUserInfo() {
      try {
        const userInfo = uni.getStorageSync('uni-id-pages-userInfo')
        if (userInfo) {
          this.userInfo = userInfo
        }

        const cloudUserInfo = await uniCloud.getCurrentUserInfo()
        if (cloudUserInfo && cloudUserInfo.uid) {
          const db = uniCloud.database()
          const res = await db.collection('uni-id-users').doc(cloudUserInfo.uid).field({
            nickname: true,
            avatar: true,
            gender: true,
            height: true,
            body_type: true,
            skills: true,
            video_card_url: true,
            credit_score_actor: true,
            verification_status: true,
            wallet_balance: true
          }).get()

          if (res.result.data && res.result.data.length > 0) {
            this.userInfo = { ...this.userInfo, ...res.result.data[0] }
            this.verificationStatus = res.result.data[0].verification_status || 'none'
            this.walletBalance = ((res.result.data[0].wallet_balance || 0) / 100).toFixed(2)
          }
        }
      } catch (error) {
        console.error('加载用户信息失败:', error)
      }
    },

    async loadStats() {
      try {
        const token = uni.getStorageSync('uni_id_token')
        if (!token) return

        const db = uniCloud.database()
        const userInfo = await uniCloud.getCurrentUserInfo()
        const userId = userInfo.uid

        if (!userId) return

        const [ongoingRes, completedRes] = await Promise.all([
          db.collection('orders').where({ receiver_id: userId, order_status: 1 }).count(),
          db.collection('orders').where({ receiver_id: userId, order_status: 3 }).count()
        ])

        this.stats = {
          ongoing: ongoingRes.total,
          completed: completedRes.total,
          totalEarned: 0, // TODO: 计算总收入
          goodRate: 100 // TODO: 计算好评率
        }
      } catch (error) {
        console.error('加载统计失败:', error)
      }
    },

    getCreditLevel(score) {
      if (score >= 130) return '金牌演员'
      if (score >= 110) return '优质演员'
      if (score >= 90) return '良好'
      return '普通'
    },

    getCreditLevelClass(score) {
      if (score >= 130) return 'level-gold'
      if (score >= 110) return 'level-silver'
      return 'level-normal'
    },

    getVerificationText() {
      const textMap = {
        'none': '未认证',
        'pending': '审核中',
        'verified': '已认证'
      }
      return textMap[this.verificationStatus] || '未认证'
    },

    getSkillLabel(skill) {
      return this.skillMap[skill] || skill
    },

    editAvatar() {
      uni.navigateTo({
        url: '/uni_modules/uni-id-pages/pages/userinfo/userinfo'
      })
    },

    goToEditProfile() {
      uni.navigateTo({
        url: '/uni_modules/uni-id-pages/pages/userinfo/userinfo'
      })
    },

    manageVideoCard() {
      // TODO: 视频模卡管理
      uni.showActionSheet({
        itemList: this.userInfo.video_card_url ? ['重新录制', '删除视频'] : ['录制视频'],
        success: (res) => {
          if (res.tapIndex === 0) {
            // 录制/重新录制
            uni.showToast({
              title: '功能开发中',
              icon: 'none'
            })
          } else if (res.tapIndex === 1) {
            // 删除视频
            uni.showToast({
              title: '功能开发中',
              icon: 'none'
            })
          }
        }
      })
    },

    goToOrders(status) {
      let url = '/pages/actor/my_orders'
      if (status !== undefined) {
        url += `?status=${status}`
      }
      uni.navigateTo({ url })
    },

    goToFavorites() {
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    goToSkills() {
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    goToVerification() {
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    goToCreditHistory() {
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    goToWallet() {
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    goToSettings() {
      uni.navigateTo({
        url: '/uni_modules/uni-id-pages/pages/userinfo/userinfo?showLoginManage=true'
      })
    },

    goToHelp() {
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    goToAbout() {
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    switchToCrew() {
      uni.reLaunch({
        url: '/pages/crew/index'
      })
    },

    logout() {
      uni.showModal({
        title: '退出登录',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            uni.removeStorageSync('uni_id_token')
            uni.removeStorageSync('uni_id_token_expired')
            uni.removeStorageSync('uni-id-pages-userInfo')

            uni.reLaunch({
              url: '/pages/index/index'
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

.profile-page {
  min-height: 100vh;
  background-color: $bg-primary;
  padding-bottom: env(safe-area-inset-bottom);
}

// 用户信息头部
.profile-header {
  background: linear-gradient(180deg, $bg-secondary 0%, $bg-primary 100%);
  padding: $spacing-lg;
}

.user-info {
  display: flex;
  align-items: center;
  gap: $spacing-base;
  margin-bottom: $spacing-lg;

  .avatar-section {
    position: relative;

    .user-avatar {
      width: 120rpx;
      height: 120rpx;
      border-radius: 50%;
      background-color: $gray-4;
      border: 4rpx solid $primary-color;
    }

    .avatar-edit {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 40rpx;
      height: 40rpx;
      background-color: $primary-color;
      border-radius: 50%;
      @include flex-center;
    }
  }

  .user-detail {
    flex: 1;
    @include flex-column;
    gap: 8rpx;

    .user-name {
      font-size: $font-size-xl;
      font-weight: $font-weight-bold;
      color: $text-primary;
    }

    .user-tags {
      display: flex;
      gap: 8rpx;

      .tag {
        padding: 4rpx 12rpx;
        background-color: $bg-tertiary;
        border-radius: $border-radius-sm;
        font-size: $font-size-xs;
        color: $text-secondary;
      }
    }
  }

  .edit-btn {
    padding: $spacing-sm;
  }
}

// 视频模卡区域
.video-card-section {
  margin-bottom: $spacing-lg;
  border-radius: $border-radius-base;
  overflow: hidden;

  .video-preview {
    position: relative;
    height: 200rpx;

    .video-thumbnail {
      width: 100%;
      height: 100%;
    }

    .video-mask {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      top: 0;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
      @include flex-center;
      @include flex-column;
      gap: 8rpx;

      text {
        font-size: $font-size-sm;
        color: $white;
      }
    }
  }

  .video-upload {
    height: 200rpx;
    background-color: $bg-tertiary;
    border: 2rpx dashed $gray-4;
    border-radius: $border-radius-base;
    @include flex-center;
    @include flex-column;
    gap: 8rpx;

    text {
      font-size: $font-size-base;
      color: $text-secondary;
    }

    .upload-hint {
      font-size: $font-size-xs;
      color: $text-hint;
    }
  }
}

// 信用分卡片
.credit-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba($primary-color, 0.2) 0%, rgba($secondary-color, 0.1) 100%);
  border-radius: $border-radius-base;
  padding: $spacing-base $spacing-lg;

  .credit-left {
    @include flex-column;
    gap: 8rpx;

    .credit-label {
      font-size: $font-size-sm;
      color: $text-secondary;
    }

    .credit-score {
      display: flex;
      align-items: baseline;

      .score-value {
        font-size: 48rpx;
        font-weight: $font-weight-bold;
        color: $primary-color;
        font-family: $font-family-monospace;
      }

      .score-max {
        font-size: $font-size-sm;
        color: $text-secondary;
      }
    }
  }

  .credit-right {
    .credit-level {
      padding: 8rpx 20rpx;
      border-radius: $border-radius-sm;
      font-size: $font-size-sm;
      font-weight: $font-weight-bold;

      &.level-gold {
        @include credit-badge('gold');
      }

      &.level-silver {
        @include credit-badge('silver');
      }

      &.level-normal {
        @include credit-badge('normal');
      }
    }
  }
}

// 统计数据
.stats-section {
  display: flex;
  background-color: $bg-secondary;
  margin: $spacing-base;
  border-radius: $border-radius-base;
  padding: $spacing-lg 0;

  .stat-item {
    flex: 1;
    @include flex-center;
    @include flex-column;
    gap: 8rpx;

    &:active {
      opacity: 0.8;
    }

    .stat-value {
      font-size: 40rpx;
      font-weight: $font-weight-bold;
      color: $primary-color;
      font-family: $font-family-monospace;
    }

    .stat-label {
      font-size: $font-size-xs;
      color: $text-secondary;
    }
  }

  .stat-divider {
    width: 1rpx;
    height: 60rpx;
    background-color: rgba(255, 255, 255, 0.1);
    align-self: center;
  }
}

// 菜单区域
.menu-section {
  padding: 0 $spacing-base;
}

.menu-group {
  background-color: $bg-secondary;
  border-radius: $border-radius-base;
  margin-bottom: $spacing-base;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: $spacing-base $spacing-lg;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);

  &:last-child {
    border-bottom: none;
  }

  &:active {
    background-color: $bg-tertiary;
  }

  .menu-icon {
    width: 48rpx;
    height: 48rpx;
    @include flex-center;
    margin-right: $spacing-base;
  }

  .menu-text {
    flex: 1;
    font-size: $font-size-base;
    color: $text-primary;
  }

  .menu-status {
    font-size: $font-size-sm;
    margin-right: $spacing-sm;

    &.none {
      color: $text-secondary;
    }

    &.pending {
      color: $warning-color;
    }

    &.verified {
      color: $success-color;
    }
  }

  .menu-value {
    font-size: $font-size-base;
    color: $primary-color;
    font-family: $font-family-monospace;
    margin-right: $spacing-sm;
  }

  .menu-tags {
    display: flex;
    gap: 8rpx;
    margin-right: $spacing-sm;

    .mini-tag {
      padding: 4rpx 12rpx;
      background-color: rgba($primary-color, 0.15);
      border-radius: $border-radius-sm;
      font-size: $font-size-xs;
      color: $primary-color;
    }

    .more-tag {
      padding: 4rpx 12rpx;
      background-color: $bg-tertiary;
      border-radius: $border-radius-sm;
      font-size: $font-size-xs;
      color: $text-secondary;
    }
  }
}

// 切换角色
.switch-role-section {
  padding: $spacing-lg $spacing-base;

  .switch-role-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-sm;
    height: 88rpx;
    background-color: transparent;
    border: 2rpx solid $secondary-color;
    border-radius: $border-radius-base;
    color: $secondary-color;
    font-size: $font-size-base;

    &:active {
      opacity: 0.8;
    }
  }
}

// 退出登录
.logout-section {
  padding: 0 $spacing-base $spacing-xl;

  .logout-btn {
    height: 88rpx;
    background-color: transparent;
    border: 2rpx solid $alert-color;
    border-radius: $border-radius-base;
    color: $alert-color;
    font-size: $font-size-base;

    &:active {
      background-color: rgba($alert-color, 0.1);
    }
  }
}
</style>
