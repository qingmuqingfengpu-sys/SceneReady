<template>
  <view class="actor-home">
    <!-- 顶部"我的"图标 -->
    <view class="my-profile-icon" @tap="goToProfile">
      <uni-icons type="person" size="24" color="#000"></uni-icons>
      <text class="my-text">我的</text>
    </view>

    <!-- 顶部统计卡片 -->
    <view class="stats-header">
      <view class="stat-card">
        <text class="stat-value">{{ stats.available }}</text>
        <text class="stat-label">可接订单</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-card">
        <text class="stat-value">{{ stats.ongoing }}</text>
        <text class="stat-label">进行中</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-card">
        <text class="stat-value">¥{{ stats.earned }}</text>
        <text class="stat-label">本月收入</text>
      </view>
    </view>

    <!-- 筛选栏 -->
    <view class="filter-bar">
      <scroll-view scroll-x class="filter-scroll">
        <view class="filter-tags">
          <text
            v-for="filter in filterOptions"
            :key="filter.value"
            :class="['filter-tag', { 'active': selectedFilter === filter.value }]"
            @tap="selectFilter(filter.value)"
          >
            {{ filter.label }}
          </text>
        </view>
      </scroll-view>
      <view class="filter-icon" @tap="showFilterDrawer">
        <uni-icons type="sound" size="20" color="#FFD700"></uni-icons>
      </view>
    </view>

    <!-- 订单列表 -->
    <scroll-view scroll-y class="order-list-container" @scrolltolower="loadMore" :refresher-enabled="true" :refresher-triggered="refreshing" @refresherrefresh="onRefresh">
      <view v-if="jobList.length > 0" class="job-list">
        <view
          v-for="job in jobList"
          :key="job._id"
          class="job-card"
          @tap="viewJobDetail(job)"
        >
          <!-- 左侧：剧组信息 -->
          <view class="job-left">
            <image :src="job.crew_avatar || '/static/default-crew.png'" class="crew-avatar" mode="aspectFill"></image>
            <view :class="['credit-badge', job.crew_credit >= 130 ? 'credit-gold' : (job.crew_credit >= 110 ? 'credit-silver' : 'credit-normal')]">
              {{ getCreditLabel(job.crew_credit) }}
            </view>
          </view>

          <!-- 中间：订单详情 -->
          <view class="job-middle">
            <view class="job-header">
              <text class="job-title">{{ job.role_description || '群众演员' }}</text>
              <text class="job-distance">{{ job.distance }}km</text>
            </view>

            <view class="job-info-row">
              <uni-icons type="location" size="14" color="#999"></uni-icons>
              <text class="job-location">{{ job.meeting_location_name }}</text>
            </view>

            <view class="job-info-row">
              <uni-icons type="calendar" size="14" color="#999"></uni-icons>
              <text class="job-time">{{ formatJobTime(job.meeting_time) }}</text>
            </view>

            <view class="job-info-row">
              <uni-icons type="person" size="14" color="#999"></uni-icons>
              <text class="job-people">需要{{ job.people_needed }}人</text>
            </view>

            <!-- 福利标签 -->
            <view v-if="job.welfare_tags && job.welfare_tags.length > 0" class="welfare-row">
              <text
                v-for="tag in job.welfare_tags.slice(0, 3)"
                :key="tag"
                class="welfare-tag"
              >
                {{ getWelfareText(tag) }}
              </text>
            </view>
          </view>

          <!-- 右侧：价格和抢单按钮 -->
          <view class="job-right">
            <view class="price-section">
              <text class="price-amount">¥{{ (job.price_amount / 100).toFixed(0) }}</text>
              <text class="price-unit">/{{ job.price_type === 'daily' ? '天' : '时' }}</text>
            </view>
            <button class="grab-btn" size="mini" @tap.stop="grabOrder(job)">抢单</button>
            <text v-if="job.order_type === 'immediate'" class="order-type-tag immediate">即时单</text>
            <text v-else class="order-type-tag reservation">预约单</text>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else class="empty-state">
        <uni-icons type="info-filled" size="64" color="#666"></uni-icons>
        <text class="empty-text">暂无可接订单</text>
        <text class="empty-hint">试试调整筛选条件</text>
      </view>

      <!-- 加载更多 -->
      <view v-if="hasMore && jobList.length > 0" class="load-more">
        <uni-icons type="reload" size="16" color="#999"></uni-icons>
        <text class="load-more-text">加载更多...</text>
      </view>
      <view v-if="!hasMore && jobList.length > 0" class="load-more">
        <text class="load-more-text">没有更多了</text>
      </view>
    </scroll-view>

    <!-- 底部筛选抽屉 -->
    <uni-popup ref="filterPopup" type="bottom" :safe-area="true">
      <view class="filter-drawer">
        <view class="drawer-header">
          <text class="drawer-title">筛选条件</text>
          <view class="drawer-actions">
            <text class="drawer-action reset" @tap="resetFilters">重置</text>
            <text class="drawer-action confirm" @tap="applyFilters">确定</text>
          </view>
        </view>

        <view class="filter-content">
          <!-- 距离筛选 -->
          <view class="filter-group">
            <text class="filter-group-title">距离范围</text>
            <view class="filter-options">
              <text
                v-for="item in distanceOptions"
                :key="item.value"
                :class="['filter-chip', { 'active': tempFilters.distance === item.value }]"
                @tap="setTempFilter('distance', item.value)"
              >
                {{ item.label }}
              </text>
            </view>
          </view>

          <!-- 价格筛选 -->
          <view class="filter-group">
            <text class="filter-group-title">价格区间</text>
            <view class="filter-options">
              <text
                v-for="item in priceOptions"
                :key="item.value"
                :class="['filter-chip', { 'active': tempFilters.price === item.value }]"
                @tap="setTempFilter('price', item.value)"
              >
                {{ item.label }}
              </text>
            </view>
          </view>

          <!-- 福利筛选 -->
          <view class="filter-group">
            <text class="filter-group-title">福利待遇</text>
            <view class="filter-options">
              <text
                v-for="item in welfareFilterOptions"
                :key="item.value"
                :class="['filter-chip', { 'active': tempFilters.welfare.includes(item.value) }]"
                @tap="toggleWelfareFilter(item.value)"
              >
                {{ item.label }}
              </text>
            </view>
          </view>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script>
