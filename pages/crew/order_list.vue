<template>
  <view class="order-list-page">

    <!-- 状态筛选标签 -->
    <view class="filter-tabs">
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
            <view class="status-badge" :class="[order.order_status === 0 ? 'status-pending' : '', order.order_status === 1 ? 'status-ongoing' : '', order.order_status === 2 ? 'status-payment' : '', order.order_status === 3 ? 'status-completed' : '', order.order_status === 4 ? 'status-canceled' : '']">
              {{ getStatusText(order.order_status) }}
            </view>
            <view class="order-type-tag">
              {{ order.order_type === 'immediate' ? '即时单' : '预约单' }}
            </view>
          </view>

          <!-- 订单内容 -->
          <view class="order-body">
            <view class="info-row">
              <uni-icons type="location-filled" size="18" color="#007aff"></uni-icons>
              <text class="info-label">集合地点:</text>
              <text class="info-value">{{ order.meeting_location_name }}</text>
            </view>
            <view class="info-row">
              <uni-icons type="calendar-filled" size="18" color="#ff9800"></uni-icons>
              <text class="info-label">集合时间:</text>
              <text class="info-value">{{ formatDateTime(order.meeting_time) }}</text>
            </view>
            <view class="info-row">
              <uni-icons type="person-filled" size="18" color="#4caf50"></uni-icons>
              <text class="info-label">需要人数:</text>
              <text class="info-value">{{ order.people_needed }}人</text>
            </view>
          </view>

          <!-- 订单底部 -->
          <view class="order-footer">
            <view class="price-box">
              <text class="price-label">{{ order.price_type === 'daily' ? '按天' : '按时' }}</text>
              <text class="price-amount">¥{{ (order.price_amount / 100).toFixed(2) }}</text>
            </view>

            <view class="action-btns">
              <button
                v-if="order.order_status === 0 || order.order_status === 1"
                class="btn-cancel"
                size="mini"
                @click.stop="cancelOrder(order._id)"
              >
                取消订单
              </button>
              <button
                class="btn-detail"
                size="mini"
                type="primary"
                @click.stop="goToDetail(order._id)"
              >
                查看详情
              </button>
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else class="empty-box">
        <image class="empty-image" src="/static/empty-list.png" mode="aspectFit"></image>
        <text class="empty-tip">{{ emptyTip }}</text>
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
      total: 0
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
    this.loadOrders()
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
    // 切换标签
    switchTab(index) {
      this.currentTab = index
      this.page = 1
      this.orderList = []
      this.loadOrders()
    },

    // 加载订单列表
    async loadOrders(isLoadMore = false) {
      try {
        if (!isLoadMore) {
          uni.showLoading({ title: '加载中...' })
        }

        const orderCo = uniCloud.importObject('order-co')
        const params = {
          page: this.page,
          pageSize: this.pageSize
        }

        // 添加状态筛选
        const currentStatus = this.tabs[this.currentTab].status
        if (currentStatus !== null) {
          params.status = currentStatus
        }

        const res = await orderCo.getMyOrders(params)

        uni.hideLoading()

        if (res.code === 0) {
          if (isLoadMore) {
            this.orderList = [...this.orderList, ...res.data.list]
          } else {
            this.orderList = res.data.list
          }
          this.total = res.data.total
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

    // 取消订单
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

    // 跳转到详情
    goToDetail(orderId) {
      uni.navigateTo({
        url: `/pages/crew/order_detail?id=${orderId}`
      })
    },

    // 获取状态样式类
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

    // 获取状态文本
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

    // 格式化日期时间
    formatDateTime(timestamp) {
      const date = new Date(timestamp)
      const year = date.getFullYear()
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      const hour = date.getHours().toString().padStart(2, '0')
      const minute = date.getMinutes().toString().padStart(2, '0')
      return `${year}-${month}-${day} ${hour}:${minute}`
    }
  }
}
</script>

<style lang="scss" scoped>
.order-list-page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

// 筛选标签
.filter-tabs {
  display: flex;
  background-color: #fff;
  padding: 10px 15px;
  gap: 15px;
  border-bottom: 1px solid #e5e5e5;
  overflow-x: auto;
  white-space: nowrap;

  .tab-item {
    flex-shrink: 0;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    color: #666;
    background-color: #f5f5f5;
    transition: all 0.3s;

    &.active {
      background-color: #007aff;
      color: #fff;
      font-weight: 500;
    }
  }
}

// 列表内容
.list-content {
  padding: 15px;
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.order-card {
  background-color: #fff;
  border-radius: 12px;
  padding: 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.order-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;

  .status-badge {
    padding: 5px 12px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 500;

    &.status-pending {
      background-color: #fff3e0;
      color: #f57c00;
    }

    &.status-ongoing {
      background-color: #e3f2fd;
      color: #1976d2;
    }

    &.status-completed {
      background-color: #e8f5e9;
      color: #388e3c;
    }

    &.status-canceled {
      background-color: #fce4ec;
      color: #c2185b;
    }
  }

  .order-type-tag {
    padding: 4px 10px;
    background-color: #f5f5f5;
    border-radius: 8px;
    font-size: 12px;
    color: #666;
  }
}

.order-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;

  .info-label {
    font-size: 13px;
    color: #999;
  }

  .info-value {
    flex: 1;
    font-size: 14px;
    color: #333;
  }
}

.order-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.price-box {
  display: flex;
  align-items: baseline;
  gap: 8px;

  .price-label {
    font-size: 12px;
    color: #999;
  }

  .price-amount {
    font-size: 20px;
    font-weight: 600;
    color: #ff5722;
  }
}

.action-btns {
  display: flex;
  gap: 10px;

  .btn-cancel {
    border: 1px solid #e5e5e5;
    background-color: #fff;
    color: #666;
  }

  .btn-detail {
    // 使用默认primary样式
  }
}

// 空状态
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;

  .empty-image {
    width: 150px;
    height: 150px;
    margin-bottom: 20px;
  }

  .empty-tip {
    font-size: 14px;
    color: #999;
  }
}
</style>
