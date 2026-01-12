<template>
  <view class="tracking-page">
    <!-- 地图区域 -->
    <map
      id="trackingMap"
      class="tracking-map"
      :latitude="mapCenter.latitude"
      :longitude="mapCenter.longitude"
      :scale="mapScale"
      :markers="markers"
      :polyline="polyline"
      :circles="circles"
      :show-location="false"
      @markertap="onMarkerTap"
    >
      <!-- 状态信息覆盖层 -->
      <cover-view class="status-overlay">
        <cover-view class="status-card-cover">
          <cover-view class="status-title">{{ statusText }}</cover-view>
          <cover-view class="status-distance">{{ distanceText }}</cover-view>
        </cover-view>
      </cover-view>
    </map>

    <!-- 底部信息面板 -->
    <view class="info-panel">
      <!-- 演员信息 -->
      <view class="actor-info-section">
        <image class="actor-avatar" :src="actorInfo.avatar || '/static/default-avatar.png'" mode="aspectFill"></image>
        <view class="actor-detail">
          <text class="actor-name">{{ actorInfo.nickname || '演员' }}</text>
          <view class="actor-status">
            <view class="online-dot" :class="{ online: isOnline }"></view>
            <text class="status-text">{{ isOnline ? '在线' : '离线' }}</text>
          </view>
        </view>
        <view class="action-buttons-small">
          <view class="action-btn" @tap="callActor">
            <uni-icons type="phone" size="24" color="#FFD700"></uni-icons>
          </view>
          <view class="action-btn" @tap="messageActor">
            <uni-icons type="chat" size="24" color="#FFD700"></uni-icons>
          </view>
        </view>
      </view>

      <!-- 订单信息 -->
      <view class="order-info-section">
        <view class="info-item">
          <uni-icons type="location" size="20" color="#999"></uni-icons>
          <text class="info-text">{{ order.meeting_location_name || '集合地点' }}</text>
        </view>
        <view class="info-item">
          <uni-icons type="calendar" size="20" color="#999"></uni-icons>
          <text class="info-text">{{ formatDateTime(order.work_start_time) || '工作时间' }}</text>
        </view>
      </view>

      <!-- 问题上报列表 -->
      <view class="issue-section" v-if="orderIssues.length > 0">
        <view class="issue-header">
          <uni-icons type="info" size="18" color="#FF6B6B"></uni-icons>
          <text class="issue-title">演员问题上报</text>
        </view>
        <view class="issue-list">
          <view class="issue-item" v-for="issue in orderIssues" :key="issue._id">
            <view class="issue-type-tag" :class="issue.issue_type">{{ getIssueTypeText(issue.issue_type) }}</view>
            <text class="issue-desc" v-if="issue.issue_description">{{ issue.issue_description }}</text>
            <text class="issue-time">{{ formatTime(issue.report_time) }}</text>
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="bottom-actions">
        <button class="btn-secondary" @tap="goToDetail">查看订单</button>
        <button class="btn-primary" @tap="confirmArrival" v-if="canConfirmArrival">确认完成</button>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      orderId: '',
      order: {},
      actorInfo: {},
      mapCenter: {
        latitude: 29.5630,
        longitude: 106.4650
      },
      mapScale: 15,
      markers: [],
      polyline: [],
      circles: [],
      trackList: [],
      actorLocation: null,
      meetingLocation: null,
      isOnline: false,
      refreshTimer: null,
      statusText: '等待演员出发',
      distanceText: '距离计算中...',
      trackingStarted: false,
      orderIssues: [],
      hasNewIssue: false
    }
  },

  computed: {
    canConfirmArrival() {
      // 订单进行中且演员已打卡时可以确认完成
      return this.order.order_status === 1 && this.order.arrive_time
    }
  },

  onLoad(options) {
    if (options.id) {
      this.orderId = options.id
      this.loadOrderInfo()
      this.startRefreshTimer()
    }
  },

  onUnload() {
    this.stopRefreshTimer()
  },

  methods: {
    async loadOrderInfo() {
      try {
        const db = uniCloud.database()
        const res = await db.collection('orders').doc(this.orderId).get()

        if (res.result.data && res.result.data.length > 0) {
          this.order = res.result.data[0]

          // 检查追踪状态
          this.trackingStarted = this.order.tracking_started === true
          if (!this.trackingStarted) {
            this.statusText = '等待演员出发'
            this.distanceText = '演员尚未点击"我已出发"'
          }

          // 设置集合地点
          if (this.order.meeting_location) {
            this.meetingLocation = {
              latitude: this.order.meeting_location.coordinates[1],
              longitude: this.order.meeting_location.coordinates[0]
            }
            this.mapCenter = { ...this.meetingLocation }
            this.updateMapElements()
          }

          // 加载演员信息
          if (this.order.receiver_id) {
            await this.loadActorInfo(this.order.receiver_id)
          }

          // 加载轨迹（只有演员出发后才有轨迹）
          if (this.trackingStarted) {
            await this.loadTracks()
          }

          // 加载问题上报
          await this.loadOrderIssues()
        }
      } catch (error) {
        console.error('加载订单信息失败:', error)
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    },

    async loadActorInfo(actorId) {
      try {
        const db = uniCloud.database()
        const res = await db.collection('uni-id-users').doc(actorId).field({
          nickname: true,
          avatar: true,
          mobile: true
        }).get()

        if (res.result.data && res.result.data.length > 0) {
          this.actorInfo = res.result.data[0]
        }
      } catch (error) {
        console.error('加载演员信息失败:', error)
      }
    },

    async loadTracks() {
      try {
        const db = uniCloud.database()
        const res = await db.collection('order_tracks')
          .where({ order_id: this.orderId })
          .orderBy('create_time', 'desc')
          .limit(20)
          .get()

        if (res.result.data) {
          this.trackList = res.result.data

          // 如果有轨迹，更新演员位置
          if (this.trackList.length > 0) {
            const latestTrack = this.trackList[0]
            if (latestTrack.location) {
              this.actorLocation = {
                latitude: latestTrack.location.coordinates[1],
                longitude: latestTrack.location.coordinates[0]
              }
              this.isOnline = Date.now() - latestTrack.create_time < 60000 // 1分钟内有更新认为在线
              this.updateMapElements()
              this.calculateDistance()
            }
          }
        }
      } catch (error) {
        console.error('加载轨迹失败:', error)
      }
    },

    async loadOrderIssues() {
      try {
        const db = uniCloud.database()
        const res = await db.collection('order_issues')
          .where({ order_id: this.orderId })
          .orderBy('report_time', 'desc')
          .get()

        if (res.result.data) {
          const oldCount = this.orderIssues.length
          this.orderIssues = res.result.data

          // 检测是否有新问题
          if (this.orderIssues.length > oldCount && oldCount > 0) {
            this.hasNewIssue = true
            this.showIssueNotification(this.orderIssues[0])
          } else if (this.orderIssues.length > 0 && oldCount === 0) {
            // 首次加载时如果有问题也提示
            this.showIssueNotification(this.orderIssues[0])
          }
        }
      } catch (error) {
        console.error('加载问题上报失败:', error)
      }
    },

    showIssueNotification(issue) {
      const issueTypeMap = {
        'late_warning': '迟到预警',
        'cannot_arrive': '无法到达',
        'safety_issue': '安全问题',
        'other': '其他问题'
      }
      const typeName = issueTypeMap[issue.issue_type] || '问题上报'
      uni.showModal({
        title: '演员问题上报',
        content: `${typeName}${issue.issue_description ? '：' + issue.issue_description : ''}`,
        showCancel: false,
        confirmText: '知道了'
      })
    },

    getIssueTypeText(type) {
      const typeMap = {
        'late_warning': '迟到预警',
        'cannot_arrive': '无法到达',
        'safety_issue': '安全问题',
        'other': '其他问题'
      }
      return typeMap[type] || '未知'
    },

    updateMapElements() {
      const newMarkers = []
      const newCircles = []

      // 集合地点标记
      if (this.meetingLocation) {
        newMarkers.push({
          id: 1,
          latitude: this.meetingLocation.latitude,
          longitude: this.meetingLocation.longitude,
          iconPath: '/static/icons/location-meeting.png',
          width: 40,
          height: 40,
          anchor: { x: 0.5, y: 1 },
          callout: {
            content: '集合地点',
            display: 'ALWAYS',
            bgColor: '#1E1E1E',
            color: '#FFD700',
            fontSize: 12,
            borderRadius: 8,
            padding: 8
          }
        })

        // 电子围栏（100米）
        newCircles.push({
          latitude: this.meetingLocation.latitude,
          longitude: this.meetingLocation.longitude,
          radius: 100,
          color: '#FFD70050',
          fillColor: '#FFD70020',
          strokeWidth: 2
        })
      }

      // 演员位置标记
      if (this.actorLocation) {
        newMarkers.push({
          id: 2,
          latitude: this.actorLocation.latitude,
          longitude: this.actorLocation.longitude,
          iconPath: this.actorInfo.avatar || '/static/default-avatar.png',
          width: 50,
          height: 50,
          anchor: { x: 0.5, y: 0.5 },
          callout: {
            content: this.actorInfo.nickname || '演员',
            display: 'ALWAYS',
            bgColor: '#1E1E1E',
            color: '#FFFFFF',
            fontSize: 12,
            borderRadius: 8,
            padding: 8
          }
        })

        // 绘制轨迹线
        if (this.trackList.length > 1) {
          const points = this.trackList
            .filter(t => t.location)
            .map(t => ({
              latitude: t.location.coordinates[1],
              longitude: t.location.coordinates[0]
            }))
            .reverse()

          if (points.length > 1) {
            this.polyline = [{
              points: points,
              color: '#2979FF',
              width: 4,
              dottedLine: false,
              arrowLine: true
            }]
          }
        }
      }

      this.markers = newMarkers
      this.circles = newCircles
    },

    calculateDistance() {
      if (!this.actorLocation || !this.meetingLocation) {
        this.distanceText = '距离计算中...'
        return
      }

      const distance = this.getDistance(
        this.actorLocation.latitude,
        this.actorLocation.longitude,
        this.meetingLocation.latitude,
        this.meetingLocation.longitude
      )

      if (distance < 100) {
        this.statusText = '演员已到达'
        this.distanceText = '已在集合地点附近'
      } else if (distance < 1000) {
        this.statusText = '演员正在赶来'
        this.distanceText = `距离集合地点 ${Math.round(distance)}米`
      } else {
        this.statusText = '演员正在赶来'
        this.distanceText = `距离集合地点 ${(distance / 1000).toFixed(1)}公里`
      }
    },

    getDistance(lat1, lng1, lat2, lng2) {
      const R = 6371000
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLng = (lng2 - lng1) * Math.PI / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return R * c
    },

    getTrackDesc(track) {
      if (track.track_type === 'check_in') {
        return '演员已打卡签到'
      } else if (track.track_type === 'location') {
        return '位置更新'
      }
      return '轨迹记录'
    },

    formatDateTime(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      return `${month}-${day} ${hour}:${minute}`
    },

    formatTime(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      return `${hour}:${minute}`
    },

    startRefreshTimer() {
      this.refreshTimer = setInterval(async () => {
        // 刷新订单状态（检查追踪是否开始）
        try {
          const db = uniCloud.database()
          const res = await db.collection('orders').doc(this.orderId).field({
            tracking_started: true,
            order_status: true,
            arrive_time: true
          }).get()

          if (res.result.data && res.result.data.length > 0) {
            const orderData = res.result.data[0]
            this.order.order_status = orderData.order_status
            this.order.arrive_time = orderData.arrive_time

            // 检查追踪状态变化
            if (orderData.tracking_started && !this.trackingStarted) {
              this.trackingStarted = true
              this.order.tracking_started = true
              uni.showToast({
                title: '演员已出发',
                icon: 'none'
              })
            }
          }
        } catch (error) {
          console.error('刷新订单状态失败:', error)
        }

        // 加载轨迹（仅在已开始追踪时）
        if (this.trackingStarted) {
          this.loadTracks()
        }

        // 加载问题上报
        this.loadOrderIssues()
      }, 10000) // 每10秒刷新一次
    },

    stopRefreshTimer() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer)
        this.refreshTimer = null
      }
    },

    onMarkerTap(e) {
      const markerId = e.detail.markerId
      if (markerId === 1) {
        // 点击集合地点
        uni.showToast({
          title: '集合地点',
          icon: 'none'
        })
      } else if (markerId === 2) {
        // 点击演员位置
        uni.showToast({
          title: this.actorInfo.nickname || '演员位置',
          icon: 'none'
        })
      }
    },

    callActor() {
      if (this.actorInfo.mobile) {
        uni.makePhoneCall({
          phoneNumber: this.actorInfo.mobile
        })
      } else {
        uni.showToast({
          title: '暂无联系方式',
          icon: 'none'
        })
      }
    },

    messageActor() {
      // TODO: 实现消息功能
      uni.showToast({
        title: '消息功能开发中',
        icon: 'none'
      })
    },

    goToDetail() {
      uni.navigateTo({
        url: `/pages/crew/order_detail?id=${this.orderId}`
      })
    },

    async confirmArrival() {
      uni.showModal({
        title: '确认完成',
        content: '确认演员已到达并完成工作？确认后订单将标记为已完成。',
        success: async (res) => {
          if (res.confirm) {
            try {
              uni.showLoading({ title: '处理中...', mask: true })
              const orderCo = uniCloud.importObject('order-co')
              const result = await orderCo.completeOrder(this.orderId)
              uni.hideLoading()

              if (result.code === 0) {
                uni.showToast({
                  title: '订单已完成',
                  icon: 'success'
                })
                this.order.order_status = 3
                setTimeout(() => {
                  uni.navigateTo({
                    url: `/pages/crew/order_detail?id=${this.orderId}`
                  })
                }, 1500)
              } else {
                uni.showToast({
                  title: result.message || '操作失败',
                  icon: 'none'
                })
              }
            } catch (error) {
              uni.hideLoading()
              console.error('确认完成失败:', error)
              uni.showToast({
                title: '网络错误，请重试',
                icon: 'none'
              })
            }
          }
        }
      })
    },

    async completeOrder() {
      try {
        uni.showModal({
          title: '确认完成',
          content: '确认本次工作已完成？确认后将进入支付流程。',
          success: async (res) => {
            if (res.confirm) {
              // TODO: 调用完成订单接口
              uni.showToast({
                title: '订单已完成',
                icon: 'success'
              })
              setTimeout(() => {
                uni.navigateTo({
                  url: `/pages/crew/order_detail?id=${this.orderId}`
                })
              }, 1500)
            }
          }
        })
      } catch (error) {
        console.error('完成订单失败:', error)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.tracking-page {
  width: 100%;
  height: 100vh;
  position: relative;
  background-color: $bg-primary;
}

.tracking-map {
  width: 100%;
  height: 55vh;
}

// 状态覆盖层
.status-overlay {
  position: absolute;
  top: 32rpx;
  left: 32rpx;
  right: 32rpx;
}

.status-card-cover {
  background-color: rgba(30, 30, 30, 0.95);
  border-radius: 16rpx;
  padding: 24rpx 32rpx;
}

.status-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #FFD700;
  display: block;
}

.status-distance {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 8rpx;
  display: block;
}

// 底部信息面板
.info-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: $bg-secondary;
  border-radius: $border-radius-lg $border-radius-lg 0 0;
  padding: $spacing-lg;
  padding-bottom: calc(#{$spacing-lg} + env(safe-area-inset-bottom));
  max-height: 50vh;
  overflow-y: auto;
}

// 演员信息区域
.actor-info-section {
  display: flex;
  align-items: center;
  gap: $spacing-base;
  padding-bottom: $spacing-base;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);

  .actor-avatar {
    width: 100rpx;
    height: 100rpx;
    border-radius: 50%;
    background-color: $gray-4;
  }

  .actor-detail {
    flex: 1;
    @include flex-column;
    gap: 8rpx;

    .actor-name {
      font-size: $font-size-lg;
      font-weight: $font-weight-bold;
      color: $text-primary;
    }

    .actor-status {
      display: flex;
      align-items: center;
      gap: 8rpx;

      .online-dot {
        width: 16rpx;
        height: 16rpx;
        border-radius: 50%;
        background-color: $gray-3;

        &.online {
          background-color: $success-color;
        }
      }

      .status-text {
        font-size: $font-size-sm;
        color: $text-secondary;
      }
    }
  }

  .action-buttons-small {
    display: flex;
    gap: $spacing-sm;

    .action-btn {
      width: 80rpx;
      height: 80rpx;
      @include flex-center;
      background-color: $bg-tertiary;
      border-radius: 50%;

      &:active {
        opacity: 0.8;
      }
    }
  }
}

