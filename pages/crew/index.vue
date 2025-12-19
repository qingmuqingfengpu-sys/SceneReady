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
      <!-- 我的图标 -->
      <cover-view class="my-profile-icon-crew" @tap="goToProfile">
        <cover-view class="my-icon-circle">
          <cover-view class="my-icon-head"></cover-view>
          <cover-view class="my-icon-body"></cover-view>
        </cover-view>
        <cover-view class="my-text-crew">我的</cover-view>
      </cover-view>
    </map>

    <!-- 底部抽屉 -->
    <view
      class="drawer-container"
      :class="{ 'drawer-expanded': drawerExpanded }"
      @touchstart="onDrawerTouchStart"
      @touchmove="onDrawerTouchMove"
      @touchend="onDrawerTouchEnd"
    >
      <!-- 抽屉把手 -->
      <view class="drawer-handle-area" @tap="toggleDrawer">
        <view class="drawer-handle"></view>
      </view>

      <!-- 抽屉内容 -->
      <scroll-view scroll-y class="drawer-content">
        <!-- 搜索栏 -->
        <view class="search-bar">
          <uni-icons type="search" size="20" color="#999"></uni-icons>
          <input
            class="search-input"
            placeholder="搜索演员（身高、特长、体型）"
            placeholder-class="search-placeholder"
            v-model="searchKeyword"
            @input="onSearchInput"
          />
          <view v-if="searchKeyword" class="search-clear" @tap="clearSearch">
            <uni-icons type="close" size="16" color="#999"></uni-icons>
          </view>
        </view>

        <!-- 收起状态：推荐演员 -->
        <view v-if="!drawerExpanded" class="recommended-actors">
          <view class="section-title">
            <text class="title-text">附近演员</text>
            <text class="title-count">({{ nearbyActors.length }}人在线)</text>
          </view>

          <view v-if="nearbyActors.length > 0" class="actor-cards">
            <view
              v-for="actor in nearbyActors.slice(0, 2)"
              :key="actor.id"
              class="actor-card-mini"
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
                <view class="actor-tags">
                  <text
                    v-for="skill in actor.skills.slice(0, 2)"
                    :key="skill"
                    class="skill-tag"
                  >
                    {{ skill }}
                  </text>
                </view>
              </view>
              <view :class="['credit-badge', actor.credit_score >= 130 ? 'credit-gold' : (actor.credit_score >= 110 ? 'credit-silver' : 'credit-normal')]">
                {{ actor.credit_score }}
              </view>
            </view>
          </view>
          <view v-else class="empty-actors">
            <uni-icons type="info" size="32" color="#999"></uni-icons>
            <text class="empty-text">附近暂无演员</text>
          </view>
        </view>

        <!-- 展开状态：完整信息 -->
        <view v-else class="expanded-content">
          <!-- 统计卡片 -->
          <view class="stats-compact">
            <view class="stat-item-compact">
              <text class="stat-value-compact">{{ stats.pending }}</text>
              <text class="stat-label-compact">待接单</text>
            </view>
            <view class="stat-divider-compact"></view>
            <view class="stat-item-compact">
              <text class="stat-value-compact">{{ stats.ongoing }}</text>
              <text class="stat-label-compact">进行中</text>
            </view>
            <view class="stat-divider-compact"></view>
            <view class="stat-item-compact">
              <text class="stat-value-compact">{{ stats.completed }}</text>
              <text class="stat-label-compact">已完成</text>
            </view>
          </view>

          <!-- 筛选器 -->
          <view class="filter-section">
            <view class="filter-row">
              <text class="filter-label">性别</text>
              <view class="filter-options">
                <text
                  v-for="item in genderOptions"
                  :key="item.value"
                  :class="['filter-chip', { 'active': filters.gender === item.value }]"
                  @tap="setFilter('gender', item.value)"
                >
                  {{ item.label }}
                </text>
              </view>
            </view>

            <view class="filter-row">
              <text class="filter-label">身高(cm)</text>
              <view class="filter-range">
                <input
                  class="range-input"
                  type="number"
                  placeholder="最低"
                  v-model="filters.heightMin"
                />
                <text class="range-separator">-</text>
                <input
                  class="range-input"
                  type="number"
                  placeholder="最高"
                  v-model="filters.heightMax"
                />
              </view>
            </view>

            <view class="filter-row">
              <text class="filter-label">特长</text>
              <view class="filter-options">
                <text
                  v-for="skill in skillOptions"
                  :key="skill.value"
                  :class="['filter-chip', { 'active': filters.skills.includes(skill.value) }]"
                  @tap="toggleSkill(skill.value)"
                >
                  {{ skill.label }}
                </text>
              </view>
            </view>
          </view>

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
                  <text class="order-price">¥{{ (order.price_amount / 100).toFixed(0) }}</text>
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
  </view>
