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
      <!-- 首次加载状态 -->
      <view v-if="loading && jobList.length === 0" class="loading-state">
        <view class="loading-spinner"></view>
        <text class="loading-text">加载中...</text>
      </view>

      <view v-else-if="jobList.length > 0" class="job-list">
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
              <text v-if="job.distance" class="job-distance">{{ job.distance }}km</text>
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
      <view v-else-if="!loading" class="empty-state">
        <uni-icons type="info-filled" size="64" color="#666"></uni-icons>
        <text class="empty-text">暂无可接订单</text>
        <text class="empty-hint">试试调整筛选条件或稍后再来</text>
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
      // 登录状态
      isLoggedIn: false,

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
      loading: false,
      statsLoading: false,

      // 用户位置
      userLocation: {
        longitude: null,
        latitude: null
      },

      // 用户信息
      userInfo: {}
    }
  },

  async onLoad() {
    // 检查登录状态（不强制跳转，游客可浏览）
    this.isLoggedIn = this.checkLoginStatus()

    // 获取用户位置
    this.getUserLocation()

    // 游客也可以浏览工作列表
    this.loadJobs()

    // 已登录用户加载个人数据
    if (this.isLoggedIn) {
      this.loadUserInfo()
      this.loadStats()
    }
  },

  onPullDownRefresh() {
    this.onRefresh()
  },

  methods: {
    // ========== 登录检查 ==========
    // 检查登录状态（不强制跳转）
    checkLoginStatus() {
      try {
        const token = uni.getStorageSync('uni_id_token')
        const tokenExpired = uni.getStorageSync('uni_id_token_expired')
        // 有有效token则已登录
        return token && tokenExpired && tokenExpired > Date.now()
      } catch (error) {
        console.error('检查登录状态失败:', error)
        return false
      }
    },

    // 需要登录时调用，引导用户登录
    requireLogin(actionName = '此操作') {
      if (this.isLoggedIn) return true

      uni.showModal({
        title: '需要登录',
        content: `${actionName}需要登录后才能使用，是否现在登录？`,
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            // 记录当前角色，登录后返回
            uni.setStorageSync('selected_role', 'actor')
            uni.navigateTo({
              url: '/uni_modules/uni-id-pages/pages/login/login-withpwd'
            })
          }
        }
      })
      return false
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
      this.statsLoading = true
      try {
        const userCo = uniCloud.importObject('user-co')
        const res = await userCo.getStats()

        if (res.code === 0 && res.data) {
          this.stats = {
            available: res.data.available_jobs || 0,
            ongoing: res.data.in_progress || 0,
            earned: parseFloat(res.data.total_income) || 0
          }
        } else {
          console.error('获取统计数据失败:', res.message)
          // 显示默认值
          this.stats = { available: 0, ongoing: 0, earned: 0 }
        }
      } catch (error) {
        console.error('加载统计失败:', error)
        uni.showToast({
          title: '统计数据加载失败',
          icon: 'none'
        })
        this.stats = { available: 0, ongoing: 0, earned: 0 }
      } finally {
        this.statsLoading = false
      }
    },

    async loadJobs(reset = false) {
      if (reset) {
        this.page = 1
        this.hasMore = true
        this.jobList = []
      }

      if (this.loading) return
      this.loading = true

      try {
        const orderCo = uniCloud.importObject('order-co')

        // 构建查询参数
        const params = {
          page: this.page,
          pageSize: this.pageSize
        }

        // 添加位置信息（如果有）
        if (this.userLocation.longitude && this.userLocation.latitude) {
          params.longitude = this.userLocation.longitude
          params.latitude = this.userLocation.latitude
        }

        // 根据筛选条件添加参数
        if (this.selectedFilter === 'nearby' && this.userLocation.longitude) {
          params.maxDistance = 3000 // 3km
        } else if (this.selectedFilter === 'high_price') {
          params.minPrice = 150 // 150元以上
        } else if (this.selectedFilter === 'today') {
          params.dateFilter = 'today'
        } else if (this.selectedFilter === 'immediate') {
          params.orderType = 'immediate'
        }

        // 高级筛选条件
        if (this.filters.distance > 0) {
          const distanceMap = { 1: 3000, 2: 5000, 3: 10000 }
          params.maxDistance = distanceMap[this.filters.distance]
        }
        if (this.filters.price > 0) {
          const priceMap = {
            1: { max: 100 },
            2: { min: 100, max: 200 },
            3: { min: 200 }
          }
          if (priceMap[this.filters.price].min) params.minPrice = priceMap[this.filters.price].min
          if (priceMap[this.filters.price].max) params.maxPrice = priceMap[this.filters.price].max
        }
        if (this.filters.welfare && this.filters.welfare.length > 0) {
          params.welfare = this.filters.welfare
        }

        const res = await orderCo.getAvailableJobs(params)

        if (res.code === 0 && res.data) {
          // 转换数据格式以适配前端显示
          const jobs = res.data.list.map(job => ({
            _id: job._id,
            crew_avatar: job.publisher_info?.avatar || '/static/default-crew.png',
            crew_credit: job.publisher_info?.credit_score || 100,
            role_description: job.role_description || '群众演员',
            distance: job.distance_km ? parseFloat(job.distance_km) : null,
            meeting_location_name: job.meeting_location_name,
            meeting_time: job.meeting_time,
            people_needed: job.people_needed,
            welfare_tags: job.welfare_tags || [],
            price_amount: job.price_amount,
            price_type: job.price_type,
            order_type: job.order_type
          }))

          if (reset) {
            this.jobList = jobs
          } else {
            this.jobList.push(...jobs)
          }

          this.page++
          this.hasMore = jobs.length === this.pageSize
        } else {
          console.error('获取订单列表失败:', res.message)
          if (reset) {
            this.jobList = []
          }
          this.hasMore = false
          if (res.code === 401) {
            uni.showToast({ title: '请先登录', icon: 'none' })
          }
        }
      } catch (error) {
        console.error('加载订单失败:', error)
        uni.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        })
        this.hasMore = false
      } finally {
        this.loading = false
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

    // ========== 获取用户位置 ==========
    getUserLocation() {
      uni.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 4000,
        success: (res) => {
          this.userLocation = {
            longitude: res.longitude,
            latitude: res.latitude
          }
          console.log('获取位置成功:', this.userLocation, '精度:', res.accuracy)
        },
        fail: (err) => {
          console.warn('获取位置失败:', err)
          // 位置获取失败不阻塞页面加载，只是无法使用距离排序
        }
      })
    },

    // ========== 列表操作 ==========
    async onRefresh() {
      this.refreshing = true
      // 刷新时重新检查登录状态
      this.isLoggedIn = this.checkLoginStatus()

      try {
        // 游客只刷新工作列表，登录用户同时刷新统计
        const tasks = [this.loadJobs(true)]
        if (this.isLoggedIn) {
          tasks.push(this.loadStats())
        }
        await Promise.all(tasks)
      } finally {
        this.refreshing = false
        uni.stopPullDownRefresh()
      }
    },

    loadMore() {
      if (!this.hasMore) return
      this.loadJobs()
    },

    // ========== 个人资料 ==========
    goToProfile() {
      // 需要登录才能访问个人中心
      if (!this.requireLogin('查看个人中心')) return

      uni.navigateTo({
        url: '/pages/actor/profile'
      })
    },

    // ========== 订单操作 ==========
    viewJobDetail(job) {
      // 查看详情不需要登录，游客可浏览
      uni.navigateTo({
        url: `/pages/actor/job_detail?id=${job._id}`
      })
    },

    async grabOrder(job) {
      // 抢单需要登录
      if (!this.requireLogin('抢单')) return

      // 显示确认弹窗
      uni.showModal({
        title: '确认抢单',
        content: `确定要抢【${job.role_description || '群众演员'}】的单吗？\n报酬：${(job.price_amount / 100).toFixed(0)}元/${job.price_type === 'daily' ? '天' : '时'}`,
        success: async (modalRes) => {
          if (modalRes.confirm) {
            await this.doGrabOrder(job._id)
          }
        }
      })
    },

    async doGrabOrder(orderId) {
      uni.showLoading({ title: '抢单中...', mask: true })

      try {
        const orderCo = uniCloud.importObject('order-co')
        const res = await orderCo.grab(orderId)

        uni.hideLoading()

        if (res.code === 0) {
          // 抢单成功
          uni.showToast({
            title: '抢单成功！',
            icon: 'success'
          })

          // 刷新列表和统计
          this.loadStats()

          // 跳转到履约追踪页
          setTimeout(() => {
            uni.navigateTo({
              url: `/pages/actor/order_tracking?id=${orderId}`
            })
          }, 1500)
        } else {
          // 处理错误
          let errorMsg = res.message || '抢单失败'

          switch (res.code) {
            case 401:
              errorMsg = '请先登录'
              setTimeout(() => {
                uni.reLaunch({ url: '/pages/index/index' })
              }, 1500)
              break
            case 403:
              errorMsg = res.message || '请先完成身份认证'
              break
            case 400:
              if (res.message.includes('已被') || res.message.includes('手慢')) {
                errorMsg = '手慢了，订单已被其他人抢走'
                // 刷新列表移除已被抢的订单
                this.loadJobs(true)
              }
              break
            case 404:
              errorMsg = '订单不存在或已取消'
              this.loadJobs(true)
              break
          }

          uni.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 2500
          })
        }
      } catch (error) {
        uni.hideLoading()
        console.error('抢单失败:', error)
        uni.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        })
      }
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

// ========== 加载状态 ==========
.loading-state {
  @include flex-center;
  @include flex-column;
  padding: $spacing-xxl;
  gap: $spacing-base;

  .loading-spinner {
    width: 48rpx;
    height: 48rpx;
    border: 4rpx solid rgba(255, 215, 0, 0.3);
    border-top-color: $primary-color;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading-text {
    font-size: $font-size-sm;
    color: $text-secondary;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
