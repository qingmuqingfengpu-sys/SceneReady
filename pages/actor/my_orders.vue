<template>
  <view class="my-orders-page">
    <!-- 状态筛选 -->
    <view class="status-tabs">
      <scroll-view scroll-x class="tabs-scroll">
        <view
          v-for="tab in statusTabs"
          :key="tab.value"
          class="tab-item"
          :class="{ active: currentStatus === tab.value }"
          @tap="switchStatus(tab.value)"
        >
          <text>{{ tab.label }}</text>
          <view v-if="tab.count > 0" class="tab-badge">{{ tab.count }}</view>
        </view>
      </scroll-view>
    </view>

    <!-- 订单列表 -->
    <scroll-view
      scroll-y
      class="order-list"
      @scrolltolower="loadMore"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <view v-if="orderList.length > 0" class="list-content">
        <view
          v-for="order in orderList"
          :key="order._id"
          class="order-card"
          @tap="goToDetail(order)"
        >
          <!-- 订单头部 -->
          <view class="order-header">
            <view class="order-type" :class="order.order_type === 1 ? 'instant' : 'scheduled'">
              {{ order.order_type === 1 ? '即时单' : '预约单' }}
            </view>
            <view class="order-status" :class="statusClassMap[order.order_status]">
              {{ getStatusText(order) }}
            </view>
          </view>

          <!-- 订单内容 -->
          <view class="order-body">
            <view class="order-info">
              <view class="info-row">
                <uni-icons type="location" size="16" color="#999"></uni-icons>
                <text class="info-text">{{ order.meeting_location_name }}</text>
              </view>
              <view class="info-row">
                <uni-icons type="calendar" size="16" color="#999"></uni-icons>
                <text class="info-text">{{ formatDateTime(order.work_start_time) }}</text>
              </view>
            </view>
            <view class="order-price">
              <text class="price-value">{{ formatPrice(order.price_amount) }}</text>
              <text class="price-unit">/{{ order.price_unit === 'day' ? '天' : '时' }}</text>
            </view>
          </view>

          <!-- 订单底部 -->
          <view class="order-footer">
            <text class="order-time">{{ formatRelativeTime(order.create_time) }}</text>
            <view class="order-actions">
              <!-- 进行中状态 -->
              <template v-if="order.order_status === 1">
                <button class="action-btn primary" @tap.stop="goToTracking(order)">履约追踪</button>
              </template>
              <!-- 已完成状态 -->
              <template v-else-if="order.order_status === 3">
                <button class="action-btn" @tap.stop="rateOrder(order)" v-if="!order.is_rated">去评价</button>
                <button class="action-btn" @tap.stop="viewDetail(order)" v-else>查看详情</button>
              </template>
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else-if="!loading" class="empty-state">
        <uni-icons type="list" size="64" color="#666"></uni-icons>
        <text class="empty-text">暂无订单</text>
        <button class="btn-primary" @tap="goToFindJobs">去找工作</button>
      </view>

      <!-- 加载更多 -->
      <uni-load-more
        v-if="orderList.length > 0"
        :status="loadMoreStatus"
        :content-text="loadMoreText"
      ></uni-load-more>
    </scroll-view>

    <!-- 评价弹窗 -->
    <uni-popup ref="ratePopup" type="bottom">
      <view class="rate-popup">
        <view class="rate-header">
          <text class="rate-title">评价订单</text>
          <view class="rate-close" @tap="closeRatePopup">
            <uni-icons type="close" size="24" color="#fff"></uni-icons>
          </view>
        </view>
        <view class="rate-content">
          <view class="rate-item">
            <text class="rate-label">整体评分</text>
            <view class="star-rating">
              <view
                v-for="i in 5"
                :key="i"
                class="star-item"
                @tap="setRating(i)"
              >
                <uni-icons
                  :type="i <= rating ? 'star-filled' : 'star'"
                  size="32"
                  :color="i <= rating ? '#FFD700' : '#666'"
                ></uni-icons>
              </view>
            </view>
          </view>
          <view class="rate-item">
            <text class="rate-label">评价内容（选填）</text>
            <textarea class="rate-textarea" v-model="rateComment" placeholder="请输入您对剧组的评价..." maxlength="200"></textarea>
          </view>
          <button class="btn-primary rate-submit" @tap="submitRating">提交评价</button>
        </view>
      </view>
    </uni-popup>

    <!-- 底部 TabBar -->
    <custom-tabbar role="actor" :current="1" @refresh="refreshOrders"></custom-tabbar>
  </view>
