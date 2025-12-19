<template>
  <view class="job-detail-page">
    <!-- 加载状态 -->
    <view v-if="loading" class="loading-container">
      <uni-load-more status="loading" :content-text="loadingText"></uni-load-more>
    </view>

    <!-- 工作内容 -->
    <view v-else-if="job" class="job-content">
      <!-- 价格和状态 -->
      <view class="price-header">
        <view class="price-section">
          <text class="price-value">{{ formatPrice(job.price_amount) }}</text>
          <text class="price-unit">/{{ job.price_unit === 'day' ? '天' : '时' }}</text>
        </view>
        <view class="job-type-tag" :class="job.order_type === 1 ? 'instant' : 'scheduled'">
          {{ job.order_type === 1 ? '即时单' : '预约单' }}
        </view>
      </view>

      <!-- 剧组信息 -->
      <view class="crew-card" @tap="viewCrewProfile">
        <image class="crew-avatar" :src="crewInfo.avatar || '/static/default-crew.png'" mode="aspectFill"></image>
        <view class="crew-detail">
          <text class="crew-name">{{ crewInfo.nickname || '剧组' }}</text>
          <view class="crew-meta">
            <view class="credit-badge" :class="crewCreditClass">
              {{ crewInfo.credit_score || 100 }}分
            </view>
            <text class="order-count">发布{{ crewInfo.order_count || 0 }}单</text>
          </view>
        </view>
        <uni-icons type="forward" size="20" color="#666"></uni-icons>
      </view>

      <!-- 工作信息 -->
      <view class="info-card">
        <view class="card-title">
          <uni-icons type="calendar" size="20" color="#FFD700"></uni-icons>
          <text>工作信息</text>
        </view>

        <view class="info-row">
          <text class="info-label">需求人数</text>
          <text class="info-value highlight">{{ job.actor_count }}人</text>
        </view>

        <view class="info-row" v-if="job.work_start_time">
          <text class="info-label">工作时间</text>
          <text class="info-value">{{ formatDateTime(job.work_start_time) }}</text>
        </view>

        <view class="info-row" v-if="job.role_description">
          <text class="info-label">角色描述</text>
          <text class="info-value desc">{{ job.role_description }}</text>
        </view>
      </view>

      <!-- 集合地点 -->
      <view class="info-card">
        <view class="card-title">
          <uni-icons type="location" size="20" color="#FFD700"></uni-icons>
          <text>集合地点</text>
        </view>

        <view class="location-info">
          <text class="location-name">{{ job.meeting_location_name }}</text>
          <view class="location-actions">
            <view class="action-btn" @tap="openNavigation">
              <uni-icons type="navigate" size="20" color="#2979FF"></uni-icons>
              <text>导航</text>
            </view>
            <view class="action-btn" @tap="copyAddress">
              <uni-icons type="copy" size="20" color="#999"></uni-icons>
              <text>复制</text>
            </view>
          </view>
        </view>

        <!-- 小地图预览 -->
        <view class="map-preview" @tap="openFullMap">
          <map
            class="mini-map"
            :latitude="mapCenter.latitude"
            :longitude="mapCenter.longitude"
            :scale="15"
            :markers="markers"
            :show-location="false"
          ></map>
          <view class="map-mask">
            <text>点击查看大图</text>
          </view>
        </view>
      </view>

      <!-- 演员要求 -->
      <view class="info-card">
        <view class="card-title">
          <uni-icons type="person" size="20" color="#FFD700"></uni-icons>
          <text>演员要求</text>
        </view>

        <view class="requirements-grid">
          <view class="requirement-item">
            <text class="req-label">性别</text>
            <text class="req-value">{{ getGenderText(job.gender_requirement) }}</text>
          </view>

          <view class="requirement-item">
            <text class="req-label">身高</text>
            <text class="req-value">
              {{ job.height_min || '不限' }}{{ job.height_min ? 'cm' : '' }}
              -
              {{ job.height_max || '不限' }}{{ job.height_max ? 'cm' : '' }}
            </text>
          </view>

          <view class="requirement-item" v-if="job.body_type">
            <text class="req-label">体型</text>
            <text class="req-value">{{ job.body_type }}</text>
          </view>
        </view>

        <view class="skill-section" v-if="job.skill_requirements && job.skill_requirements.length">
          <text class="skill-label">特长要求</text>
          <view class="skill-tags">
            <text v-for="skill in job.skill_requirements" :key="skill" class="skill-tag">
              {{ getSkillLabel(skill) }}
            </text>
          </view>
        </view>
      </view>

      <!-- 福利待遇 -->
      <view class="info-card" v-if="job.welfare_tags && job.welfare_tags.length">
        <view class="card-title">
          <uni-icons type="gift" size="20" color="#FFD700"></uni-icons>
          <text>福利待遇</text>
        </view>

        <view class="welfare-tags">
          <view v-for="tag in job.welfare_tags" :key="tag" class="welfare-item">
            <uni-icons :type="getWelfareIcon(tag)" size="20" color="#FFD700"></uni-icons>
            <text>{{ getWelfareLabel(tag) }}</text>
          </view>
        </view>
      </view>

      <!-- 底部操作按钮 -->
      <view class="bottom-actions">
        <view class="action-left">
          <view class="action-item" @tap="favoriteJob">
            <uni-icons :type="isFavorite ? 'heart-filled' : 'heart'" size="28" :color="isFavorite ? '#FF5252' : '#999'"></uni-icons>
            <text>收藏</text>
          </view>
          <view class="action-item" @tap="shareJob">
            <uni-icons type="redo" size="28" color="#999"></uni-icons>
            <text>分享</text>
          </view>
        </view>

        <button class="grab-btn" @tap="grabJob" :disabled="isGrabbing">
          {{ isGrabbing ? '抢单中...' : '立即抢单' }}
        </button>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="empty-container">
      <uni-icons type="info" size="64" color="#999"></uni-icons>
      <text class="empty-text">工作不存在或已被抢完</text>
      <button class="btn-primary" @tap="goBack">返回列表</button>
    </view>

    <!-- 抢单确认弹窗 -->
    <uni-popup ref="grabPopup" type="dialog">
      <view class="grab-popup">
        <view class="popup-header">
          <text class="popup-title">确认抢单</text>
        </view>
        <view class="popup-content">
          <view class="confirm-item">
            <text class="confirm-label">工作报酬</text>
            <text class="confirm-value price">{{ formatPrice(job.price_amount) }}/{{ job.price_unit === 'day' ? '天' : '时' }}</text>
          </view>
          <view class="confirm-item">
            <text class="confirm-label">集合地点</text>
            <text class="confirm-value">{{ job.meeting_location_name }}</text>
          </view>
          <view class="confirm-item">
            <text class="confirm-label">工作时间</text>
            <text class="confirm-value">{{ formatDateTime(job.work_start_time) }}</text>
          </view>
          <view class="confirm-notice">
            <uni-icons type="info" size="16" color="#FFC107"></uni-icons>
            <text>抢单成功后请按时到达集合地点，迟到将影响信用分</text>
          </view>
        </view>
        <view class="popup-actions">
          <button class="btn-cancel" @tap="closeGrabPopup">取消</button>
          <button class="btn-confirm" @tap="confirmGrab">确认抢单</button>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script>
