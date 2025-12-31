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
      :show-location="true"
      @regionchange="onRegionChange"
    >
      <!-- 状态信息覆盖层 -->
      <cover-view class="status-overlay">
        <cover-view class="status-card-cover">
          <cover-view class="status-title">{{ statusText }}</cover-view>
          <cover-view class="status-distance">{{ distanceText }}</cover-view>
        </cover-view>
      </cover-view>

      <!-- 定位按钮 -->
      <cover-view class="location-btn" @tap="centerToMyLocation">
        <cover-view class="location-icon">O</cover-view>
      </cover-view>
    </map>

    <!-- 底部信息面板 -->
    <view class="info-panel">
      <!-- 订单信息 -->
      <view class="order-info-section">
        <view class="info-row">
          <uni-icons type="location" size="20" color="#FFD700"></uni-icons>
          <view class="info-content">
            <text class="info-label">集合地点</text>
            <text class="info-value">{{ order.meeting_location_name || '集合地点' }}</text>
          </view>
          <view class="nav-btn" @tap="openNavigation">
            <uni-icons type="navigate" size="24" color="#2979FF"></uni-icons>
          </view>
        </view>

        <view class="info-row">
          <uni-icons type="calendar" size="20" color="#FFD700"></uni-icons>
          <view class="info-content">
            <text class="info-label">工作时间</text>
            <text class="info-value">{{ formatDateTime(order.work_start_time) || '待定' }}</text>
          </view>
        </view>

        <view class="info-row">
          <uni-icons type="wallet" size="20" color="#FFD700"></uni-icons>
          <view class="info-content">
            <text class="info-label">工作报酬</text>
            <text class="info-value price">{{ formatPrice(order.price_amount) }}/{{ order.price_unit === 'day' ? '天' : '时' }}</text>
          </view>
        </view>
      </view>

      <!-- 打卡状态 -->
      <view class="checkin-section">
        <view class="checkin-status">
          <view class="status-item" :class="{ done: isCheckedIn }">
            <view class="status-dot"></view>
            <text>{{ isCheckedIn ? '已打卡' : '待打卡' }}</text>
          </view>
          <view class="status-line" :class="{ active: isCheckedIn }"></view>
          <view class="status-item" :class="{ done: isCompleted }">
            <view class="status-dot"></view>
            <text>{{ isCompleted ? '已完成' : '进行中' }}</text>
          </view>
        </view>

        <!-- 打卡按钮 -->
        <view class="checkin-action">
          <button
            v-if="!isCheckedIn"
            class="checkin-btn"
            :class="{ disabled: !canCheckIn }"
            :disabled="!canCheckIn"
            @tap="checkIn"
          >
            <uni-icons type="checkmarkempty" size="28" color="#000"></uni-icons>
            <text>{{ canCheckIn ? '打卡签到' : '未到达集合点' }}</text>
          </button>

          <view v-else class="checkin-done">
            <uni-icons type="checkmarkempty" size="24" color="#4CAF50"></uni-icons>
            <text>打卡时间: {{ formatTime(checkinTime) }}</text>
          </view>
        </view>
      </view>

      <!-- 剧组联系 -->
      <view class="contact-section">
        <view class="contact-info">
          <image class="crew-avatar" :src="crewInfo.avatar || '/static/default-crew.png'" mode="aspectFill"></image>
          <view class="crew-detail">
            <text class="crew-name">{{ crewInfo.nickname || '剧组' }}</text>
            <text class="crew-label">发布方</text>
          </view>
        </view>
        <view class="contact-actions">
          <view class="contact-btn" @tap="callCrew">
            <uni-icons type="phone" size="24" color="#FFD700"></uni-icons>
          </view>
          <view class="contact-btn" @tap="messageCrew">
            <uni-icons type="chat" size="24" color="#FFD700"></uni-icons>
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="bottom-actions">
        <button class="btn-secondary" @tap="reportIssue">遇到问题</button>
        <button class="btn-primary waiting" v-if="isCheckedIn && !isCompleted" disabled>待剧组确认</button>
        <button class="btn-primary completed" @tap="viewDetail" v-else-if="isCompleted">已完成 - 查看详情</button>
        <button class="btn-primary" @tap="viewDetail" v-else>查看详情</button>
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
      crewInfo: {},
      mapCenter: {
        latitude: 29.5630,
        longitude: 106.4650
      },
      myLocation: null,
      meetingLocation: null,
      mapScale: 15,
      markers: [],
      polyline: [],
      circles: [],
      statusText: '前往集合地点',
      distanceText: '距离计算中...',
      isCheckedIn: false,
      isCompleted: false,
      canCheckIn: false,
      checkinTime: null,
      trackTimer: null,
      distanceToMeeting: Infinity
    }
  },

  onLoad(options) {
    if (options.id) {
      this.orderId = options.id
      this.loadOrderInfo()
      this.startTracking()
    }
  },

  onUnload() {
    this.stopTracking()
  },

  methods: {
    async loadOrderInfo() {
      try {
        // 使用云对象获取订单详情
        const orderCo = uniCloud.importObject('order-co')
        const res = await orderCo.getDetail(this.orderId)

        if (res.code === 0 && res.data) {
          this.order = res.data

          // 设置集合地点
          if (this.order.meeting_location) {
            this.meetingLocation = {
              latitude: this.order.meeting_location.coordinates[1],
              longitude: this.order.meeting_location.coordinates[0]
            }
            this.updateMapElements()
          }

          // 检查打卡状态（arrive_time 表示已打卡）
          this.isCheckedIn = !!this.order.arrive_time
          this.checkinTime = this.order.arrive_time

          // 检查订单完成状态
          this.isCompleted = this.order.order_status === 3

          // 加载剧组信息
          if (this.order.publisher_id) {
            await this.loadCrewInfo(this.order.publisher_id)
          }
        } else if (res.code === 401) {
          uni.showToast({ title: '请先登录', icon: 'none' })
          setTimeout(() => {
            uni.reLaunch({ url: '/pages/index/index' })
          }, 1500)
        } else {
          uni.showToast({ title: res.message || '加载失败', icon: 'none' })
        }
      } catch (error) {
        console.error('加载订单信息失败:', error)
        uni.showToast({ title: '网络错误', icon: 'none' })
      }
    },

    async loadCrewInfo(crewId) {
      try {
        const userCo = uniCloud.importObject('user-co')
        const res = await userCo.getPublicProfile(crewId)

        if (res.code === 0 && res.data) {
          this.crewInfo = {
            nickname: res.data.nickname || '剧组',
            avatar: res.data.avatar || '',
            mobile: res.data.mobile || ''
          }
        }
      } catch (error) {
        console.error('加载剧组信息失败:', error)
        this.crewInfo = { nickname: '剧组', avatar: '', mobile: '' }
      }
    },

    startTracking() {
      // 立即获取一次位置
      this.getMyLocation()

      // 定时上报位置
      this.trackTimer = setInterval(() => {
        this.getMyLocation()
        this.submitTrack()
      }, 10000) // 每10秒
    },

    stopTracking() {
      if (this.trackTimer) {
        clearInterval(this.trackTimer)
        this.trackTimer = null
      }
    },

    getMyLocation() {
      uni.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 4000,
        success: (res) => {
          this.myLocation = {
            latitude: res.latitude,
            longitude: res.longitude
          }
          this.mapCenter = { ...this.myLocation }
          this.updateMapElements()
          this.calculateDistance()
          console.log('定位成功, 精度:', res.accuracy, '米')
        },
        fail: (err) => {
          console.error('获取位置失败:', err)
        }
      })
    },

    centerToMyLocation() {
      if (this.myLocation) {
        this.mapCenter = { ...this.myLocation }
      } else {
        this.getMyLocation()
      }
    },

    onRegionChange(e) {
      // 地图区域变化
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

      this.markers = newMarkers
      this.circles = newCircles
    },

    calculateDistance() {
      if (!this.myLocation || !this.meetingLocation) {
        return
      }

      const distance = this.getDistance(
        this.myLocation.latitude,
        this.myLocation.longitude,
        this.meetingLocation.latitude,
        this.meetingLocation.longitude
      )

      this.distanceToMeeting = distance

      // 判断是否可以打卡（在100米范围内）
      this.canCheckIn = distance <= 100

      if (this.isCheckedIn) {
        this.statusText = '已签到'
        this.distanceText = '工作进行中'
      } else if (distance <= 100) {
        this.statusText = '已到达'
        this.distanceText = '请打卡签到'
      } else if (distance < 1000) {
        this.statusText = '即将到达'
        this.distanceText = `距离集合点 ${Math.round(distance)}米`
      } else {
        this.statusText = '前往集合点'
        this.distanceText = `距离集合点 ${(distance / 1000).toFixed(1)}公里`
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

    async submitTrack() {
      if (!this.myLocation || this.isCompleted) return

      try {
        const orderCo = uniCloud.importObject('order-co')
        const res = await orderCo.submitTrack(this.orderId, {
          longitude: this.myLocation.longitude,
          latitude: this.myLocation.latitude
        })

        if (res.code === 0) {
          console.log('轨迹上报成功:', res.data)
          // 如果进入围栏范围，更新可打卡状态
          if (res.data && res.data.in_fence) {
            this.canCheckIn = true
          }
        } else {
          console.warn('轨迹上报失败:', res.message)
        }
      } catch (error) {
        console.error('上报轨迹失败:', error)
      }
    },

    async checkIn() {
      if (!this.canCheckIn) {
        uni.showToast({
          title: '请先到达集合地点（100米范围内）',
          icon: 'none'
        })
        return
      }

      if (!this.myLocation) {
        uni.showToast({
          title: '正在获取位置，请稍后',
          icon: 'none'
        })
        this.getMyLocation()
        return
      }

      try {
        uni.showLoading({ title: '打卡中...', mask: true })

        const orderCo = uniCloud.importObject('order-co')
        const res = await orderCo.checkIn(this.orderId, {
          longitude: this.myLocation.longitude,
          latitude: this.myLocation.latitude
        })

        uni.hideLoading()

        if (res.code === 0) {
          this.isCheckedIn = true
          this.checkinTime = res.data.arrive_time || Date.now()

          // 显示打卡结果
          let message = '打卡成功'
          if (res.data.is_late) {
            message = `打卡成功，迟到${res.data.late_minutes}分钟`
          }

          uni.showToast({
            title: message,
            icon: 'success',
            duration: 2000
          })

          // 更新状态显示
          this.statusText = '已签到'
          this.distanceText = '工作进行中'
        } else {
          // 处理打卡失败
          let errorMsg = res.message || '打卡失败'

          if (res.code === 400 && res.data) {
            // 距离太远
            errorMsg = `距离集合点还有${res.data.distance}米，请靠近后再打卡`
          }

          uni.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 2500
          })
        }
      } catch (error) {
        uni.hideLoading()
        console.error('打卡失败:', error)
        uni.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        })
      }
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

    formatPrice(amount) {
      if (!amount) return '0'
      return (amount / 100).toFixed(0)
    },

    openNavigation() {
      if (!this.meetingLocation) {
        uni.showToast({
          title: '地址信息不完整',
          icon: 'none'
        })
        return
      }

      uni.openLocation({
        latitude: this.meetingLocation.latitude,
        longitude: this.meetingLocation.longitude,
        name: this.order.meeting_location_name,
        address: this.order.meeting_location_name
      })
    },

    callCrew() {
      if (this.crewInfo.mobile) {
        uni.makePhoneCall({
          phoneNumber: this.crewInfo.mobile
        })
      } else {
        uni.showToast({
          title: '暂无联系方式',
          icon: 'none'
        })
      }
    },

    messageCrew() {
      // TODO: 消息功能
      uni.showToast({
        title: '消息功能开发中',
        icon: 'none'
      })
    },

    reportIssue() {
      uni.showActionSheet({
        itemList: ['迟到预警', '无法到达', '安全问题', '其他问题'],
        success: (res) => {
          const issues = ['迟到预警', '无法到达', '安全问题', '其他问题']
          const selected = issues[res.tapIndex]
          // TODO: 提交问题
          uni.showToast({
            title: '已收到反馈',
            icon: 'success'
          })
        }
      })
    },

    async completeWork() {
      // 演员端提示：订单完成需要剧组确认
      uni.showModal({
        title: '请求完工确认',
        content: '工作完成后，请联系剧组进行完工确认。\n\n完工后您将获得报酬和信用分奖励。',
        confirmText: '联系剧组',
        cancelText: '稍后再说',
        success: (res) => {
          if (res.confirm) {
            // 跳转联系剧组
            if (this.crewInfo.mobile) {
              uni.makePhoneCall({
                phoneNumber: this.crewInfo.mobile
              })
            } else {
              uni.showToast({
                title: '暂无联系方式，请在消息中联系',
                icon: 'none'
              })
            }
          }
        }
      })
    },

    viewDetail() {
      uni.navigateTo({
        url: `/pages/actor/job_detail?id=${this.orderId}`
      })
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
  height: 50vh;
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

// 定位按钮
.location-btn {
  position: absolute;
  right: 32rpx;
  bottom: 32rpx;
  width: 80rpx;
  height: 80rpx;
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.location-icon {
  font-size: 32rpx;
  color: #2979FF;
  font-weight: bold;
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
  max-height: 55vh;
  overflow-y: auto;
}

// 订单信息区域
.order-info-section {
  padding-bottom: $spacing-base;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);

  .info-row {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-sm 0;

    .info-content {
      flex: 1;
      @include flex-column;
      gap: 4rpx;

      .info-label {
        font-size: $font-size-xs;
        color: $text-secondary;
      }

      .info-value {
        font-size: $font-size-base;
        color: $text-primary;

        &.price {
          color: $primary-color;
          font-weight: $font-weight-bold;
          font-family: $font-family-monospace;
        }
      }
    }

    .nav-btn {
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

// 打卡区域
.checkin-section {
  padding: $spacing-lg 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);
}

.checkin-status {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $spacing-lg;

  .status-item {
    display: flex;
    align-items: center;
    gap: $spacing-xs;

    .status-dot {
      width: 24rpx;
      height: 24rpx;
      border-radius: 50%;
      background-color: $gray-4;
      border: 4rpx solid $gray-3;
    }

    text {
      font-size: $font-size-sm;
      color: $text-secondary;
    }

    &.done {
      .status-dot {
        background-color: $success-color;
        border-color: $success-color;
      }

      text {
        color: $success-color;
      }
    }
  }

  .status-line {
    width: 100rpx;
    height: 4rpx;
    background-color: $gray-4;
    margin: 0 $spacing-sm;

    &.active {
      background-color: $success-color;
    }
  }
}

.checkin-action {
  @include flex-center;
}

.checkin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  width: 100%;
  height: 100rpx;
  @include button-primary;
  font-size: $font-size-lg;

  &.disabled {
    opacity: 0.5;
    background: $gray-4;
  }
}

.checkin-done {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-base;
  background-color: rgba($success-color, 0.1);
  border-radius: $border-radius-base;

  text {
    font-size: $font-size-base;
    color: $success-color;
  }
}

// 联系区域
.contact-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-base 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);

  .contact-info {
    display: flex;
    align-items: center;
    gap: $spacing-sm;

    .crew-avatar {
      width: 80rpx;
      height: 80rpx;
      border-radius: 50%;
      background-color: $gray-4;
    }

    .crew-detail {
      @include flex-column;
      gap: 4rpx;

      .crew-name {
        font-size: $font-size-base;
        font-weight: $font-weight-bold;
        color: $text-primary;
      }

      .crew-label {
        font-size: $font-size-xs;
        color: $text-secondary;
      }
    }
  }

  .contact-actions {
    display: flex;
    gap: $spacing-sm;

    .contact-btn {
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

// 底部操作
.bottom-actions {
  display: flex;
  gap: $spacing-base;
  margin-top: $spacing-base;

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

    &.completed {
      background: linear-gradient(135deg, #4CAF50 0%, #81C784 100%);
    }

    &.waiting {
      background: linear-gradient(135deg, #FF9800 0%, #FFB74D 100%);
      opacity: 0.8;
    }
  }

  .btn-secondary {
    @include button-secondary;
  }
}
</style>