</template>

<script>
export default {
  data() {
    return {
      statusTabs: [
        { label: '全部', value: -1, count: 0 },
        { label: '进行中', value: 1, count: 0 },
        { label: '已完成', value: 3, count: 0 },
        { label: '已取消', value: 4, count: 0 }
      ],
      currentStatus: -1,
      orderList: [],
      loading: false,
      refreshing: false,
      page: 1,
      pageSize: 10,
      hasMore: true,
      loadMoreStatus: 'more',
      loadMoreText: {
        contentdown: '上拉加载更多',
        contentrefresh: '加载中...',
        contentnomore: '没有更多了'
      },
      statusClassMap: {
        0: 'pending',
        1: 'ongoing',
        3: 'completed',
        4: 'canceled'
      },
      // 评价相关
      rating: 5,
      rateComment: '',
      ratingOrderId: ''
    }
  },

  onLoad(options) {
    if (options.status !== undefined) {
      this.currentStatus = parseInt(options.status)
    }
    this.loadOrders()
    this.loadStatusCounts()
  },

  onShow() {
    // 每次显示时刷新数据
    this.refreshOrders()
  },

  onPullDownRefresh() {
    this.refreshOrders()
  },

  methods: {
    async loadOrders() {
      if (this.loading) return

      try {
        this.loading = true
        const db = uniCloud.database()
        const userInfo = await uniCloud.getCurrentUserInfo()
        const userId = userInfo.uid

        if (!userId) {
          uni.showToast({
            title: '请先登录',
            icon: 'none'
          })
          return
        }

        // 构建查询条件，确保始终包含 receiver_id
        let whereCondition = {
          receiver_id: userId
        }

        // 状态筛选
        if (this.currentStatus !== -1) {
          whereCondition.order_status = this.currentStatus
        }

        const res = await db.collection('orders').where(whereCondition)
          .orderBy('create_time', 'desc')
          .skip((this.page - 1) * this.pageSize)
          .limit(this.pageSize)
          .get()

        const list = res.result.data || []

        if (this.page === 1) {
          this.orderList = list
        } else {
          this.orderList = [...this.orderList, ...list]
        }

        this.hasMore = list.length === this.pageSize
        this.loadMoreStatus = this.hasMore ? 'more' : 'noMore'
      } catch (error) {
        console.error('加载订单失败:', error)
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      } finally {
        this.loading = false
        this.refreshing = false
        uni.stopPullDownRefresh()
      }
    },

    async loadStatusCounts() {
      try {
        const db = uniCloud.database()
        const userInfo = await uniCloud.getCurrentUserInfo()
        const userId = userInfo.uid

        if (!userId) return

        // 并行查询各状态数量
        const [allRes, ongoingRes, completedRes, canceledRes] = await Promise.all([
          db.collection('orders').where({ receiver_id: userId }).count(),
          db.collection('orders').where({ receiver_id: userId, order_status: 1 }).count(),
          db.collection('orders').where({ receiver_id: userId, order_status: 3 }).count(),
          db.collection('orders').where({ receiver_id: userId, order_status: 4 }).count()
        ])

        this.statusTabs[0].count = allRes.total
        this.statusTabs[1].count = ongoingRes.total
        this.statusTabs[2].count = completedRes.total
        this.statusTabs[3].count = canceledRes.total
      } catch (error) {
        console.error('加载状态数量失败:', error)
      }
    },

    switchStatus(status) {
      if (this.currentStatus === status) return
      this.currentStatus = status
      this.page = 1
      this.orderList = []
      this.loadOrders()
    },

    onRefresh() {
      this.refreshing = true
      this.refreshOrders()
    },

    refreshOrders() {
      this.page = 1
      this.hasMore = true
      this.loadOrders()
      this.loadStatusCounts()
    },

    loadMore() {
      if (!this.hasMore || this.loading) return
      this.page++
      this.loadMoreStatus = 'loading'
      this.loadOrders()
    },

    // 工具方法
    getStatusText(order) {
      const status = order.order_status
      // 处理取消状态的细分显示
      if (status === 4) {
        if (order.actor_cancel_reason) {
          return '已取消(无法到达)'
        }
        if (order.cancel_by === order.publisher_id) {
          return '剧组已取消'
        }
        return '已取消'
      }
      const textMap = {
        0: '待接单',
        1: '进行中',
        3: '已完成'
      }
      return textMap[status] || '未知'
    },

    getStatusClass(status) {
      const classMap = {
        0: 'pending',
        1: 'ongoing',
        3: 'completed',
        4: 'canceled'
      }
      return classMap[status] || ''
    },

    formatPrice(amount) {
      if (!amount) return '0'
      return (amount / 100).toFixed(0)
    },

    formatDateTime(timestamp) {
      if (!timestamp) return '待定'
      const date = new Date(timestamp)
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      return `${month}-${day} ${hour}:${minute}`
    },

    formatRelativeTime(timestamp) {
      const now = Date.now()
      const diff = now - timestamp

      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

      const date = new Date(timestamp)
      return `${date.getMonth() + 1}-${date.getDate()}`
    },

    // 操作方法
    goToDetail(order) {
      uni.navigateTo({
        url: `/pages/actor/job_detail?id=${order._id}`
      })
    },

    goToTracking(order) {
      uni.navigateTo({
        url: `/pages/actor/order_tracking?id=${order._id}`
      })
    },

    rateOrder(order) {
      this.ratingOrderId = order._id
      this.rating = 5
      this.rateComment = ''
      this.$refs.ratePopup.open()
    },

    closeRatePopup() {
      this.$refs.ratePopup.close()
    },

    setRating(value) {
      this.rating = value
    },

    async submitRating() {
      if (this.rating < 1) {
        uni.showToast({
          title: '请选择评分',
          icon: 'none'
        })
        return
      }

      uni.showLoading({ title: '提交中...', mask: true })

      try {
        const orderCo = uniCloud.importObject('order-co')
        const res = await orderCo.rateOrder(this.ratingOrderId, {
          score: this.rating,
          comment: this.rateComment || ''
        })

        uni.hideLoading()

        if (res.code === 0) {
          uni.showToast({
            title: '评价成功',
            icon: 'success'
          })
          // 更新本地订单的评价状态
          const order = this.orderList.find(o => o._id === this.ratingOrderId)
          if (order) {
            order.is_rated = true
          }
          this.$refs.ratePopup.close()
        } else {
          uni.showToast({
            title: res.message || '评价失败',
            icon: 'none'
          })
        }
      } catch (error) {
        uni.hideLoading()
        console.error('提交评价失败:', error)
        uni.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        })
      }
    },

    viewDetail(order) {
      this.goToDetail(order)
    },

    goToFindJobs() {
      uni.reLaunch({
        url: '/pages/actor/index'
      })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.my-orders-page {
  min-height: 100vh;
  background-color: $bg-primary;
  display: flex;
  flex-direction: column;
  padding-bottom: 120rpx; // TabBar 空间
}

// 状态筛选
.status-tabs {
  background-color: $bg-secondary;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);
}