export default {
  data() {
    return {
      jobId: '',
      job: null,
      crewInfo: {},
      loading: true,
      loadingText: {
        contentdown: '加载中...',
        contentrefresh: '加载中...',
        contentnomore: '加载中...'
      },
      mapCenter: {
        latitude: 29.5630,
        longitude: 106.4650
      },
      markers: [],
      isFavorite: false,
      isGrabbing: false,
      skillMap: {
        'driving': '开车',
        'dancing': '跳舞',
        'singing': '唱歌',
        'martial_arts': '武术',
        'swimming': '游泳',
        'riding': '骑马',
        'instrument': '乐器',
        'language': '外语'
      },
      welfareMap: {
        'meal': '包盒饭',
        'transport': '报销路费',
        'accommodation': '提供住宿',
        'tea': '下午茶',
        'insurance': '购买保险'
      },
      welfareIconMap: {
        'meal': 'shop',
        'transport': 'car',
        'accommodation': 'home',
        'tea': 'cafe',
        'insurance': 'auth'
      }
    }
  },

  computed: {
    crewCreditClass() {
      const score = this.crewInfo.credit_score || 100
      if (score >= 130) return 'credit-gold'
      if (score >= 110) return 'credit-silver'
      return 'credit-normal'
    }
  },

  onLoad(options) {
    if (options.id) {
      this.jobId = options.id
      this.loadJobDetail()
    } else {
      this.loading = false
    }
  },

  onPullDownRefresh() {
    this.loadJobDetail()
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 1000)
  },

  methods: {
    async loadJobDetail() {
      try {
        this.loading = true
        const db = uniCloud.database()
        const res = await db.collection('orders').doc(this.jobId).get()

        if (res.result.data && res.result.data.length > 0) {
          this.job = res.result.data[0]

          // 设置地图位置
          if (this.job.meeting_location) {
            this.mapCenter = {
              latitude: this.job.meeting_location.coordinates[1],
              longitude: this.job.meeting_location.coordinates[0]
            }
            this.markers = [{
              id: 1,
              latitude: this.mapCenter.latitude,
              longitude: this.mapCenter.longitude,
              iconPath: '/static/icons/location-meeting.png',
              width: 32,
              height: 32
            }]
          }

          // 加载剧组信息
          if (this.job.publisher_id) {
            await this.loadCrewInfo(this.job.publisher_id)
          }
        }
      } catch (error) {
        console.error('加载工作详情失败:', error)
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    },

    async loadCrewInfo(crewId) {
      try {
        const db = uniCloud.database()
        const res = await db.collection('uni-id-users').doc(crewId).field({
          nickname: true,
          avatar: true,
          credit_score_crew: true
        }).get()

        if (res.result.data && res.result.data.length > 0) {
          const user = res.result.data[0]
          this.crewInfo = {
            ...user,
            credit_score: user.credit_score_crew || 100,
            order_count: 0 // TODO: 统计发布订单数
          }
        }
      } catch (error) {
        console.error('加载剧组信息失败:', error)
      }
    },

    // 工具方法
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

    getGenderText(gender) {
      const genderMap = { 0: '不限', 1: '男', 2: '女' }
      return genderMap[gender] || '不限'
    },

    getSkillLabel(skill) {
      return this.skillMap[skill] || skill
    },

    getWelfareLabel(welfare) {
      return this.welfareMap[welfare] || welfare
    },

    getWelfareIcon(welfare) {
      return this.welfareIconMap[welfare] || 'gift'
    },

    getCreditClass(score) {
      if (score >= 130) return 'credit-gold'
      if (score >= 110) return 'credit-silver'
      return 'credit-normal'
    },

    // 操作方法
    viewCrewProfile() {
      // TODO: 查看剧组资料
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    openNavigation() {
      if (!this.job.meeting_location) {
        uni.showToast({
          title: '地址信息不完整',
          icon: 'none'
        })
        return
      }

      uni.openLocation({
        latitude: this.mapCenter.latitude,
        longitude: this.mapCenter.longitude,
        name: this.job.meeting_location_name,
        address: this.job.meeting_location_name
      })
    },

    copyAddress() {
      uni.setClipboardData({
        data: this.job.meeting_location_name,
        success: () => {
          uni.showToast({
            title: '地址已复制',
            icon: 'success'
          })
        }
      })
    },

    openFullMap() {
      this.openNavigation()
    },

    favoriteJob() {
      this.isFavorite = !this.isFavorite
      uni.showToast({
        title: this.isFavorite ? '已收藏' : '已取消收藏',
        icon: 'success'
      })
    },

    shareJob() {
      // TODO: 分享功能
      uni.showToast({
        title: '分享功能开发中',
        icon: 'none'
      })
    },

    grabJob() {
      this.$refs.grabPopup.open()
    },

    closeGrabPopup() {
      this.$refs.grabPopup.close()
    },

    async confirmGrab() {
      try {
        this.isGrabbing = true
        this.$refs.grabPopup.close()

        // TODO: 调用抢单接口
        // const orderCo = uniCloud.importObject('order-co')
        // const res = await orderCo.grab(this.jobId)

        // 模拟抢单成功
        await new Promise(resolve => setTimeout(resolve, 1000))

        uni.showToast({
          title: '抢单成功',
          icon: 'success'
        })

        setTimeout(() => {
          uni.navigateTo({
            url: `/pages/actor/order_tracking?id=${this.jobId}`
          })
        }, 1500)
      } catch (error) {
        console.error('抢单失败:', error)
        uni.showToast({
          title: error.message || '抢单失败',
          icon: 'none'
        })
      } finally {
        this.isGrabbing = false
      }
    },

    goBack() {
      uni.navigateBack()
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.job-detail-page {
  min-height: 100vh;
  background-color: $bg-primary;
  padding-bottom: 160rpx;
}

.loading-container {
  @include flex-center;
  min-height: 60vh;
}

.job-content {
  padding: $spacing-base;
}

// 价格头部
.price-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-base;

  .price-section {
    display: flex;
    align-items: baseline;

    .price-value {
      font-size: 64rpx;
      font-weight: $font-weight-bold;
      color: $primary-color;
      font-family: $font-family-monospace;

      &::before {
        content: '¥';
        font-size: 36rpx;
      }
    }

    .price-unit {
      font-size: $font-size-lg;
      color: $text-secondary;
      margin-left: 8rpx;
    }
  }

  .job-type-tag {
    padding: 8rpx 20rpx;
    border-radius: $border-radius-sm;
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;

    &.instant {
      background-color: rgba($alert-color, 0.15);
      color: $alert-color;
    }

    &.scheduled {
      background-color: rgba($secondary-color, 0.15);
      color: $secondary-color;
    }
  }
}

// 剧组卡片
.crew-card {
  display: flex;
  align-items: center;
  gap: $spacing-base;
  background-color: $bg-secondary;
  border-radius: $border-radius-base;
  padding: $spacing-base;
  margin-bottom: $spacing-base;

  &:active {
    opacity: 0.8;
  }

  .crew-avatar {
    width: 100rpx;
    height: 100rpx;
    border-radius: 50%;
    background-color: $gray-4;
  }

  .crew-detail {
    flex: 1;
    @include flex-column;
    gap: 8rpx;

    .crew-name {
      font-size: $font-size-lg;
      font-weight: $font-weight-bold;
      color: $text-primary;
    }

    .crew-meta {
      display: flex;
      align-items: center;
      gap: $spacing-sm;

      .credit-badge {
        padding: 4rpx 12rpx;
        border-radius: $border-radius-sm;
        font-size: $font-size-xs;
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

      .order-count {
        font-size: $font-size-sm;
        color: $text-secondary;
      }
    }
  }
}

// 信息卡片
.info-card {
  @include card;
  margin-bottom: $spacing-base;

  .card-title {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin-bottom: $spacing-base;
    padding-bottom: $spacing-sm;
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);

    text {
      font-size: $font-size-lg;
      font-weight: $font-weight-bold;
      color: $text-primary;
    }
  }
}

.info-row {
  display: flex;
  align-items: flex-start;
  padding: $spacing-sm 0;

  .info-label {
    width: 140rpx;
    font-size: $font-size-sm;
    color: $text-secondary;
    flex-shrink: 0;
  }

  .info-value {
    flex: 1;
    font-size: $font-size-base;
    color: $text-primary;

    &.highlight {
      color: $primary-color;
      font-weight: $font-weight-bold;
    }

    &.desc {
      line-height: 1.6;
    }
  }
}

// 地点信息
.location-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-base;

  .location-name {
    flex: 1;
    font-size: $font-size-base;
    color: $text-primary;
  }

  .location-actions {
    display: flex;
    gap: $spacing-base;

    .action-btn {
      display: flex;
      align-items: center;
      gap: 4rpx;
      padding: $spacing-xs $spacing-sm;

      text {
        font-size: $font-size-xs;
        color: $text-secondary;
      }

      &:active {
        opacity: 0.8;
      }
    }
  }
}

.map-preview {
  position: relative;
  height: 240rpx;
  border-radius: $border-radius-base;
  overflow: hidden;

  .mini-map {
    width: 100%;
    height: 100%;
  }

  .map-mask {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: $spacing-sm;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
    text-align: center;

    text {
      font-size: $font-size-sm;
      color: $text-secondary;
    }
  }
}

// 演员要求
.requirements-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-base;
  margin-bottom: $spacing-base;
}

.requirement-item {
  @include flex-column;
  gap: 8rpx;

  .req-label {
    font-size: $font-size-xs;
    color: $text-secondary;
  }

  .req-value {
    font-size: $font-size-base;
    color: $text-primary;
    font-weight: $font-weight-medium;
  }
}

.skill-section {
  .skill-label {
    display: block;
    font-size: $font-size-sm;
    color: $text-secondary;
    margin-bottom: $spacing-sm;
  }

  .skill-tags {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-xs;
  }

  .skill-tag {
    padding: 4rpx 12rpx;
    background-color: rgba($primary-color, 0.15);
    border: 1rpx solid $primary-color;
    border-radius: $border-radius-sm;
    color: $primary-color;
    font-size: $font-size-xs;
  }
}

// 福利待遇
.welfare-tags {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-base;
}

.welfare-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;

  text {
    font-size: $font-size-base;
    color: $text-primary;
  }
}