// 订单信息区域
.order-info-section {
  padding: $spacing-base 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);

  .info-item {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin-bottom: $spacing-xs;

    &:last-child {
      margin-bottom: 0;
    }

    .info-text {
      font-size: $font-size-sm;
      color: $text-secondary;
    }
  }
}

// 问题上报区域
.issue-section {
  padding: $spacing-base 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);

  .issue-header {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    margin-bottom: $spacing-sm;

    .issue-title {
      font-size: $font-size-sm;
      font-weight: $font-weight-bold;
      color: #FF6B6B;
    }
  }

  .issue-list {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  .issue-item {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-xs $spacing-sm;
    background-color: rgba(255, 107, 107, 0.1);
    border-radius: $border-radius-sm;
  }

  .issue-type-tag {
    padding: 4rpx 12rpx;
    border-radius: 8rpx;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    flex-shrink: 0;

    &.late_warning {
      background-color: rgba(255, 193, 7, 0.2);
      color: #FFC107;
    }

    &.cannot_arrive {
      background-color: rgba(244, 67, 54, 0.2);
      color: #F44336;
    }

    &.safety_issue {
      background-color: rgba(255, 87, 34, 0.2);
      color: #FF5722;
    }

    &.other {
      background-color: rgba(158, 158, 158, 0.2);
      color: #9E9E9E;
    }
  }

  .issue-desc {
    flex: 1;
    font-size: $font-size-xs;
    color: $text-secondary;
    @include text-ellipsis;
  }

  .issue-time {
    font-size: $font-size-xs;
    color: $text-hint;
    flex-shrink: 0;
  }
}

// 底部操作按钮
.bottom-actions {
  display: flex;
  gap: $spacing-base;
  margin-top: $spacing-base;
  padding-top: $spacing-base;
  border-top: 1rpx solid rgba(255, 255, 255, 0.1);

  button {
    flex: 1;
    height: 88rpx;
    line-height: 88rpx;
    border-radius: $border-radius-base;
    font-size: $font-size-base;
    font-weight: $font-weight-bold;
  }

  .btn-primary {
    @include button-primary;
  }

  .btn-secondary {
    @include button-secondary;
  }
}
</style>