</template>

<script>
export default {
  data() {
    return {
      // 地图相关
      mapCenter: {
        latitude: 29.5630,  // 重庆大学默认坐标
        longitude: 106.4650
      },
      mapScale: 15,
      actorMarkers: [],  // 演员标记点

      // 抽屉相关
      drawerExpanded: false,
      touchStartY: 0,
      drawerStartY: 0,

      // 搜索
      searchKeyword: '',

      // 筛选器
      filters: {
        gender: 0,  // 0-不限, 1-男, 2-女
        heightMin: '',
        heightMax: '',
        skills: []
      },
      genderOptions: [
        { label: '不限', value: 0 },
        { label: '男', value: 1 },
        { label: '女', value: 2 }
      ],
      skillOptions: [
        { label: '开车', value: 'driving' },
        { label: '跳舞', value: 'dancing' },
        { label: '唱歌', value: 'singing' },
        { label: '武术', value: 'martial_arts' },
        { label: '游泳', value: 'swimming' },
        { label: '骑马', value: 'riding' },
        { label: '乐器', value: 'instrument' },
        { label: '外语', value: 'language' }
      ],

      // 演员数据
      nearbyActors: [],
      selectedActor: null,

      // 原有数据
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
    const isLoggedIn = await this.checkLogin()
    if (!isLoggedIn) {
      return
    }

    // 等待一下确保token完全生效
    await new Promise(resolve => setTimeout(resolve, 300))

    this.loadUserInfo()
    this.loadStats()
    this.loadRecentOrders()
    this.getMyLocation()
    this.loadNearbyActors()
  },

  onPullDownRefresh() {
    this.loadStats()
    this.loadRecentOrders()
    this.loadNearbyActors()
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 1000)
  },

  methods: {
    // ========== 地图相关 ==========
    // 获取我的位置
    getMyLocation() {
      uni.getLocation({
        type: 'gcj02',
        success: (res) => {
          this.mapCenter.latitude = res.latitude
          this.mapCenter.longitude = res.longitude
        },
        fail: (err) => {
          console.error('获取位置失败:', err)
          uni.showToast({
            title: '定位失败，使用默认位置',
            icon: 'none'
          })
        }
      })
    },

    // 回到我的位置
    centerToMyLocation() {
      this.getMyLocation()
    },

    // 地图区域变化
    onRegionChange(e) {
      if (e.type === 'end') {
        // 区域变化结束，重新加载附近演员
        this.loadNearbyActors()
      }
    },

    // 点击演员标记
    onMarkerTap(e) {
      const markerId = e.detail.markerId
      const actor = this.nearbyActors.find(a => a.id === markerId)
      if (actor) {
        this.showActorDetail(actor)
      }
    },

    // 加载附近演员（模拟数据）
    loadNearbyActors() {
      // TODO: 调用后端接口获取附近演员
      // 这里使用模拟数据
      const mockActors = [
        {
          id: 1,
          nickname: '张三',
          avatar: '/static/avatar1.png',
          height: 175,
          gender: 1,
          bodyType: '标准',
          credit_score: 135,
          distance: 0.5,
          skills: ['开车', '跳舞'],
          latitude: 29.5640,
          longitude: 106.4660,
          videoCard: ''  // 视频模卡URL
        },
        {
          id: 2,
          nickname: '李四',
          avatar: '/static/avatar2.png',
          height: 168,
          gender: 2,
          bodyType: '偏瘦',
          credit_score: 120,
          distance: 1.2,
          skills: ['唱歌', '游泳'],
          latitude: 29.5620,
          longitude: 106.4640,
          videoCard: ''
        }
      ]

      this.nearbyActors = mockActors

      // 生成地图标记点
      this.actorMarkers = mockActors.map(actor => ({
        id: actor.id,
        latitude: actor.latitude,
        longitude: actor.longitude,
        iconPath: actor.avatar || '/static/default-avatar.png',
        width: 40,
        height: 40,
        customCallout: {
          anchorY: 0,
          display: 'ALWAYS'
        }
      }))
    },

    // 显示演员详情
    showActorDetail(actor) {
      this.selectedActor = actor
      this.$refs.actorDetailPopup.open()
    },

    // 关闭演员详情
    closeActorDetail() {
      this.$refs.actorDetailPopup.close()
    },

    // 邀请演员
    inviteActor() {
      // TODO: 实现邀请功能
      uni.showToast({
        title: '邀请功能开发中',
        icon: 'none'
      })
    },

    // ========== 抽屉相关 ==========
    toggleDrawer() {
      this.drawerExpanded = !this.drawerExpanded
    },

    onDrawerTouchStart(e) {
      this.touchStartY = e.touches[0].clientY
    },

    onDrawerTouchMove(e) {
      const currentY = e.touches[0].clientY
      const deltaY = currentY - this.touchStartY

      // 向下滑动超过50px则收起，向上滑动超过50px则展开
      if (deltaY > 50 && this.drawerExpanded) {
        this.drawerExpanded = false
      } else if (deltaY < -50 && !this.drawerExpanded) {
        this.drawerExpanded = true
      }
    },

    onDrawerTouchEnd(e) {
      this.touchStartY = 0
    },

    // ========== 搜索和筛选 ==========
    onSearchInput() {
      // TODO: 实现搜索功能
      console.log('搜索:', this.searchKeyword)
    },

    clearSearch() {
      this.searchKeyword = ''
    },

    setFilter(key, value) {
      this.filters[key] = value
      this.loadNearbyActors()
    },

    toggleSkill(skill) {
      const index = this.filters.skills.indexOf(skill)
      if (index > -1) {
        this.filters.skills.splice(index, 1)
      } else {
        this.filters.skills.push(skill)
      }
      this.loadNearbyActors()
    },

    // ========== 原有功能 ==========
    async checkLogin() {
      try {
        // 检查本地存储的用户信息
        const userInfo = uni.getStorageSync('uni-id-pages-userInfo')

        // 检查 token 和过期时间
        const token = uni.getStorageSync('uni_id_token')
        const tokenExpired = uni.getStorageSync('uni_id_token_expired')

        // 如果没有 token 或 token 已过期
        if (!token || !tokenExpired || tokenExpired < Date.now()) {
          uni.showModal({
            title: '提示',
            content: '登录已过期，请重新登录',
            showCancel: false,
            success: () => {
              uni.reLaunch({
                url: '/pages/index/index'
              })
            }
          })
          return false
        }

        // 如果有 token 但没有用户信息，尝试获取
        if (!userInfo || !userInfo._id) {
          try {
            const cloudUserInfo = uniCloud.getCurrentUserInfo()
            if (cloudUserInfo && cloudUserInfo.uid) {
              // 如果云端有用户信息，说明登录有效
              return true
            }
          } catch (e) {
            console.error('获取云端用户信息失败:', e)
          }

          // 如果获取不到用户信息，跳转登录
          uni.showModal({
            title: '提示',
            content: '请先登录',
            showCancel: false,
            success: () => {
              uni.reLaunch({
                url: '/pages/index/index'
              })
            }
          })
          return false
        }

        // token 和用户信息都存在，登录有效
        return true
      } catch (error) {
        console.error('检查登录状态失败:', error)
        // 出错时也允许继续，避免阻塞用户
        return true
      }
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
        // 再次检查token是否存在
        const token = uni.getStorageSync('uni_id_token')
        if (!token) {
          console.log('loadStats: token不存在，跳过加载')
          return
        }

        const db = uniCloud.database()
        const userInfo = await uniCloud.getCurrentUserInfo()
        const userId = userInfo.uid

        if (!userId) {
          console.log('loadStats: 无法获取userId')
          return
        }

        const [pendingRes, ongoingRes, completedRes] = await Promise.all([
          db.collection('orders').where({ publisher_id: userId, order_status: 0 }).count(),
          db.collection('orders').where({ publisher_id: userId, order_status: 1 }).count(),
          db.collection('orders').where({ publisher_id: userId, order_status: 3 }).count()
        ])

        this.stats = {
          pending: pendingRes.total,
          ongoing: ongoingRes.total,
          completed: completedRes.total
        }
      } catch (error) {
        console.error('加载统计失败:', error)
      }
    },

    async loadRecentOrders() {
      try {
        // 再次检查token是否存在
        const token = uni.getStorageSync('uni_id_token')
        if (!token) {
          console.log('loadRecentOrders: token不存在，跳过加载')
          return
        }

        const orderCo = uniCloud.importObject('order-co')
        const res = await orderCo.getMyOrders({
          page: 1,
          pageSize: 5
        })

        if (res.code === 0) {
          this.orderList = res.data.list
        } else if (res.code === 401) {
          console.log('loadRecentOrders: 未授权，跳转到首页')
          uni.reLaunch({
            url: '/pages/index/index'
          })
        }
      } catch (error) {
        console.error('加载订单失败:', error)
        // 如果是登录相关错误，跳转到首页
        if (error.message && error.message.includes('登录')) {
          console.log('loadRecentOrders: 登录错误，跳转到首页')
          uni.reLaunch({
            url: '/pages/index/index'
          })
        }
      }
    },

    goToPostOrder() {
      uni.navigateTo({
        url: '/pages/crew/post_order'
      })
    },

    goToOrderList() {
      uni.navigateTo({
        url: '/pages/crew/order_list'
      })
    },

    goToOrderDetail(orderId) {
      uni.navigateTo({
        url: `/pages/crew/order_detail?id=${orderId}`
      })
    },

    // ========== 个人资料 ==========
    goToProfile() {
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

    getCreditLevelClass(score) {
      if (score >= 130) return 'level-gold'
      if (score >= 110) return 'level-silver'
      return 'level-normal'
    },

    getStatusClass(status) {
      const classMap = {
        0: 'status-pending',
        1: 'status-ongoing',
        2: 'status-payment',
        3: 'status-completed',
        4: 'status-canceled'
      }
      return classMap[status] || ''
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

// ========== 我的图标（地图覆盖层） ==========
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

.map-controls {
  position: absolute;
  right: 32rpx;
  top: 200rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.control-btn {
  width: 80rpx;
  height: 80rpx;
  background-color: $white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.control-icon-text {
  font-family: 'uniicons';
  font-size: 40rpx;
  color: #333;
  line-height: 1;
}

// ========== 底部抽屉 ==========
.drawer-container {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: $bg-secondary;
  border-radius: $border-radius-lg $border-radius-lg 0 0;
  max-height: 40vh;
  transition: max-height 0.3s ease;
  z-index: $z-index-drawer;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.3);

  &.drawer-expanded {
    max-height: 80vh;
  }
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
  height: calc(100% - 60rpx);
  padding: 0 $spacing-base $spacing-base;
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

// ========== 推荐演员（收起状态） ==========
.recommended-actors {
  padding: $spacing-sm 0;
}

.section-title {
  display: flex;
  align-items: baseline;
  gap: $spacing-xs;
  margin-bottom: $spacing-base;

  .title-text {
    font-size: $font-size-lg;
    font-weight: $font-weight-bold;
    color: $text-primary;
  }

  .title-count {
    font-size: $font-size-sm;
    color: $text-secondary;
  }
}

.actor-cards {
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

.actor-card-mini {
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
  width: 100rpx;
  height: 100rpx;
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

.actor-tags {
  display: flex;
  gap: 8rpx;
}

.skill-tag {
  padding: 4rpx 12rpx;
  background-color: rgba($primary-color, 0.15);
  border: 1rpx solid $primary-color;
  border-radius: $border-radius-sm;
  color: $primary-color;
  font-size: $font-size-xs;
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

.empty-actors {
  @include flex-center;
  @include flex-column;
  padding: $spacing-xxl 0;
  gap: $spacing-base;

  .empty-text {
    font-size: $font-size-base;
    color: $text-secondary;
  }
}

// ========== 展开状态内容 ==========
.expanded-content {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

// 统计卡片（紧凑版）
.stats-compact {
  display: flex;
  background-color: $bg-tertiary;
  border-radius: $border-radius-base;
  padding: $spacing-base;
}

.stat-item-compact {
  flex: 1;
  @include flex-center;
  @include flex-column;
  gap: 8rpx;

  .stat-value-compact {
    font-size: 40rpx;
    font-weight: $font-weight-bold;
    color: $primary-color;
    font-family: $font-family-monospace;
  }

  .stat-label-compact {
    font-size: $font-size-xs;
    color: $text-secondary;
  }
}

.stat-divider-compact {
  width: 1rpx;
  background-color: rgba(255, 255, 255, 0.1);
  margin: 0 $spacing-base;
}

// 筛选器
.filter-section {
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

.filter-row {
  display: flex;
  align-items: flex-start;
  gap: $spacing-base;

  .filter-label {
    width: 120rpx;
    font-size: $font-size-base;
    color: $text-secondary;
    padding-top: 8rpx;
  }

  .filter-options {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  .filter-chip {
    padding: 8rpx 20rpx;
    background-color: $bg-tertiary;
    border: 1rpx solid transparent;
    border-radius: $border-radius-base;
    color: $text-secondary;
    font-size: $font-size-sm;

    &.active {
      background-color: rgba($primary-color, 0.15);
      border-color: $primary-color;
      color: $primary-color;
    }
  }

  .filter-range {
    flex: 1;
    display: flex;
    align-items: center;
    gap: $spacing-sm;

    .range-input {
      flex: 1;
      background-color: $bg-tertiary;
      border-radius: $border-radius-sm;
      padding: 8rpx 16rpx;
      color: $text-primary;
      font-size: $font-size-base;
      text-align: center;
    }

    .range-separator {
      color: $text-secondary;
    }
  }
}

// 最近订单（紧凑版）
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

// 信用分（紧凑版）
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