// 底部操作
.bottom-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  padding: $spacing-base $spacing-lg;
  padding-bottom: calc(#{$spacing-base} + env(safe-area-inset-bottom));
  background-color: $bg-secondary;
  border-top: 1rpx solid rgba(255, 255, 255, 0.1);

  .action-left {
    display: flex;
    gap: $spacing-lg;

    .action-item {
      @include flex-center;
      @include flex-column;
      gap: 4rpx;

      text {
        font-size: $font-size-xs;
        color: $text-secondary;
      }

      &:active {
        opacity: 0.8;
      }
    }
  }

  .grab-btn {
    flex: 1;
    margin-left: $spacing-lg;
    @include button-primary;
    height: 88rpx;
    font-size: $font-size-lg;

    &[disabled] {
      opacity: 0.6;
    }
  }
}

// 空状态
.empty-container {
  @include flex-center;
  @include flex-column;
  min-height: 60vh;
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

// 抢单弹窗
.grab-popup {
  width: 600rpx;
  background-color: $bg-secondary;
  border-radius: $border-radius-lg;
  overflow: hidden;

  .popup-header {
    padding: $spacing-lg;
    background: linear-gradient(135deg, $primary-color 0%, #FFED4E 100%);
    text-align: center;

    .popup-title {
      font-size: $font-size-xl;
      font-weight: $font-weight-bold;
      color: $black;
    }
  }

  .popup-content {
    padding: $spacing-lg;
  }

  .confirm-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: $spacing-sm 0;
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);

    .confirm-label {
      font-size: $font-size-sm;
      color: $text-secondary;
    }

    .confirm-value {
      font-size: $font-size-base;
      color: $text-primary;

      &.price {
        color: $primary-color;
        font-weight: $font-weight-bold;
        font-family: $font-family-monospace;
      }
    }
  }

  .confirm-notice {
    display: flex;
    align-items: flex-start;
    gap: $spacing-sm;
    margin-top: $spacing-base;
    padding: $spacing-sm;
    background-color: rgba($warning-color, 0.1);
    border-radius: $border-radius-sm;

    text {
      flex: 1;
      font-size: $font-size-sm;
      color: $warning-color;
      line-height: 1.5;
    }
  }

  .popup-actions {
    display: flex;
    gap: $spacing-base;
    padding: $spacing-base $spacing-lg $spacing-lg;

    button {
      flex: 1;
      height: 80rpx;
      border-radius: $border-radius-base;
      font-size: $font-size-base;
      font-weight: $font-weight-bold;
    }

    .btn-cancel {
      background-color: $bg-tertiary;
      color: $text-secondary;
    }

    .btn-confirm {
      @include button-primary;
    }
  }
}
</style>
