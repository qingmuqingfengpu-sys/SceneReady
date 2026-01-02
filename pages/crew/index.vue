<template>
  <view class="crew-home-map">
    <!-- 地图层 -->
    <map
      id="crewMap"
      class="map-layer"
      :latitude="mapCenter.latitude"
      :longitude="mapCenter.longitude"
      :scale="mapScale"
      :markers="actorMarkers"
      :show-location="true"
      @markertap="onMarkerTap"
      @regionchange="onRegionChange"
    >
    </map>

    <!-- 底部抽屉 -->
    <view
      class="drawer-container"
      :style="{ height: drawerHeight + 'rpx' }"
      @touchstart="onDrawerTouchStart"
      @touchmove.stop.prevent="onDrawerTouchMove"
      @touchend="onDrawerTouchEnd"
    >
      <!-- 抽屉把手 -->
      <view class="drawer-handle-area">
        <view class="drawer-handle"></view>
      </view>

      <!-- 抽屉内容 -->
      <scroll-view
        scroll-y
        class="drawer-content"
        :style="{ height: (drawerHeight - 60) + 'rpx' }"
      >
        <!-- 搜索栏 -->
        <view class="search-bar">
          <uni-icons type="search" size="20" color="#999"></uni-icons>
          <input
            class="search-input"
            placeholder="搜索演员"
            placeholder-class="search-placeholder"
            v-model="searchKeyword"
            @input="onSearchInput"
          />
          <view v-if="searchKeyword" class="search-clear" @tap="clearSearch">
            <uni-icons type="close" size="16" color="#999"></uni-icons>
          </view>
        </view>

        <!-- 搜索结果列表 -->
        <view v-if="searchKeyword && searchResults.length > 0" class="search-results">
          <view class="section-header-compact">
            <text class="section-title-text">搜索结果</text>
            <text class="result-count">{{ searchResults.length }}人</text>
          </view>
          <view class="search-list">
            <view
              v-for="actor in searchResults"
              :key="actor.id"
              class="search-item"
              @tap="showActorDetail(actor)"
            >
              <image class="actor-avatar" :src="actor.avatar || '/static/default-avatar.png'" mode="aspectFill"></image>
              <view class="actor-info">
                <view class="actor-name">{{ actor.nickname }}</view>
                <view class="actor-meta">
                  <text class="meta-item">{{ actor.height }}cm</text>
                  <text class="meta-divider">|</text>
                  <text class="meta-item">{{ actor.distance }}km</text>
                </view>
              </view>
              <view :class="['credit-badge', getCreditClass(actor.credit_score)]">
                {{ actor.credit_score }}
              </view>
            </view>
          </view>
        </view>

        <!-- 搜索无结果 -->
        <view v-else-if="searchKeyword && searchResults.length === 0 && !searchLoading" class="empty-search">
          <text class="empty-text">未找到匹配的演员</text>
        </view>

        <!-- 非搜索状态：显示最近订单和信用分 -->
        <view v-if="!searchKeyword" class="main-content">
          <!-- 最近订单 -->
          <view class="recent-orders-compact">
            <view class="section-header-compact">
              <text class="section-title-text">最近订单</text>
              <view class="more-link" @tap="goToOrderList">
                <text>全部</text>
                <uni-icons type="forward" size="14" color="#FFD700"></uni-icons>
              </view>
            </view>

            <view v-if="orderList.length > 0" class="order-list-compact">
              <view
                v-for="order in orderList.slice(0, 3)"
                :key="order._id"
                class="order-item-compact"
                @tap="goToOrderDetail(order._id)"
              >
                <view class="order-header-compact">
                  <text :class="['order-status-compact', statusClassMap[order.order_status]]">
                    {{ getStatusText(order.order_status) }}
                  </text>
                  <text class="order-time-compact">{{ formatTime(order.create_time) }}</text>
                </view>
                <view class="order-content-compact">
                  <text class="order-location">{{ order.meeting_location_name }}</text>
                  <text class="order-price">{{ (order.price_amount / 100).toFixed(0) }}</text>
                </view>
              </view>
            </view>
            <view v-else class="empty-orders-compact">
              <text class="empty-text-compact">暂无订单</text>
            </view>
          </view>

          <!-- 信用分 -->
          <view class="credit-section-compact">
            <view class="credit-info">
              <text class="credit-title-compact">信用分</text>
              <view class="credit-score-compact">
                <text class="score-value">{{ userInfo.credit_score_crew || 100 }}</text>
                <text class="score-max">/150</text>
              </view>
            </view>
            <view :class="['credit-level-badge', crewCreditLevelClass]">
              {{ crewCreditLevel }}
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- FAB 悬浮按钮 -->
    <cover-view class="fab" @tap="goToPostOrder">
      <cover-view class="fab-bg"></cover-view>
      <cover-view class="fab-icon">+</cover-view>
    </cover-view>

    <!-- 演员详情弹窗 -->
    <uni-popup ref="actorDetailPopup" type="bottom" :safe-area="true">
      <view class="actor-detail-popup">
        <view class="popup-header">
          <text class="popup-title">演员资料</text>
          <view class="popup-close" @tap="closeActorDetail">
            <uni-icons type="close" size="24" color="#fff"></uni-icons>
          </view>
        </view>

        <view v-if="selectedActor" class="actor-detail-content">
          <!-- 视频模卡预览区 -->
          <view class="video-card-preview">
            <video
              v-if="selectedActor.videoCard"
              :src="selectedActor.videoCard"
              :controls="true"
              :autoplay="false"
              :muted="true"
              class="video-player"
            ></video>
            <view v-else class="video-placeholder">
              <uni-icons type="videocam" size="48" color="#666"></uni-icons>
              <text class="placeholder-text">暂无视频模卡</text>
            </view>
          </view>

          <!-- 详细信息 -->
          <view class="detail-info-grid">
            <view class="info-item">
              <text class="info-label">姓名</text>
              <text class="info-value">{{ selectedActor.nickname }}</text>
            </view>
            <view class="info-item">
              <text class="info-label">性别</text>
              <text class="info-value">{{ selectedActor.gender === 1 ? '男' : '女' }}</text>
            </view>
            <view class="info-item">
              <text class="info-label">身高</text>
              <text class="info-value">{{ selectedActor.height }}cm</text>
            </view>
            <view class="info-item">
              <text class="info-label">体型</text>
              <text class="info-value">{{ selectedActor.bodyType }}</text>
            </view>
          </view>

          <view class="detail-skills">
            <text class="skills-label">特长技能</text>
            <view class="skills-list">
              <text v-for="skill in selectedActor.skills" :key="skill" class="skill-tag-large">
                {{ skill }}
              </text>
            </view>
          </view>

          <button class="btn-invite" type="primary" @tap="inviteActor">
            邀请TA接单
          </button>
        </view>
      </view>
    </uni-popup>

    <!-- 底部 TabBar -->
    <custom-tabbar role="crew" :current="0" @refresh="refreshData"></custom-tabbar>
  </view>
