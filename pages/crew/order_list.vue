<template>
  <view class="order-list-page">

    <!-- 状态筛选标签 -->
    <view class="filter-tabs">
      <scroll-view scroll-x class="tabs-scroll">
        <view class="tabs-inner">
          <view
            v-for="(tab, index) in tabs"
            :key="index"
            class="tab-item"
            :class="{ active: currentTab === index }"
            @click="switchTab(index)"
          >
            <text class="tab-text">{{ tab.name }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 订单列表 -->
    <view class="list-content">
      <view v-if="orderList.length > 0" class="order-list">
        <view
          v-for="order in orderList"
          :key="order._id"
          class="order-card"
          @click="goToDetail(order._id)"
        >
          <!-- 订单头部 -->
          <view class="order-header">
            <view class="status-badge" :class="'status-' + order.order_status">
              {{ statusTextMap[order.order_status] || '未知' }}
            </view>
            <view class="order-type-tag">
              {{ order.order_type === 'immediate' ? '即时单' : '预约单' }}
            </view>
          </view>

          <!-- 订单内容 -->
          <view class="order-body">
            <view class="info-row">
              <view class="info-icon location-icon">
                <uni-icons type="location-filled" size="16" color="#FFD700"></uni-icons>
              </view>
              <text class="info-label">集合地点</text>
              <text class="info-value">{{ order.meeting_location_name }}</text>
            </view>
            <view class="info-row">
              <view class="info-icon time-icon">
                <uni-icons type="calendar-filled" size="16" color="#2979FF"></uni-icons>
              </view>
              <text class="info-label">集合时间</text>
              <text class="info-value">{{ formatDateTime(order.meeting_time) }}</text>
            </view>
            <view class="info-row">
              <view class="info-icon people-icon">
                <uni-icons type="person-filled" size="16" color="#4CAF50"></uni-icons>
              </view>
              <text class="info-label">需要人数</text>
              <text class="info-value highlight">{{ order.people_needed }}人</text>
            </view>
          </view>

          <!-- 订单底部 -->
          <view class="order-footer">
            <view class="price-box">
              <text class="price-label">{{ order.price_type === 'daily' ? '按天' : '按时' }}</text>
              <text class="price-amount">{{ (order.price_amount / 100).toFixed(0) }}</text>
            </view>

            <view class="action-btns">
              <button
                v-if="order.order_status === 0 || order.order_status === 1"
                class="btn-cancel"
                size="mini"
                @click.stop="cancelOrder(order._id)"
              >
                取消
              </button>
              <button
                class="btn-detail"
                size="mini"
                @click.stop="goToDetail(order._id)"
              >
                详情
              </button>
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else class="empty-box">
        <view class="empty-icon">
          <uni-icons type="list" size="64" color="#666"></uni-icons>
        </view>
        <text class="empty-tip">{{ emptyTip }}</text>
        <button class="btn-post" @click="goToPost">发布需求</button>
      </view>
    </view>

  </view>
</template>

<script>
export default {
  data() {
    return {
      currentTab: 0,
      tabs: [
        { name: '全部', status: null },
        { name: '待接单', status: 0 },
        { name: '进行中', status: 1 },
        { name: '已完成', status: 3 },
        { name: '已取消', status: 4 }
      ],
      orderList: [],
      page: 1,
      pageSize: 20,
      total: 0,
      statusTextMap: {
        0: '待接单',
        1: '进行中',
        2: '待支付',
        3: '已完成',
        4: '已取消'
      }
    }
  },

  computed: {
    emptyTip() {
      const tips = {
        0: '暂无订单记录',
        1: '暂无待接单订单',
        2: '暂无进行中订单',
        3: '暂无已完成订单',
        4: '暂无已取消订单'
      }
      return tips[this.currentTab] || '暂无数据'
    }
  },

  onLoad() {
    console.log('onLoad - orderList:', this.orderList)
    this.loadOrders()
  },

  mounted() {
    console.log('mounted - orderList:', this.orderList)
  },

  onPullDownRefresh() {
    this.page = 1
    this.loadOrders()
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 1000)
  },

  onReachBottom() {
    if (this.orderList.length < this.total) {
      this.page++
      this.loadOrders(true)
    }
  },

  methods: {
    switchTab(index) {
      this.currentTab = index
      this.page = 1
      this.orderList = []
      this.loadOrders()
    },

    async loadOrders(isLoadMore = false) {
      try {
        // 检查登录状态
        const token = uni.getStorageSync('uni_id_token')
        if (!token) {
          console.log('loadOrders: 未登录')
          this.orderList = []
          return
        }

        if (!isLoadMore) {
          uni.showLoading({ title: '加载中...' })
        }

        const orderCo = uniCloud.importObject('order-co')
        const params = {
          page: this.page,
          pageSize: this.pageSize
        }

        const currentStatus = this.tabs[this.currentTab].status
        if (currentStatus !== null) {
          params.status = currentStatus
        }

        console.log('loadOrders params:', params)
        const res = await orderCo.getMyOrders(params)
        console.log('loadOrders result:', res)
        console.log('loadOrders list:', res.data ? res.data.list : 'no data')
        console.log('loadOrders list length:', res.data && res.data.list ? res.data.list.length : 0)

        uni.hideLoading()

        if (res.code === 0) {
          const list = res.data.list || []
          console.log('Setting orderList:', list)
          if (isLoadMore) {
            this.orderList = [...this.orderList, ...list]
          } else {
            this.orderList = list
          }
          this.total = res.data.total || 0
          console.log('After set, orderList:', this.orderList)
        } else if (res.code === 401) {
          // 未登录，跳转到登录页
          uni.showToast({
            title: '请先登录',
            icon: 'none'
          })
          setTimeout(() => {
            uni.navigateTo({
              url: '/uni_modules/uni-id-pages/pages/login/login-withpwd'
            })
          }, 1500)
        } else {
          uni.showToast({
            title: res.message || '加载失败',
            icon: 'none'
          })
        }
      } catch (error) {
        uni.hideLoading()
        console.error('加载订单失败:', error)
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    },

    cancelOrder(orderId) {
      uni.showModal({
        title: '确认取消',
        content: '确定要取消这个订单吗?',
        success: async (res) => {
          if (res.confirm) {
            try {
              uni.showLoading({ title: '处理中...' })

              const orderCo = uniCloud.importObject('order-co')
              const result = await orderCo.cancel(orderId, '剧组主动取消')

              uni.hideLoading()

              if (result.code === 0) {
                uni.showToast({
                  title: '已取消',
                  icon: 'success'
                })
                this.loadOrders()
              } else {
                uni.showToast({
                  title: result.message || '取消失败',
                  icon: 'none'
                })
              }
            } catch (error) {
              uni.hideLoading()
              console.error('取消订单失败:', error)
              uni.showToast({
                title: '操作失败',
                icon: 'none'
              })
            }
          }
        }
      })
    },

    goToDetail(orderId) {
      uni.navigateTo({
        url: `/pages/crew/order_detail?id=${orderId}`
      })
    },

    goToPost() {
      uni.navigateTo({
        url: '/pages/crew/post_order'
      })
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

    formatDateTime(timestamp) {
      const date = new Date(timestamp)
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      const hour = date.getHours().toString().padStart(2, '0')
      const minute = date.getMinutes().toString().padStart(2, '0')
      return `${month}-${day} ${hour}:${minute}`
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.order-list-page {
  min-height: 100vh;
  background-color: $bg-primary;
}

// 筛选标签
.filter-tabs {
  background-color: $bg-secondary;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 10;

  .tabs-scroll {
    width: 100%;
    white-space: nowrap;
  }

  .tabs-inner {
    display: inline-flex;
    padding: 0 $spacing-base;
    gap: $spacing-sm;
  }

  .tab-item {
    flex-shrink: 0;
    padding: $spacing-sm $spacing-lg;
    border-radius: $border-radius-base;
    font-size: $font-size-sm;
    color: $text-secondary;
    background-color: $bg-tertiary;
    transition: all 0.3s;

    &.active {
      background: linear-gradient(135deg, $primary-color 0%, #FFED4E 100%);
      color: $black;
      font-weight: $font-weight-bold;
    }
  }
}

// 列表内容
.list-content {
  padding: $spacing-base;
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

.order-card {
  @include card;

  &:active {
    opacity: 0.9;
    transform: scale(0.99);
  }
}

.order-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-base;
  padding-bottom: $spacing-base;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);

  .status-badge {
    padding: 6rpx 16rpx;
    border-radius: $border-radius-sm;
    font-size: $font-size-xs;
    font-weight: $font-weight-bold;

    &.status-0 {
      background-color: rgba($warning-color, 0.15);
      color: $warning-color;
      border: 1rpx solid $warning-color;
    }

    &.status-1 {
      background-color: rgba($secondary-color, 0.15);
      color: $secondary-color;
      border: 1rpx solid $secondary-color;
    }

    &.status-2 {
      background-color: rgba($info-color, 0.15);
      color: $info-color;
      border: 1rpx solid $info-color;
    }

    &.status-3 {
      background-color: rgba($success-color, 0.15);
      color: $success-color;
      border: 1rpx solid $success-color;
    }

    &.status-4 {
      background-color: rgba($alert-color, 0.15);
      color: $alert-color;
      border: 1rpx solid $alert-color;
    }
  }

  .order-type-tag {
    padding: 6rpx 16rpx;
    background-color: $bg-tertiary;
    border-radius: $border-radius-sm;
    font-size: $font-size-xs;
    color: $text-secondary;
  }
}

.order-body {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  margin-bottom: $spacing-base;
}

.info-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;

  .info-icon {
    width: 40rpx;
    height: 40rpx;
    border-radius: $border-radius-sm;
    @include flex-center;
    flex-shrink: 0;
  }

  .info-label {
    font-size: $font-size-sm;
    color: $text-hint;
    width: 120rpx;
    flex-shrink: 0;
  }

  .info-value {
    flex: 1;
    font-size: $font-size-base;
    color: $text-primary;
    @include text-ellipsis;

    &.highlight {
      color: $primary-color;
      font-weight: $font-weight-medium;
    }
  }
}

.order-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: $spacing-base;
  border-top: 1rpx solid rgba(255, 255, 255, 0.1);
}

.price-box {
  display: flex;
  align-items: baseline;
  gap: $spacing-xs;

  .price-label {
    font-size: $font-size-xs;
    color: $text-hint;
  }

  .price-amount {
    font-size: $font-size-xxl;
    font-weight: $font-weight-bold;
    color: $primary-color;
    font-family: $font-family-monospace;

    &::before {
      content: '\00A5';
      font-size: $font-size-lg;
    }
  }
}

.action-btns {
  display: flex;
  gap: $spacing-sm;

  .btn-cancel {
    padding: $spacing-xs $spacing-base;
    background-color: transparent;
    border: 1rpx solid rgba(255, 255, 255, 0.3);
    border-radius: $border-radius-sm;
    color: $text-secondary;
    font-size: $font-size-sm;

    &:active {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }

  .btn-detail {
    padding: $spacing-xs $spacing-base;
    background: linear-gradient(135deg, $primary-color 0%, #FFED4E 100%);
    border: none;
    border-radius: $border-radius-sm;
    color: $black;
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;

    &:active {
      opacity: 0.8;
    }
  }
}

// 空状态
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-xxl $spacing-base;

  .empty-icon {
    width: 160rpx;
    height: 160rpx;
    background-color: $bg-tertiary;
    border-radius: $border-radius-circle;
    @include flex-center;
    margin-bottom: $spacing-lg;
  }

  .empty-tip {
    font-size: $font-size-base;
    color: $text-secondary;
    margin-bottom: $spacing-lg;
  }

  .btn-post {
    @include button-primary;
    padding: $spacing-sm $spacing-xl;
  }
}
</style>