.tabs-scroll {
  white-space: nowrap;
  padding: $spacing-sm $spacing-base;
}

.tab-item {
  display: inline-flex;
  align-items: center;
  padding: $spacing-sm $spacing-lg;
  margin-right: $spacing-sm;
  border-radius: $border-radius-base;
  background-color: $bg-tertiary;
  color: $text-secondary;
  font-size: $font-size-sm;

  &.active {
    background-color: rgba($primary-color, 0.15);
    color: $primary-color;
  }

  .tab-badge {
    min-width: 32rpx;
    height: 32rpx;
    padding: 0 8rpx;
    margin-left: 8rpx;
    background-color: $alert-color;
    border-radius: 16rpx;
    color: $white;
    font-size: $font-size-xs;
    @include flex-center;
  }
}

// 订单列表
.order-list {
  flex: 1;
  padding: $spacing-base;
}

.list-content {
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

// 订单卡片
.order-card {
  @include card;

  &:active {
    opacity: 0.9;
  }
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-base;
  padding-bottom: $spacing-sm;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);

  .order-type {
    padding: 4rpx 12rpx;
    border-radius: $border-radius-sm;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;

    &.instant {
      background-color: rgba($alert-color, 0.15);
      color: $alert-color;
    }

    &.scheduled {
      background-color: rgba($secondary-color, 0.15);
      color: $secondary-color;
    }
  }

  .order-status {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;

    &.pending {
      color: $warning-color;
    }

    &.ongoing {
      color: $secondary-color;
    }

    &.completed {
      color: $success-color;
    }

    &.canceled {
      color: $text-secondary;
    }
  }
}