</template>

<script>
export default {
  data() {
    return {
      // 登录状态
      isLoggedIn: false,

      // 地图相关
      mapCenter: {
        latitude: 29.5630,
        longitude: 106.4650
      },
      mapScale: 15,
      actorMarkers: [],

      // 抽屉相关
      drawerHeight: 400,
      drawerMinHeight: 280,
      drawerMaxHeight: 1000,
      touchStartY: 0,
      drawerStartHeight: 0,
      isDragging: false,

      // 搜索
      searchKeyword: '',
      searchResults: [],
      searchLoading: false,
      searchTimer: null,

      // 演员数据（用于地图标记和搜索）
      actorList: [],
      selectedActor: null,
      actorsLoading: false,

      // 用户位置
      userLocation: {
        longitude: null,
        latitude: null
      },

      // 用户信息
      userInfo: {},
      stats: {
        pending: 0,
        ongoing: 0,
        completed: 0
      },
      orderList: [],
      statusClassMap: {
        0: 'status-pending',
        1: 'status-ongoing',
        2: 'status-payment',
        3: 'status-completed',
        4: 'status-canceled'
      }
    }
  },

  computed: {
    crewCreditLevelClass() {
      const score = this.userInfo.credit_score_crew || 100
      if (score >= 130) return 'level-gold'
      if (score >= 110) return 'level-silver'
      return 'level-normal'
    },
    crewCreditLevel() {
      const score = this.userInfo.credit_score_crew || 100
      return this.getCreditLevel(score)
    }
  },

  async onLoad() {
    this.isLoggedIn = this.checkLoginStatus()
    this.getMyLocation()

    if (this.isLoggedIn) {
      this.loadUserInfo()
      this.loadStats()
      this.loadRecentOrders()
    }
  },

  onPullDownRefresh() {
    this.isLoggedIn = this.checkLoginStatus()
    this.loadActors()
    if (this.isLoggedIn) {
      this.loadStats()
      this.loadRecentOrders()
    }
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 1000)
  },

  methods: {
    // ========== 刷新数据 ==========
    refreshData() {
      this.isLoggedIn = this.checkLoginStatus()
      this.loadActors()
      if (this.isLoggedIn) {
        this.loadUserInfo()
        this.loadStats()
        this.loadRecentOrders()
      }
    },

    // ========== 地图相关 ==========
    getMyLocation() {
      uni.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 4000,
        success: (res) => {
          this.mapCenter.latitude = res.latitude
          this.mapCenter.longitude = res.longitude
          this.userLocation = {
            longitude: res.longitude,
            latitude: res.latitude
          }
          console.log('定位成功, 精度:', res.accuracy, '米')
          this.loadActors()
        },
        fail: (err) => {
          console.error('获取位置失败:', err)
          uni.showToast({
            title: '定位失败，使用默认位置',
            icon: 'none'
          })
          this.userLocation = {
            longitude: this.mapCenter.longitude,
            latitude: this.mapCenter.latitude
          }
          this.loadActors()
        }
      })
    },

    onRegionChange(e) {
      if (e.type === 'end') {
        this.loadActors()
      }
    },

    onMarkerTap(e) {
      const markerId = e.detail.markerId
      const actor = this.actorList.find(a => a.id === markerId)
      if (actor) {
        this.showActorDetail(actor)
      }
    },

    // 加载演员（用于地图标记和搜索）
    async loadActors() {
      if (!this.userLocation.longitude || !this.userLocation.latitude) {
        return
      }

      if (this.actorsLoading) return
      this.actorsLoading = true

      try {
        const orderCo = uniCloud.importObject('order-co')
        const params = {
          longitude: this.userLocation.longitude,
          latitude: this.userLocation.latitude,
          maxDistance: 5000
        }

        const res = await orderCo.getNearbyActors(params)

        if (res.code === 0 && res.data) {
          const skillLabelMap = {
            'driving': '开车',
            'dancing': '跳舞',
            'singing': '唱歌',
            'martial_arts': '武术',
            'swimming': '游泳',
            'riding': '骑马',
            'instrument': '乐器',
            'language': '外语'
          }

          const bodyTypeMap = {
            'slim': '偏瘦',
            'standard': '标准',
            'athletic': '健壮',
            'plump': '偏胖'
          }

          this.actorList = res.data.map((actor, index) => ({
            id: actor._id || index + 1,
            _id: actor._id,
            nickname: actor.nickname || '演员',
            avatar: actor.avatar || '/static/default-avatar.png',
            height: actor.height || 170,
            gender: actor.gender || 0,
            bodyType: bodyTypeMap[actor.body_type] || actor.body_type || '标准',
            credit_score: actor.credit_score_actor || 100,
            distance: actor.distance_km ? parseFloat(actor.distance_km).toFixed(1) : '-',
            skills: (actor.skills || []).map(s => skillLabelMap[s] || s),
            latitude: actor.location ? actor.location.coordinates[1] : this.mapCenter.latitude + (Math.random() - 0.5) * 0.01,
            longitude: actor.location ? actor.location.coordinates[0] : this.mapCenter.longitude + (Math.random() - 0.5) * 0.01,
            videoCard: actor.video_card || ''
          }))

          this.actorMarkers = this.actorList.map(actor => ({
            id: actor.id,
            latitude: actor.latitude,
            longitude: actor.longitude,
            iconPath: actor.avatar || '/static/default-avatar.png',
            width: 40,
            height: 40,
            anchor: { x: 0.5, y: 0.5 },
            callout: {
              content: `${actor.nickname} ${actor.height}cm`,
              display: 'BYCLICK',
              bgColor: '#1E1E1E',
              color: '#FFD700',
              fontSize: 12,
              borderRadius: 8,
              padding: 6
            }
          }))
        } else {
          this.actorList = []
          this.actorMarkers = []
        }
      } catch (error) {
        console.error('加载演员失败:', error)
        this.actorList = []
        this.actorMarkers = []
      } finally {
        this.actorsLoading = false
      }
    },

    showActorDetail(actor) {
      this.selectedActor = actor
      this.$refs.actorDetailPopup.open()
    },

    closeActorDetail() {
      this.$refs.actorDetailPopup.close()
    },

    inviteActor() {
      if (!this.requireLogin('邀请演员')) return
      uni.showToast({
        title: '邀请功能开发中',
        icon: 'none'
      })
    },

    // ========== 抽屉相关 ==========
    onDrawerTouchStart(e) {
      this.touchStartY = e.touches[0].clientY
      this.drawerStartHeight = this.drawerHeight
      this.isDragging = true
    },

    onDrawerTouchMove(e) {
      if (!this.isDragging) return

      const currentY = e.touches[0].clientY
      const deltaY = this.touchStartY - currentY
      const deltaRpx = deltaY * 2

      let newHeight = this.drawerStartHeight + deltaRpx

      if (newHeight < this.drawerMinHeight) {
        newHeight = this.drawerMinHeight
      }
      if (newHeight > this.drawerMaxHeight) {
        newHeight = this.drawerMaxHeight
      }

      this.drawerHeight = newHeight
    },

    onDrawerTouchEnd(e) {
      this.isDragging = false
      this.touchStartY = 0
      this.drawerStartHeight = 0
    },

    // ========== 搜索 ==========
    onSearchInput() {
      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
      }

      if (!this.searchKeyword.trim()) {
        this.searchResults = []
        return
      }

      this.searchTimer = setTimeout(() => {
        this.performSearch()
      }, 300)
    },

    performSearch() {
      const keyword = this.searchKeyword.trim().toLowerCase()
      if (!keyword) {
        this.searchResults = []
        return
      }

      this.searchLoading = true

      this.searchResults = this.actorList.filter(actor => {
        const nameMatch = actor.nickname && actor.nickname.toLowerCase().includes(keyword)
        const heightMatch = String(actor.height).includes(keyword)
        const skillMatch = actor.skills && actor.skills.some(s => s.toLowerCase().includes(keyword))
        const bodyTypeMatch = actor.bodyType && actor.bodyType.includes(keyword)
        return nameMatch || heightMatch || skillMatch || bodyTypeMatch
      })

      this.searchLoading = false
    },

    clearSearch() {
      this.searchKeyword = ''
      this.searchResults = []
    },

    // ========== 登录检查 ==========
    checkLoginStatus() {
      try {
        const token = uni.getStorageSync('uni_id_token')
        const tokenExpired = uni.getStorageSync('uni_id_token_expired')
        return token && tokenExpired && tokenExpired > Date.now()
      } catch (error) {
        return false
      }
    },

    requireLogin(actionName = '此操作') {
      if (this.isLoggedIn) return true

      uni.showModal({
        title: '需要登录',
        content: `${actionName}需要登录后才能使用，是否现在登录？`,
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            uni.setStorageSync('selected_role', 'crew')
            uni.navigateTo({
              url: '/uni_modules/uni-id-pages/pages/login/login-withpwd'
            })
          }
        }
      })
      return false
    },

    async loadUserInfo() {
      try {
        const res = await uniCloud.getCurrentUserInfo()
        this.userInfo = res
      } catch (error) {
        console.error('加载用户信息失败:', error)
      }
    },

    async loadStats() {
      try {
        const token = uni.getStorageSync('uni_id_token')
        if (!token) return

        const userCo = uniCloud.importObject('user-co')
        const res = await userCo.getStats()

        if (res.code === 0 && res.data) {
          this.stats = {
            pending: res.data.pending || 0,
            ongoing: res.data.in_progress || 0,
            completed: res.data.completed || 0
          }
          if (res.data.credit_score) {
            this.userInfo.credit_score_crew = res.data.credit_score
          }
        }
      } catch (error) {
        console.error('加载统计失败:', error)
      }
    },

    async loadRecentOrders() {
      try {
        const token = uni.getStorageSync('uni_id_token')
        if (!token) return

        const orderCo = uniCloud.importObject('order-co')
        const res = await orderCo.getMyOrders({
          page: 1,
          pageSize: 5
        })

        if (res.code === 0) {
          this.orderList = res.data.list
        } else if (res.code === 401) {
          uni.reLaunch({
            url: '/pages/index/index'
          })
        }
      } catch (error) {
        console.error('加载订单失败:', error)
        if (error.message && error.message.includes('登录')) {
          uni.reLaunch({
            url: '/pages/index/index'
          })
        }
      }
    },

    goToPostOrder() {
      if (!this.requireLogin('发布需求')) return
      uni.navigateTo({
        url: '/pages/crew/post_order'
      })
    },

    goToOrderList() {
      if (!this.requireLogin('查看订单')) return
      uni.navigateTo({
        url: '/pages/crew/order_list'
      })
    },

    goToOrderDetail(orderId) {
      if (!this.requireLogin('查看订单详情')) return
      uni.navigateTo({
        url: `/pages/crew/order_detail?id=${orderId}`
      })
    },

    goToProfile() {
      if (!this.requireLogin('查看个人中心')) return
      uni.navigateTo({
        url: '/pages/crew/profile'
      })
    },

    // ========== 工具方法 ==========
    getCreditClass(score) {
      if (score >= 130) return 'credit-gold'
      if (score >= 110) return 'credit-silver'
      return 'credit-normal'
    },

    getCreditLevel(score) {
      if (score >= 130) return '金牌剧组'
      if (score >= 110) return '优质剧组'
      if (score >= 90) return '良好'
      return '普通'
    },

    getStatusText(status) {
      const textMap = {
        0: '待接单',
        1: '进行中',
        2: '待支付',
        3: '已完成',
        4: '已取消'
      }
      return textMap[status] || '未知'
    },

    formatTime(timestamp) {
      const date = new Date(timestamp)
      const now = new Date()
      const diff = now - date

      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

      return `${date.getMonth() + 1}-${date.getDate()}`
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.crew-home-map {
  width: 100%;
  height: 100vh;
  position: relative;
  background-color: $bg-primary;
}

// ========== 地图层 ==========
.map-layer {
  width: 100%;
  height: 100%;
}

// ========== 我的图标 ==========
.my-profile-icon-crew {
  position: absolute;
  left: 32rpx;
  top: 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100rpx;
  height: 100rpx;
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 20rpx;
  box-shadow: 0 8rpx 16rpx rgba(0, 0, 0, 0.15);
}

.my-icon-circle {
  width: 48rpx;
  height: 48rpx;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.my-icon-head {
  width: 20rpx;
  height: 20rpx;
  background-color: #333;
  border-radius: 50%;
}

.my-icon-body {
  width: 32rpx;
  height: 18rpx;
  background-color: #333;
  border-radius: 16rpx 16rpx 0 0;
  margin-top: 4rpx;
}

.my-text-crew {
  font-size: 20rpx;
  color: #333;
  font-weight: 600;
  margin-top: 4rpx;
}

// ========== 底部抽屉 ==========
.drawer-container {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: $bg-secondary;
  border-radius: $border-radius-lg $border-radius-lg 0 0;
  z-index: $z-index-drawer;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.3);
  will-change: height;
}

.drawer-handle-area {
  padding: $spacing-sm 0;
  @include flex-center;
}

.drawer-handle {
  width: 80rpx;
  height: 8rpx;
  background-color: $gray-3;
  border-radius: 4rpx;
}

.drawer-content {
  padding: 0 $spacing-base $spacing-base;
  box-sizing: border-box;
}

// ========== 搜索栏 ==========
.search-bar {
  display: flex;
  align-items: center;
  background-color: $bg-tertiary;
  border-radius: $border-radius-base;
  padding: $spacing-sm $spacing-base;
  margin-bottom: $spacing-base;
  gap: $spacing-sm;
}

.search-input {
  flex: 1;
  color: $text-primary;
  font-size: $font-size-base;
}

.search-placeholder {
  color: $text-hint;
}

.search-clear {
  @include flex-center;
}

// ========== 搜索结果 ==========
.search-results {
  margin-bottom: $spacing-base;
}

.result-count {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.search-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.search-item {
  display: flex;
  align-items: center;
  background-color: $bg-tertiary;
  border-radius: $border-radius-base;
  padding: $spacing-base;
  gap: $spacing-base;

  &:active {
    opacity: 0.8;
  }
}

.actor-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: $border-radius-circle;
  background-color: $gray-4;
}

.actor-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.actor-name {
  font-size: $font-size-lg;
  font-weight: $font-weight-medium;
  color: $text-primary;
}

.actor-meta {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: $font-size-sm;
  color: $text-secondary;
}

.meta-item {
  font-family: $font-family-monospace;
}

.meta-divider {
  color: $gray-3;
}

.credit-badge {
  padding: 8rpx 16rpx;
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

.empty-search {
  padding: $spacing-lg 0;
  text-align: center;

  .empty-text {
    font-size: $font-size-base;
    color: $text-secondary;
  }
}

// ========== 主内容区 ==========
.main-content {
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

// ========== 最近订单 ==========
.recent-orders-compact {
  padding: $spacing-base;
  background-color: $bg-tertiary;
  border-radius: $border-radius-base;
}

.section-header-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-base;

  .section-title-text {
    font-size: $font-size-lg;
    font-weight: $font-weight-bold;
    color: $text-primary;
  }

  .more-link {
    display: flex;
    align-items: center;
    gap: 4rpx;
    font-size: $font-size-sm;
    color: $primary-color;
  }
}

.order-list-compact {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.order-item-compact {
  padding: $spacing-sm;
  background-color: $bg-primary;
  border-radius: $border-radius-sm;

  &:active {
    opacity: 0.8;
  }
}

.order-header-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;

  .order-status-compact {
    padding: 4rpx 12rpx;
    border-radius: 8rpx;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;

    &.status-pending {
      @include status-tag($warning-color);
    }

    &.status-ongoing {
      @include status-tag($secondary-color);
    }

    &.status-completed {
      @include status-tag($success-color);
    }
  }

  .order-time-compact {
    font-size: $font-size-xs;
    color: $text-hint;
  }
}

.order-content-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .order-location {
    flex: 1;
    font-size: $font-size-sm;
    color: $text-secondary;
    @include text-ellipsis;
  }

  .order-price {
    font-size: $font-size-lg;
    font-weight: $font-weight-bold;
    color: $primary-color;
    font-family: $font-family-monospace;

    &::before {
      content: '\00A5';
    }
  }
}

.empty-orders-compact {
  padding: $spacing-lg 0;
  text-align: center;

  .empty-text-compact {
    font-size: $font-size-sm;
    color: $text-secondary;
  }
}

// ========== 信用分 ==========
.credit-section-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-base;
  background: linear-gradient(135deg, rgba($primary-color, 0.2) 0%, rgba($secondary-color, 0.2) 100%);
  border-radius: $border-radius-base;
}

