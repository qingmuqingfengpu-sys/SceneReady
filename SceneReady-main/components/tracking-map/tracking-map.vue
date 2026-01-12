<template>
  <view class="tracking-map-container">
    <!-- 加载状态 -->
    <view v-if="loading" class="loading-container">
      <uni-load-more status="loading" :content-text="loadingText"></uni-load-more>
    </view>

    <!-- 追踪内容 -->
    <view v-else-if="trackingData" class="tracking-content">
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
      >
        <cover-view class="status-overlay">
          <cover-view class="status-card-cover">
            <cover-view class="status-title">{{ statusText }}</cover-view>
            <cover-view class="status-distance">{{ distanceText }}</cover-view>
          </cover-view>
        </cover-view>
      </map>

      <!-- 演员信息面板 -->
      <view class="tracking-panel">
        <view class="actor-info-section">
          <image class="actor-avatar" :src="displayAvatar" mode="aspectFill"></image>
          <view class="actor-detail-info">
            <text class="actor-name">{{ actorInfo.nickname || '演员' }}</text>
            <view class="actor-status">
              <view class="online-dot" :class="{ online: isOnline }"></view>
              <text class="status-text-small">{{ isOnline ? '在线' : '离线' }}</text>
            </view>
          </view>
          <view class="action-buttons-small">
            <view class="action-btn" @tap="callActor">
              <uni-icons type="phone" size="24" color="#FFD700"></uni-icons>
            </view>
          </view>
        </view>

        <!-- 追踪状态 -->
        <view class="tracking-status-section">
          <view class="status-item" :class="{ done: trackingData.tracking.tracking_started }">
            <view class="status-dot"></view>
            <text>{{ trackingData.tracking.tracking_started ? '已出发' : '待出发' }}</text>
          </view>
          <view class="status-line" :class="{ active: trackingData.tracking.tracking_started }"></view>
          <view class="status-item" :class="{ done: trackingData.tracking.arrive_time }">
            <view class="status-dot"></view>
            <text>{{ trackingData.tracking.arrive_time ? '已打卡' : '待打卡' }}</text>
          </view>
          <view class="status-line" :class="{ active: trackingData.tracking.arrive_time }"></view>
          <view class="status-item" :class="{ done: trackingData.tracking.is_completed }">
            <view class="status-dot"></view>
            <text>{{ trackingData.tracking.is_completed ? '已完成' : '待完成' }}</text>
          </view>
        </view>

        <!-- 操作按钮 -->
        <view class="tracking-actions">
          <button class="btn-secondary" @tap="viewActorProfile">查看资料</button>
          <button
            v-if="!trackingData.tracking.is_completed && trackingData.tracking.arrive_time"
            class="btn-primary"
            @tap="confirmComplete"
          >确认完成</button>
          <button
            v-else-if="trackingData.tracking.is_completed"
            class="btn-completed"
            disabled
          >已完成</button>
          <button
            v-else
            class="btn-waiting"
            disabled
          >等待演员打卡</button>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="empty-container">
      <uni-icons type="info" size="64" color="#999"></uni-icons>
      <text class="empty-text">暂无追踪数据</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'TrackingMap',
  props: {
    orderId: {
      type: String,
      required: true
    },
    actorId: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      loading: true,
      loadingText: {
        contentdown: '加载中...',
        contentrefresh: '加载中...',
        contentnomore: '加载中...'
      },
      trackingData: null,
      actorInfo: {},
      mapCenter: { latitude: 29.5630, longitude: 106.4650 },
      mapScale: 15,
      markers: [],
      polyline: [],
      circles: [],
      statusText: '等待演员出发',
      distanceText: '暂无位置信息',
      isOnline: false,
      refreshTimer: null
    }
  },

  computed: {
    displayAvatar() {
      if (!this.actorInfo) return '/static/default-avatar.png'
      const avatarFile = this.actorInfo.avatar_file
      const avatarFileUrl = avatarFile && avatarFile.url ? avatarFile.url : null
      return avatarFileUrl || this.actorInfo.avatar || '/static/default-avatar.png'
    }
  },

  mounted() {
    this.loadTrackingData()
  },

  beforeDestroy() {
    this.stopRefreshTimer()
  },

  methods: {
    // 加载追踪数据
    async loadTrackingData() {
      try {
        this.loading = true
        const orderCo = uniCloud.importObject('order-co')
        const res = await orderCo.getActorTracking(this.orderId, this.actorId)

        if (res.code === 0 && res.data) {
          this.trackingData = res.data
          this.actorInfo = {
            nickname: res.data.actor_info.nickname,
            avatar: res.data.actor_info.avatar,
            avatar_file: res.data.actor_info.avatar_file,
            mobile: res.data.actor_info.mobile
          }
          this.isOnline = res.data.is_online

          // 设置地图
          this.setupMap()

          // 开始定时刷新
          this.startRefreshTimer()
        } else {
          uni.showToast({ title: res.message || '加载失败', icon: 'none' })
        }
      } catch (error) {
        console.error('加载追踪数据失败:', error)
        uni.showToast({ title: '网络错误', icon: 'none' })
      } finally {
        this.loading = false
      }
    },

    // 设置地图
    setupMap() {
      if (!this.trackingData) return

      const newMarkers = []
      const newCircles = []

      // 集合地点
      if (this.trackingData.meeting_location) {
        const meetingLat = this.trackingData.meeting_location.coordinates[1]
        const meetingLng = this.trackingData.meeting_location.coordinates[0]

        this.mapCenter = { latitude: meetingLat, longitude: meetingLng }

        newMarkers.push({
          id: 1,
          latitude: meetingLat,
          longitude: meetingLng,
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

        newCircles.push({
          latitude: meetingLat,
          longitude: meetingLng,
          radius: 100,
          color: '#FFD70050',
          fillColor: '#FFD70020',
          strokeWidth: 2
        })
      }

      // 演员位置
      if (this.trackingData.latest_location && this.trackingData.latest_location.location) {
        const actorLat = this.trackingData.latest_location.location.coordinates[1]
        const actorLng = this.trackingData.latest_location.location.coordinates[0]

        newMarkers.push({
          id: 2,
          latitude: actorLat,
          longitude: actorLng,
          iconPath: this.displayAvatar,
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

        // 计算距离
        if (this.trackingData.meeting_location) {
          const meetingLat = this.trackingData.meeting_location.coordinates[1]
          const meetingLng = this.trackingData.meeting_location.coordinates[0]
          const distance = this.getDistance(actorLat, actorLng, meetingLat, meetingLng)
          this.updateStatusText(distance)
        }
      } else {
        this.statusText = this.trackingData.tracking.tracking_started ? '等待位置更新' : '等待演员出发'
        this.distanceText = '暂无位置信息'
      }

      // 轨迹线
      if (this.trackingData.tracks && this.trackingData.tracks.length > 1) {
        const points = this.trackingData.tracks
          .filter(t => t.location)
          .map(t => ({
            latitude: t.location.coordinates[1],
            longitude: t.location.coordinates[0]
          }))

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

      this.markers = newMarkers
      this.circles = newCircles
    },

    updateStatusText(distance) {
      if (this.trackingData.tracking.is_completed) {
        this.statusText = '已完成'
        this.distanceText = '演员已完成工作'
      } else if (this.trackingData.tracking.arrive_time) {
        this.statusText = '已到达'
        this.distanceText = '等待确认完成'
      } else if (distance <= 100) {
        this.statusText = '已到达'
        this.distanceText = '已在集合地点附近'
      } else if (distance < 1000) {
        this.statusText = '即将到达'
        this.distanceText = '距离集合点 ' + Math.round(distance) + '米'
      } else {
        this.statusText = '正在赶来'
        this.distanceText = '距离集合点 ' + (distance / 1000).toFixed(1) + '公里'
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

    startRefreshTimer() {
      this.stopRefreshTimer()
      this.refreshTimer = setInterval(() => {
        this.loadTrackingData()
      }, 10000)
    },

    stopRefreshTimer() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer)
        this.refreshTimer = null
      }
    },

    // 确认完成
    async confirmComplete() {
      uni.showModal({
        title: '确认完成',
        content: '确认该演员已完成工作？',
        success: async (res) => {
          if (res.confirm) {
            try {
              uni.showLoading({ title: '处理中...', mask: true })
              const orderCo = uniCloud.importObject('order-co')
              const result = await orderCo.completeActorOrder(this.orderId, this.actorId)
              uni.hideLoading()

              if (result.code === 0) {
                uni.showToast({ title: result.message || '已完成', icon: 'success' })
                this.trackingData.tracking.is_completed = true
                this.$emit('completed', { actorId: this.actorId, allCompleted: result.data.all_completed })
                if (result.data.all_completed) {
                  setTimeout(() => {
                    uni.navigateBack()
                  }, 1500)
                }
              } else {
                uni.showToast({ title: result.message || '操作失败', icon: 'none' })
              }
            } catch (error) {
              uni.hideLoading()
              console.error('确认完成失败:', error)
              uni.showToast({ title: '网络错误', icon: 'none' })
            }
          }
        }
      })
    },

    // 查看演员资料
    viewActorProfile() {
      this.$emit('view-profile', { actorId: this.actorId })
    },

    // 拨打电话
    callActor() {
      if (this.actorInfo && this.actorInfo.mobile) {
        uni.makePhoneCall({ phoneNumber: this.actorInfo.mobile })
      } else {
        uni.showToast({ title: '暂无联系方式', icon: 'none' })
      }
    },

    // 刷新数据（供外部调用）
    refresh() {
      this.loadTrackingData()
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.tracking-map-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.loading-container {
  @include flex-center;
  min-height: 400rpx;
}

.tracking-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.tracking-map {
  width: 100%;
  height: 55vh;
  flex-shrink: 0;
}

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

.tracking-panel {
  flex: 1;
  background-color: $bg-secondary;
  border-radius: $border-radius-lg $border-radius-lg 0 0;
  padding: $spacing-lg;
  padding-bottom: calc(#{$spacing-lg} + env(safe-area-inset-bottom));
  overflow-y: auto;
}

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

  .actor-detail-info {
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

      .status-text-small {
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

.tracking-status-section {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-lg 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);

  .status-item {
    display: flex;
    flex-direction: column;
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
      font-size: $font-size-xs;
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
    width: 60rpx;
    height: 4rpx;
    background-color: $gray-4;
    margin: 0 $spacing-sm;

    &.active {
      background-color: $success-color;
    }
  }
}

.tracking-actions {
  display: flex;
  gap: $spacing-base;
  margin-top: $spacing-lg;

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

  .btn-completed {
    background: linear-gradient(135deg, #4CAF50 0%, #81C784 100%);
    color: $white;
  }

  .btn-waiting {
    background: linear-gradient(135deg, #FF9800 0%, #FFB74D 100%);
    color: $black;
    opacity: 0.7;
  }
}

.empty-container {
  @include flex-center;
  @include flex-column;
  min-height: 400rpx;
  gap: $spacing-lg;

  .empty-text {
    font-size: $font-size-lg;
    color: $text-secondary;
  }
}
</style>
