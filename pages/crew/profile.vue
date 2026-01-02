<template>
  <view class="profile-page">
    <!-- 用户信息卡片 -->
    <view class="profile-header">
      <view class="user-info">
        <image class="user-avatar" :src="displayAvatar" mode="aspectFill" @tap="editAvatar"></image>
        <view class="user-detail">
          <text class="user-name">{{ userInfo.nickname || '剧组名称' }}</text>
          <view class="user-role">
            <uni-icons type="vip" size="16" color="#FFD700"></uni-icons>
            <text class="role-text">剧组端</text>
          </view>
        </view>
        <view class="edit-btn" @tap="goToEditProfile">
          <uni-icons type="compose" size="24" color="#FFD700"></uni-icons>
        </view>
      </view>

      <!-- 信用分展示 -->
      <view class="credit-card">
        <view class="credit-left">
          <text class="credit-label">信用分</text>
          <view class="credit-score">
            <text class="score-value">{{ userInfo.credit_score_crew || 100 }}</text>
            <text class="score-max">/150</text>
          </view>
        </view>
        <view class="credit-right">
          <view :class="['credit-level', crewCreditLevelClass]">
            {{ crewCreditLevel }}
          </view>
        </view>
      </view>
    </view>

    <!-- 统计数据 -->
    <view class="stats-section">
      <view class="stat-item" @tap="goToOrderList(0)">
        <text class="stat-value">{{ stats.pending }}</text>
        <text class="stat-label">待接单</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item" @tap="goToOrderList(1)">
        <text class="stat-value">{{ stats.ongoing }}</text>
        <text class="stat-label">进行中</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item" @tap="goToOrderList(3)">
        <text class="stat-value">{{ stats.completed }}</text>
        <text class="stat-label">已完成</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">{{ stats.totalSpent }}</text>
        <text class="stat-label">总支出(元)</text>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu-section">
      <view class="menu-group">
        <view class="menu-item" @tap="goToOrderList()">
          <view class="menu-icon">
            <uni-icons type="list" size="24" color="#FFD700"></uni-icons>
          </view>
          <text class="menu-text">我的订单</text>
          <uni-icons type="forward" size="16" color="#666"></uni-icons>
        </view>

        <view class="menu-item" @tap="goToPostOrder">
          <view class="menu-icon">
            <uni-icons type="plusempty" size="24" color="#FFD700"></uni-icons>
          </view>
          <text class="menu-text">发布需求</text>
          <uni-icons type="forward" size="16" color="#666"></uni-icons>
        </view>

        <view class="menu-item" @tap="goToFavorites">
          <view class="menu-icon">
            <uni-icons type="heart" size="24" color="#FFD700"></uni-icons>
          </view>
          <text class="menu-text">收藏演员</text>
          <view class="menu-badge" v-if="favoriteCount > 0">{{ favoriteCount }}</view>
          <uni-icons type="forward" size="16" color="#666"></uni-icons>
        </view>
      </view>

      <view class="menu-group">
        <view class="menu-item" @tap="goToVerification">
          <view class="menu-icon">
            <uni-icons type="auth" size="24" color="#FFD700"></uni-icons>
          </view>
          <text class="menu-text">企业认证</text>
          <view class="menu-status" :class="verificationStatus">
            {{ getVerificationText() }}
          </view>
          <uni-icons type="forward" size="16" color="#666"></uni-icons>
        </view>

        <view class="menu-item" @tap="goToCreditHistory">
          <view class="menu-icon">
            <uni-icons type="star" size="24" color="#FFD700"></uni-icons>
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
      <button class="switch-role-btn" @tap="switchToActor">
        <uni-icons type="refreshempty" size="20" color="#2979FF"></uni-icons>
        <text>切换到演员端</text>
      </button>
    </view>

    <!-- 退出登录 -->
    <view class="logout-section">
      <button class="logout-btn" @tap="logout">退出登录</button>
    </view>

    <!-- 底部 TabBar -->
    <custom-tabbar role="crew" :current="2" @refresh="loadUserInfo"></custom-tabbar>
  </view>
</template>

<script>
export default {
  data() {
    return {
      userInfo: {},
      stats: {
        pending: 0,
        ongoing: 0,
        completed: 0,
        totalSpent: 0
      },
      favoriteCount: 0,
      verificationStatus: 'none', // none, pending, verified
      walletBalance: '0.00'
    }
  },

  computed: {
    displayAvatar() {
      const avatarFile = this.userInfo.avatar_file
      const avatarFileUrl = avatarFile && avatarFile.url ? avatarFile.url : null
      return avatarFileUrl || this.userInfo.wx_avatar || this.userInfo.avatar || '/static/default-crew.png'
    },
    crewCreditLevelClass() {
      const score = this.userInfo.credit_score_crew || 100
      if (score >= 130) return 'level-gold'
      if (score >= 110) return 'level-silver'
      return 'level-normal'
    },
    crewCreditLevel() {
      return this.getCreditLevel(this.userInfo.credit_score_crew)
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

        // 从云端获取最新用户信息
        const cloudUserInfo = await uniCloud.getCurrentUserInfo()
        if (cloudUserInfo && cloudUserInfo.uid) {
          const db = uniCloud.database()
          const res = await db.collection('uni-id-users').doc(cloudUserInfo.uid).field({
            nickname: true,
            avatar: true,
            avatar_file: true,
            wx_avatar: true,
            credit_score_crew: true,
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

        const [pendingRes, ongoingRes, completedRes] = await Promise.all([
          db.collection('orders').where({ publisher_id: userId, order_status: 0 }).count(),
          db.collection('orders').where({ publisher_id: userId, order_status: 1 }).count(),
          db.collection('orders').where({ publisher_id: userId, order_status: 3 }).count()
        ])

        this.stats = {
          pending: pendingRes.total,
          ongoing: ongoingRes.total,
          completed: completedRes.total,
          totalSpent: 0 // TODO: 计算总支出
        }
      } catch (error) {
        console.error('加载统计失败:', error)
      }
    },

    getCreditLevel(score) {
      if (score >= 130) return '金牌剧组'
      if (score >= 110) return '优质剧组'
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

    goToOrderList(status) {
      let url = '/pages/crew/order_list'
      if (status !== undefined) {
        url += `?status=${status}`
      }
      uni.navigateTo({ url })
    },

    goToPostOrder() {
      uni.navigateTo({
        url: '/pages/crew/post_order'
      })
    },

    goToFavorites() {
      // TODO: 收藏演员页面
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    goToVerification() {
      // TODO: 企业认证页面
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    goToCreditHistory() {
      // TODO: 信用记录页面
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    goToWallet() {
      // TODO: 钱包页面
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
      // TODO: 帮助页面
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    goToAbout() {
      // TODO: 关于页面
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    switchToActor() {
      uni.reLaunch({
        url: '/pages/actor/index'
      })
    },

    logout() {
      uni.showModal({
        title: '退出登录',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            // 清除登录信息
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
  padding-bottom: 120rpx; // TabBar 空间
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

  .user-avatar {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    background-color: $gray-4;
    border: 4rpx solid $primary-color;
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

    .user-role {
      display: flex;
      align-items: center;
      gap: 8rpx;

      .role-text {
        font-size: $font-size-sm;
        color: $primary-color;
      }
    }
  }

  .edit-btn {
    padding: $spacing-sm;
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

  .menu-badge {
    min-width: 36rpx;
    height: 36rpx;
    padding: 0 12rpx;
    background-color: $alert-color;
    border-radius: 18rpx;
    font-size: $font-size-xs;
    color: $white;
    @include flex-center;
    margin-right: $spacing-sm;
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