.credit-info {
  display: flex;
  align-items: baseline;
  gap: $spacing-sm;

  .credit-title-compact {
    font-size: $font-size-sm;
    color: $text-secondary;
  }

  .credit-score-compact {
    display: flex;
    align-items: baseline;
    gap: 4rpx;

    .score-value {
      font-size: 40rpx;
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

.credit-level-badge {
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

// ========== FAB 悬浮按钮 ==========
.fab {
  position: fixed;
  right: 32rpx;
  bottom: 120rpx;
  width: 112rpx;
  height: 112rpx;
  z-index: 999;

  .fab-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 112rpx;
    height: 112rpx;
    background-color: #FFD700;
    border-radius: 56rpx;
  }

  .fab-icon {
    position: absolute;
    top: 0;
    left: 0;
    width: 112rpx;
    height: 112rpx;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 72rpx;
    font-weight: 200;
    color: #000000;
    line-height: 112rpx;
    text-align: center;
  }
}

// ========== 演员详情弹窗 ==========
.actor-detail-popup {
  background-color: $bg-secondary;
  border-radius: $border-radius-lg $border-radius-lg 0 0;
  max-height: 90vh;
  overflow: hidden;
}

.popup-header {
  position: relative;
  padding: $spacing-lg;
  background: linear-gradient(135deg, $primary-color 0%, #FFED4E 100%);
  text-align: center;

  .popup-title {
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    color: $black;
  }

  .popup-close {
    position: absolute;
    right: $spacing-lg;
    top: $spacing-lg;
  }
}

.actor-detail-content {
  padding: $spacing-lg;
}

.video-card-preview {
  width: 100%;
  height: 400rpx;
  background-color: $bg-tertiary;
  border-radius: $border-radius-base;
  margin-bottom: $spacing-lg;
  overflow: hidden;

  .video-player {
    width: 100%;
    height: 100%;
  }

  .video-placeholder {
    width: 100%;
    height: 100%;
    @include flex-center;
    @include flex-column;
    gap: $spacing-base;

    .placeholder-text {
      font-size: $font-size-base;
      color: $text-secondary;
    }
  }
}

.detail-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-base;
  margin-bottom: $spacing-lg;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;

  .info-label {
    font-size: $font-size-sm;
    color: $text-secondary;
  }

  .info-value {
    font-size: $font-size-lg;
    font-weight: $font-weight-medium;
    color: $text-primary;
  }
}

.detail-skills {
  margin-bottom: $spacing-lg;

  .skills-label {
    display: block;
    font-size: $font-size-sm;
    color: $text-secondary;
    margin-bottom: $spacing-sm;
  }

  .skills-list {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  .skill-tag-large {
    padding: 8rpx 20rpx;
    background-color: rgba($primary-color, 0.15);
    border: 1rpx solid $primary-color;
    border-radius: $border-radius-base;
    color: $primary-color;
    font-size: $font-size-base;
  }
}

.btn-invite {
  @include button-primary;
  width: 100%;
  margin-top: $spacing-base;
}
</style>