export default {
  data() {
    return {
      // 统计数据
      stats: {
        available: 0,
        ongoing: 0,
        earned: 0
      },

      // 筛选相关
      selectedFilter: 'all',
      filterOptions: [
        { label: '全部', value: 'all' },
        { label: '附近', value: 'nearby' },
        { label: '高价', value: 'high_price' },
        { label: '今天', value: 'today' },
        { label: '即时单', value: 'immediate' }
      ],

      // 高级筛选
      filters: {
        distance: 0,  // 0-不限, 1-3km内, 2-5km内, 3-10km内
        price: 0,  // 0-不限, 1-100以下, 2-100-200, 3-200以上
        welfare: []  // 福利标签数组
      },
      tempFilters: {
        distance: 0,
        price: 0,
        welfare: []
      },
      distanceOptions: [
        { label: '不限', value: 0 },
        { label: '3km内', value: 1 },
        { label: '5km内', value: 2 },
        { label: '10km内', value: 3 }
      ],
      priceOptions: [
        { label: '不限', value: 0 },
        { label: '100元以下', value: 1 },
        { label: '100-200元', value: 2 },
        { label: '200元以上', value: 3 }
      ],
      welfareFilterOptions: [
        { label: '包盒饭', value: 'meal' },
        { label: '报销路费', value: 'taxi' },
        { label: '提供住宿', value: 'accommodation' },
        { label: '有下午茶', value: 'tea' }
      ],

      // 订单列表
      jobList: [],
      page: 1,
      pageSize: 10,
      hasMore: true,
      refreshing: false,

      // 用户信息
      userInfo: {}
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
    this.loadJobs()
  },

  onPullDownRefresh() {
    this.onRefresh()
  },

  methods: {
    // ========== 登录检查 ==========
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

    // ========== 数据加载 ==========
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
        // TODO: 调用后端接口获取统计数据
        // 这里使用模拟数据
        this.stats = {
          available: 23,
          ongoing: 1,
          earned: 1560
        }
      } catch (error) {
        console.error('加载统计失败:', error)
      }
    },

    async loadJobs(reset = false) {
      if (reset) {
        this.page = 1
        this.hasMore = true
        this.jobList = []
      }

      try {
        // TODO: 调用后端接口获取订单列表
        // 这里使用模拟数据
        const mockJobs = [
          {
            _id: '1',
            crew_avatar: '/static/crew1.png',
            crew_credit: 135,
            role_description: '路人甲',
            distance: 1.2,
            meeting_location_name: '重庆大学虎溪校区',
            meeting_time: Date.now() + 2 * 60 * 60 * 1000,
            people_needed: 3,
            welfare_tags: ['meal', 'taxi', 'tea'],
            price_amount: 15000,
            price_type: 'daily',
            order_type: 'reservation'
          },
          {
            _id: '2',
            crew_avatar: '/static/crew2.png',
            crew_credit: 120,
            role_description: '群众演员',
            distance: 0.8,
            meeting_location_name: '观音桥步行街',
            meeting_time: Date.now() + 1 * 60 * 60 * 1000,
            people_needed: 5,
            welfare_tags: ['meal', 'taxi'],
            price_amount: 20000,
            price_type: 'daily',
            order_type: 'immediate'
          },
          {
            _id: '3',
            crew_avatar: '/static/crew3.png',
            crew_credit: 110,
            role_description: '服务员',
            distance: 2.5,
            meeting_location_name: '解放碑商圈',
            meeting_time: Date.now() + 24 * 60 * 60 * 1000,
            people_needed: 2,
            welfare_tags: ['meal'],
            price_amount: 12000,
            price_type: 'daily',
            order_type: 'reservation'
          }
        ]

        if (reset) {
          this.jobList = mockJobs
        } else {
          this.jobList.push(...mockJobs)
        }

        this.page++
        this.hasMore = mockJobs.length === this.pageSize
      } catch (error) {
        console.error('加载订单失败:', error)
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    },

    // ========== 筛选相关 ==========
    selectFilter(value) {
      this.selectedFilter = value
      this.loadJobs(true)
    },

    showFilterDrawer() {
      // 复制当前筛选条件到临时变量
      this.tempFilters = JSON.parse(JSON.stringify(this.filters))
      this.$refs.filterPopup.open()
    },

    setTempFilter(key, value) {
      this.tempFilters[key] = value
    },

    toggleWelfareFilter(value) {
      const index = this.tempFilters.welfare.indexOf(value)
      if (index > -1) {
        this.tempFilters.welfare.splice(index, 1)
      } else {
        this.tempFilters.welfare.push(value)
      }
    },

    resetFilters() {
      this.tempFilters = {
        distance: 0,
        price: 0,
        welfare: []
      }
    },

    applyFilters() {
      this.filters = JSON.parse(JSON.stringify(this.tempFilters))
      this.$refs.filterPopup.close()
      this.loadJobs(true)
    },

    // ========== 列表操作 ==========
    onRefresh() {
      this.refreshing = true
      this.loadJobs(true)
      this.loadStats()
      setTimeout(() => {
        this.refreshing = false
        uni.stopPullDownRefresh()
      }, 1000)
    },

    loadMore() {
      if (!this.hasMore) return
      this.loadJobs()
    },

    // ========== 个人资料 ==========
    goToProfile() {
      uni.navigateTo({
        url: '/pages/actor/profile'
      })
    },

    // ========== 订单操作 ==========
    viewJobDetail(job) {
      uni.navigateTo({
        url: `/pages/actor/job_detail?id=${job._id}`
      })
    },

    async grabOrder(job) {
      // 防止事件冒泡
      uni.showModal({
        title: '确认抢单',
        content: `确定要抢【${job.role_description || '群众演员'}】的单吗？`,
        success: (res) => {
          if (res.confirm) {
            // TODO: 调用后端接口抢单
            uni.showToast({
              title: '抢单成功！',
              icon: 'success'
            })
            // 跳转到订单详情或我的订单
            setTimeout(() => {
              uni.navigateTo({
                url: `/pages/actor/my_orders`
              })
            }, 1500)
          }
        }
      })
    },

    // ========== 工具方法 ==========
    getCreditBadgeClass(score) {
      if (score >= 130) return 'badge-gold'
      if (score >= 110) return 'badge-silver'
      return 'badge-normal'
    },

    getCreditLabel(score) {
      if (score >= 130) return '金牌'
      if (score >= 110) return '优质'
      return '良好'
    },

    getWelfareText(tag) {
      const textMap = {
        meal: '包盒饭',
        taxi: '报销路费',
        accommodation: '提供住宿',
        tea: '有下午茶',
        other: '其他福利'
      }
      return textMap[tag] || tag
    },

    formatJobTime(timestamp) {
      const date = new Date(timestamp)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
      const jobDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

      const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`

      if (jobDate.getTime() === today.getTime()) {
        return `今天 ${timeStr}`
      } else if (jobDate.getTime() === tomorrow.getTime()) {
        return `明天 ${timeStr}`
      } else {
        return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.actor-home {
  width: 100%;
  min-height: 100vh;
  background-color: $bg-primary;
  padding-bottom: 20rpx;
  position: relative;
}

// ========== 我的图标 ==========
.my-profile-icon {
  position: absolute;
  top: 32rpx;
  left: 32rpx;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  padding: 12rpx 16rpx;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 16rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);

  &:active {
    opacity: 0.8;
  }

  .my-text {
    font-size: 20rpx;
    color: $black;
    font-weight: $font-weight-medium;
  }
}

// ========== 统计头部 ==========
.stats-header {
  display: flex;
  background: linear-gradient(135deg, $primary-color 0%, #FFED4E 100%);
  padding: $spacing-lg $spacing-base;
  padding-top: 96rpx;
  margin-bottom: $spacing-base;
}

.stat-card {
  flex: 1;
  @include flex-center;
  @include flex-column;
  gap: 8rpx;

  .stat-value {
    font-size: 40rpx;
    font-weight: $font-weight-bold;
    color: $black;
    font-family: $font-family-monospace;
  }

  .stat-label {
    font-size: $font-size-xs;
    color: rgba(0, 0, 0, 0.7);
  }
}

.stat-divider {
  width: 1rpx;
  background-color: rgba(0, 0, 0, 0.1);
  margin: 0 $spacing-base;
}

// ========== 筛选栏 ==========
.filter-bar {
  display: flex;
  align-items: center;
  padding: $spacing-sm $spacing-base;
  background-color: $bg-secondary;
  margin-bottom: $spacing-sm;
  gap: $spacing-sm;
}

.filter-scroll {
  flex: 1;
  white-space: nowrap;
}

.filter-tags {
  display: inline-flex;
  gap: $spacing-sm;
}

.filter-tag {
  display: inline-block;
  padding: 8rpx 24rpx;
  background-color: $bg-tertiary;
  border-radius: $border-radius-base;
  color: $text-secondary;
  font-size: $font-size-sm;
  white-space: nowrap;

  &.active {
    background-color: $primary-color;
    color: $black;
  }
}

.filter-icon {
  @include flex-center;
  width: 64rpx;
  height: 64rpx;
  background-color: $bg-tertiary;
  border-radius: $border-radius-base;
}

// ========== 订单列表 ==========
.order-list-container {
  height: calc(100vh - 280rpx);
}

.job-list {
  padding: 0 $spacing-base;
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

.job-card {
  @include card;
  display: flex;
  gap: $spacing-base;
  position: relative;

  &:active {
    opacity: 0.8;
  }
}

// 左侧：剧组信息
.job-left {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;

  .crew-avatar {
    width: 100rpx;
    height: 100rpx;
    border-radius: $border-radius-circle;
    background-color: $gray-4;
  }

  .credit-badge {
    padding: 4rpx 12rpx;
    border-radius: $border-radius-sm;
    font-size: $font-size-xs;
    font-weight: $font-weight-bold;

    &.badge-gold {
      @include credit-badge('gold');
    }

    &.badge-silver {
      @include credit-badge('silver');
    }

    &.badge-normal {
      @include credit-badge('normal');
    }
  }
}

// 中间：订单详情
.job-middle {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  min-width: 0;  // 防止文本溢出
}

.job-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $spacing-sm;

  .job-title {
    font-size: $font-size-lg;
    font-weight: $font-weight-bold;
    color: $text-primary;
    @include text-ellipsis;
  }

  .job-distance {
    font-size: $font-size-sm;
    color: $secondary-color;
    font-family: $font-family-monospace;
    flex-shrink: 0;
  }
}

.job-info-row {
  display: flex;
  align-items: center;
  gap: 8rpx;

  text {
    font-size: $font-size-sm;
    color: $text-secondary;
    @include text-ellipsis;
  }
}

.welfare-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 4rpx;
}

.welfare-tag {
  @include welfare-tag;
  padding: 4rpx 12rpx;
  font-size: $font-size-xs;

  &.selected {
    background-color: $primary-color;
    color: $black;
  }
}

// 右侧：价格和按钮
.job-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12rpx;
  flex-shrink: 0;
}

.price-section {
  display: flex;
  align-items: baseline;
  gap: 4rpx;

  .price-amount {
    font-size: 44rpx;
    font-weight: $font-weight-bold;
    color: $primary-color;
    font-family: $font-family-monospace;
  }

  .price-unit {
    font-size: $font-size-xs;
    color: $text-secondary;
  }
}

.grab-btn {
  @include button-primary;
  padding: 12rpx 32rpx;
  font-size: $font-size-base;
}

.order-type-tag {
  padding: 4rpx 12rpx;
  border-radius: $border-radius-sm;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;

  &.immediate {
    @include status-tag($alert-color);
  }

  &.reservation {
    @include status-tag($secondary-color);
  }
}

// ========== 空状态 ==========
.empty-state {
  @include flex-center;
  @include flex-column;
  padding: $spacing-xxl;
  gap: $spacing-base;

  .empty-text {
    font-size: $font-size-lg;
    color: $text-secondary;
  }

  .empty-hint {
    font-size: $font-size-sm;
    color: $text-hint;
  }
}

// ========== 加载更多 ==========
.load-more {
  @include flex-center;
  padding: $spacing-lg;
  gap: $spacing-sm;

  .load-more-text {
    font-size: $font-size-sm;
    color: $text-hint;
  }
}

// ========== 筛选抽屉 ==========
.filter-drawer {
  background-color: $bg-secondary;
  border-radius: $border-radius-lg $border-radius-lg 0 0;
  max-height: 70vh;
  overflow: hidden;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-lg;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);

  .drawer-title {
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    color: $text-primary;
  }

  .drawer-actions {
    display: flex;
    gap: $spacing-lg;
  }

  .drawer-action {
    font-size: $font-size-base;
    padding: 8rpx 24rpx;
    border-radius: $border-radius-sm;

    &.reset {
      color: $text-secondary;
    }

    &.confirm {
      background-color: $primary-color;
      color: $black;
      font-weight: $font-weight-bold;
    }
  }
}

.filter-content {
  padding: $spacing-lg;
  max-height: 60vh;
  overflow-y: auto;
}

.filter-group {
  margin-bottom: $spacing-lg;

  &:last-child {
    margin-bottom: 0;
  }

  .filter-group-title {
    display: block;
    font-size: $font-size-base;
    font-weight: $font-weight-medium;
    color: $text-primary;
    margin-bottom: $spacing-base;
  }

  .filter-options {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  .filter-chip {
    padding: 12rpx 24rpx;
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
}
</style>