.order-body {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: $spacing-base;

  .order-info {
    flex: 1;
    @include flex-column;
    gap: 8rpx;

    .info-row {
      display: flex;
      align-items: center;
      gap: 8rpx;

      .info-text {
        font-size: $font-size-sm;
        color: $text-secondary;
        @include text-ellipsis;
      }
    }
  }

  .order-price {
    display: flex;
    align-items: baseline;
    flex-shrink: 0;

    .price-value {
      font-size: 40rpx;
      font-weight: $font-weight-bold;
      color: $primary-color;
      font-family: $font-family-monospace;

      &::before {
        content: '¥';
        font-size: $font-size-base;
      }
    }

    .price-unit {
      font-size: $font-size-sm;
      color: $text-secondary;
    }
  }
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: $spacing-sm;
  border-top: 1rpx solid rgba(255, 255, 255, 0.05);

  .order-time {
    font-size: $font-size-xs;
    color: $text-hint;
  }

  .order-actions {
    display: flex;
    gap: $spacing-sm;

    .action-btn {
      padding: 8rpx 24rpx;
      border-radius: $border-radius-sm;
      background-color: $bg-tertiary;
      color: $text-secondary;
      font-size: $font-size-sm;
      line-height: 1.5;

      &.primary {
        background-color: $primary-color;
        color: $black;
        font-weight: $font-weight-bold;
      }
    }
  }
}

// 空状态
.empty-state {
  @include flex-center;
  @include flex-column;
  padding: 120rpx 0;
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

// 评价弹窗
.rate-popup {
  background-color: $bg-secondary;
  border-radius: $border-radius-lg $border-radius-lg 0 0;
  padding-bottom: env(safe-area-inset-bottom);

  .rate-header {
    position: relative;
    padding: $spacing-lg;
    background: linear-gradient(135deg, $primary-color 0%, #FFED4E 100%);
    text-align: center;

    .rate-title {
      font-size: $font-size-xl;
      font-weight: $font-weight-bold;
      color: $black;
    }

    .rate-close {
      position: absolute;
      right: $spacing-lg;
      top: $spacing-lg;
    }
  }

  .rate-content {
    padding: $spacing-lg;
  }

  .rate-item {
    margin-bottom: $spacing-lg;

    .rate-label {
      display: block;
      font-size: $font-size-base;
      color: $text-secondary;
      margin-bottom: $spacing-sm;
    }
  }

  .star-rating {
    display: flex;
    gap: $spacing-sm;

    .star-item {
      padding: $spacing-xs;
    }
  }

  .rate-textarea {
    width: 100%;
    height: 200rpx;
    padding: $spacing-base;
    background-color: $bg-tertiary;
    border-radius: $border-radius-base;
    color: $text-primary;
    font-size: $font-size-base;
  }

  .rate-submit {
    @include button-primary;
    width: 100%;
    margin-top: $spacing-base;
  }
}
</style>
