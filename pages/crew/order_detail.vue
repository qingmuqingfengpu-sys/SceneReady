<template>
  <view class="order-detail-page">
    <!-- 加载状态 -->
    <view v-if="loading" class="loading-container">
      <uni-load-more status="loading" :content-text="loadingText"></uni-load-more>
    </view>

    <!-- 订单内容 -->
    <view v-else-if="order" class="order-content">
      <!-- 状态卡片 -->
      <view class="status-card" :class="statusCardClass">
        <view class="status-icon">
          <uni-icons :type="getStatusIcon(order.order_status)" size="48" color="#fff"></uni-icons>
        </view>
        <view class="status-info">
          <text class="status-text">{{ getStatusText(order.order_status) }}</text>
          <text class="status-desc">{{ getStatusDesc(order.order_status) }}</text>
        </view>
      </view>

      <!-- 订单信息卡片 -->
      <view class="info-card">
        <view class="card-title">
          <uni-icons type="info" size="20" color="#FFD700"></uni-icons>
          <text>订单信息</text>
        </view>

        <view class="info-row">
          <text class="info-label">订单编号</text>
          <text class="info-value mono">{{ order._id }}</text>
        </view>

        <view class="info-row">
          <text class="info-label">创建时间</text>
          <text class="info-value">{{ formatDateTime(order.create_time) }}</text>
        </view>

        <view class="info-row">
          <text class="info-label">订单类型</text>
          <view class="order-type-tag" :class="order.order_type === 1 ? 'instant' : 'scheduled'">
            {{ order.order_type === 1 ? '即时单' : '预约单' }}
          </view>
        </view>

        <view class="info-row">
          <text class="info-label">需求人数</text>
          <text class="info-value highlight">{{ order.actor_count || 1 }}人</text>
        </view>

        <view class="info-row">
          <text class="info-label">报酬金额</text>
          <text class="info-value price">{{ formatPrice(order.price_amount) }}/{{ order.price_unit === 'day' ? '天' : '时' }}</text>
        </view>
      </view>

      <!-- 工作信息卡片 -->
      <view class="info-card">
        <view class="card-title">
          <uni-icons type="location" size="20" color="#FFD700"></uni-icons>
          <text>工作信息</text>
        </view>

        <view class="info-row">
          <text class="info-label">集合地点</text>
          <text class="info-value">{{ order.meeting_location_name }}</text>
        </view>

        <view class="info-row" v-if="order.work_start_time">
          <text class="info-label">工作时间</text>
          <text class="info-value">{{ formatDateTime(order.work_start_time) }}</text>
        </view>

        <view class="info-row" v-if="order.role_description">
          <text class="info-label">角色描述</text>
          <text class="info-value desc">{{ order.role_description }}</text>
        </view>
      </view>

      <!-- 演员要求卡片 -->
      <view class="info-card">
        <view class="card-title">
          <uni-icons type="person" size="20" color="#FFD700"></uni-icons>
          <text>演员要求</text>
        </view>

        <view class="info-row" v-if="order.gender_requirement">
          <text class="info-label">性别</text>
          <text class="info-value">{{ getGenderText(order.gender_requirement) }}</text>
        </view>

        <view class="info-row" v-if="order.height_min || order.height_max">
          <text class="info-label">身高</text>
          <text class="info-value">{{ order.height_min || '不限' }}cm - {{ order.height_max || '不限' }}cm</text>
        </view>

        <view class="info-row" v-if="order.body_type">
          <text class="info-label">体型</text>
          <text class="info-value">{{ order.body_type }}</text>
        </view>

        <view class="info-row" v-if="order.skill_requirements && order.skill_requirements.length">
          <text class="info-label">特长要求</text>
          <view class="skill-tags">
            <text v-for="skill in order.skill_requirements" :key="skill" class="skill-tag">{{ getSkillLabel(skill) }}</text>
          </view>
        </view>
      </view>

      <!-- 福利待遇卡片 -->
      <view class="info-card" v-if="order.welfare_tags && order.welfare_tags.length">
        <view class="card-title">
          <uni-icons type="gift" size="20" color="#FFD700"></uni-icons>
          <text>福利待遇</text>
        </view>

        <view class="welfare-tags">
          <text v-for="tag in order.welfare_tags" :key="tag" class="welfare-tag">{{ getWelfareLabel(tag) }}</text>
        </view>
      </view>

      <!-- 接单人信息（如果有） -->
      <view class="info-card" v-if="order.order_status >= 1 && order.receiver_id">
        <view class="card-title">
          <uni-icons type="person-filled" size="20" color="#FFD700"></uni-icons>
          <text>接单演员</text>
        </view>

        <view class="receiver-info" @tap="viewReceiverProfile">
          <image class="receiver-avatar" :src="receiverInfo.avatar || '/static/default-avatar.png'" mode="aspectFill"></image>
          <view class="receiver-detail">
            <text class="receiver-name">{{ receiverInfo.nickname || '演员' }}</text>
            <view class="receiver-meta">
              <text v-if="receiverInfo.height">{{ receiverInfo.height }}cm</text>
              <text v-if="receiverInfo.gender"> | {{ receiverInfo.gender === 1 ? '男' : '女' }}</text>
            </view>
          </view>
          <view class="credit-badge" :class="receiverCreditClass">
            {{ receiverInfo.credit_score || 100 }}
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="action-buttons">
        <!-- 待接单状态 -->
        <template v-if="order.order_status === 0">
          <button class="btn-secondary" @tap="editOrder">编辑订单</button>
          <button class="btn-danger" @tap="cancelOrder">取消订单</button>
        </template>

        <!-- 进行中状态 -->
        <template v-else-if="order.order_status === 1">
          <button class="btn-primary" @tap="goToTracking">查看追踪</button>
          <button class="btn-secondary" @tap="contactActor">联系演员</button>
        </template>

        <!-- 待支付状态 -->
        <template v-else-if="order.order_status === 2">
          <button class="btn-primary" @tap="payOrder">立即支付</button>
          <button class="btn-secondary" @tap="contactActor">联系演员</button>
        </template>

        <!-- 已完成状态 -->
        <template v-else-if="order.order_status === 3">
          <button class="btn-primary" v-if="!order.is_rated" @tap="rateOrder">评价订单</button>
          <button class="btn-secondary" @tap="repostOrder">再次发布</button>
        </template>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="empty-container">
      <uni-icons type="info" size="64" color="#999"></uni-icons>
      <text class="empty-text">订单不存在</text>
      <button class="btn-primary" @tap="goBack">返回</button>
    </view>

    <!-- 取消订单弹窗 -->
    <uni-popup ref="cancelPopup" type="dialog">
      <uni-popup-dialog
        type="warn"
        title="取消订单"
        content="确定要取消这个订单吗？取消后无法恢复。"
        :before-close="true"
        @confirm="confirmCancel"
        @close="closeCancelPopup"
      ></uni-popup-dialog>
    </uni-popup>

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
                class="star"
                :class="{ active: rating >= i }"
                @tap="setRating(i)"
              >
                <uni-icons :type="rating >= i ? 'star-filled' : 'star'" size="32" :color="rating >= i ? '#FFD700' : '#666'"></uni-icons>
              </view>
            </view>
          </view>
          <view class="rate-item">
            <text class="rate-label">评价内容（选填）</text>
            <textarea class="rate-textarea" v-model="rateComment" placeholder="请输入您的评价..." maxlength="200"></textarea>
          </view>
          <button class="btn-primary rate-submit" @tap="submitRating">提交评价</button>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script>
export default {
  data() {
    return {
      orderId: '',
      order: null,
      receiverInfo: {},
      loading: true,
      loadingText: {
        contentdown: '加载中...',
        contentrefresh: '加载中...',
        contentnomore: '加载中...'
      },
      rating: 5,
      rateComment: '',
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
      }
    }
  },

  computed: {
    statusCardClass() {
      if (!this.order) return ''
      const classMap = {
        0: 'status-pending',
        1: 'status-ongoing',
        2: 'status-payment',
        3: 'status-completed',
        4: 'status-canceled'
      }
      return classMap[this.order.order_status] || ''
    },
    receiverCreditClass() {
      const score = this.receiverInfo.credit_score || 100
      if (score >= 130) return 'credit-gold'
      if (score >= 110) return 'credit-silver'
      return 'credit-normal'
    }
  },

  onLoad(options) {
    if (options.id) {
      this.orderId = options.id
      this.loadOrderDetail()
    } else {
      this.loading = false
    }
  },

  onPullDownRefresh() {
    this.loadOrderDetail()
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 1000)
  },

  methods: {
    async loadOrderDetail() {
      try {
        this.loading = true
        const db = uniCloud.database()
        const res = await db.collection('orders').doc(this.orderId).get()

        if (res.result.data && res.result.data.length > 0) {
          this.order = res.result.data[0]

          // 如果有接单人，加载接单人信息
          if (this.order.receiver_id) {
            await this.loadReceiverInfo(this.order.receiver_id)
          }
        }
      } catch (error) {
        console.error('加载订单详情失败:', error)
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    },

    async loadReceiverInfo(receiverId) {
      try {
        const db = uniCloud.database()
        const res = await db.collection('uni-id-users').doc(receiverId).field({
          nickname: true,
          avatar: true,
          height: true,
          gender: true,
          credit_score_actor: true
        }).get()

        if (res.result.data && res.result.data.length > 0) {
          const user = res.result.data[0]
          this.receiverInfo = {
            ...user,
            credit_score: user.credit_score_actor || 100
          }
        }
      } catch (error) {
        console.error('加载接单人信息失败:', error)
      }
    },

    // 状态相关方法
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

    getStatusDesc(status) {
      const descMap = {
        0: '等待演员接单中...',
        1: '演员已接单，正在履约中',
        2: '服务已完成，请支付报酬',
        3: '订单已完成',
        4: '订单已取消'
      }
      return descMap[status] || ''
    },

    getStatusIcon(status) {
      const iconMap = {
        0: 'clock',
        1: 'location',
        2: 'wallet',
        3: 'checkmarkempty',
        4: 'close'
      }
      return iconMap[status] || 'info'
    },

    getStatusCardClass(status) {
      const classMap = {
        0: 'status-pending',
        1: 'status-ongoing',
        2: 'status-payment',
        3: 'status-completed',
        4: 'status-canceled'
      }
      return classMap[status] || ''
    },

    getGenderText(gender) {
      const genderMap = {
        0: '不限',
        1: '男',
        2: '女'
      }
      return genderMap[gender] || '不限'
    },

    getSkillLabel(skill) {
      return this.skillMap[skill] || skill
    },

    getWelfareLabel(welfare) {
      return this.welfareMap[welfare] || welfare
    },

    getCreditClass(score) {
      if (score >= 130) return 'credit-gold'
      if (score >= 110) return 'credit-silver'
      return 'credit-normal'
    },

    formatDateTime(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hour}:${minute}`
    },

    formatPrice(amount) {
      if (!amount) return '0'
      return (amount / 100).toFixed(0)
    },

    // 操作方法
    editOrder() {
      uni.navigateTo({
        url: `/pages/crew/post_order?id=${this.orderId}&edit=true`
      })
    },

    cancelOrder() {
      this.$refs.cancelPopup.open()
    },

    closeCancelPopup() {
      this.$refs.cancelPopup.close()
    },

    async confirmCancel() {
      try {
        const orderCo = uniCloud.importObject('order-co')
        const res = await orderCo.cancel(this.orderId, '用户取消')

        if (res.code === 0) {
          uni.showToast({
            title: '取消成功',
            icon: 'success'
          })
          this.order.order_status = 4
          this.$refs.cancelPopup.close()
        } else {
          uni.showToast({
            title: res.message || '取消失败',
            icon: 'none'
          })
        }
      } catch (error) {
        console.error('取消订单失败:', error)
        uni.showToast({
          title: '取消失败',
          icon: 'none'
        })
      }
    },

    goToTracking() {
      uni.navigateTo({
        url: `/pages/crew/order_tracking?id=${this.orderId}`
      })
    },

    contactActor() {
      // TODO: 实现联系演员功能
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    payOrder() {
      // TODO: 实现支付功能
      uni.showToast({
        title: '支付功能开发中',
        icon: 'none'
      })
    },

    rateOrder() {
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
        const res = await orderCo.rateOrder(this.orderId, {
          score: this.rating,
          comment: this.rateComment || ''
        })

        uni.hideLoading()

        if (res.code === 0) {
          uni.showToast({
            title: '评价成功',
            icon: 'success'
          })
          this.order.is_rated = true
          this.order.publisher_rating = {
            score: this.rating,
            comment: this.rateComment
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

    repostOrder() {
      uni.navigateTo({
        url: `/pages/crew/post_order?copy=${this.orderId}`
      })
    },

    viewReceiverProfile() {
      // TODO: 查看接单人资料
      uni.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    },

    goBack() {
      uni.navigateBack()
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.order-detail-page {
  min-height: 100vh;
  background-color: $bg-primary;
  padding-bottom: env(safe-area-inset-bottom);
}

.loading-container {
  @include flex-center;
  min-height: 60vh;
}

.order-content {
  padding: $spacing-base;
}

// 状态卡片
.status-card {
  display: flex;
  align-items: center;
  padding: $spacing-lg;
  border-radius: $border-radius-lg;
  margin-bottom: $spacing-base;
  gap: $spacing-base;

  &.status-pending {
    background: linear-gradient(135deg, rgba($warning-color, 0.3) 0%, rgba($warning-color, 0.1) 100%);
  }

  &.status-ongoing {
    background: linear-gradient(135deg, rgba($secondary-color, 0.3) 0%, rgba($secondary-color, 0.1) 100%);
  }

  &.status-payment {
    background: linear-gradient(135deg, rgba($primary-color, 0.3) 0%, rgba($primary-color, 0.1) 100%);
  }

  &.status-completed {
    background: linear-gradient(135deg, rgba($success-color, 0.3) 0%, rgba($success-color, 0.1) 100%);
  }

  &.status-canceled {
    background: linear-gradient(135deg, rgba($gray-4, 0.5) 0%, rgba($gray-4, 0.2) 100%);
  }

  .status-icon {
    width: 80rpx;
    height: 80rpx;
    @include flex-center;
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 50%;
  }

  .status-info {
    flex: 1;
    @include flex-column;
    gap: 8rpx;

    .status-text {
      font-size: $font-size-xl;
      font-weight: $font-weight-bold;
      color: $text-primary;
    }

    .status-desc {
      font-size: $font-size-sm;
      color: $text-secondary;
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
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);

  &:last-child {
    border-bottom: none;
  }

  .info-label {
    width: 160rpx;
    font-size: $font-size-sm;
    color: $text-secondary;
    flex-shrink: 0;
  }

  .info-value {
    flex: 1;
    font-size: $font-size-base;
    color: $text-primary;
    word-break: break-all;

    &.mono {
      font-family: $font-family-monospace;
      font-size: $font-size-sm;
    }

    &.highlight {
      color: $primary-color;
      font-weight: $font-weight-bold;
    }

    &.price {
      color: $primary-color;
      font-size: $font-size-lg;
      font-weight: $font-weight-bold;
      font-family: $font-family-monospace;
    }

    &.desc {
      line-height: 1.6;
    }
  }
}

// 订单类型标签
.order-type-tag {
  display: inline-block;
  padding: 4rpx 16rpx;
  border-radius: $border-radius-sm;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;

  &.instant {
    background-color: rgba($alert-color, 0.15);
    color: $alert-color;
    border: 1rpx solid $alert-color;
  }

  &.scheduled {
    background-color: rgba($secondary-color, 0.15);
    color: $secondary-color;
    border: 1rpx solid $secondary-color;
  }
}

// 技能标签
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

// 福利标签
.welfare-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.welfare-tag {
  @include welfare-tag;
}

// 接单人信息
.receiver-info {
  display: flex;
  align-items: center;
  gap: $spacing-base;
  padding: $spacing-sm;
  background-color: $bg-tertiary;
  border-radius: $border-radius-base;

  &:active {
    opacity: 0.8;
  }

  .receiver-avatar {
    width: 100rpx;
    height: 100rpx;
    border-radius: 50%;
    background-color: $gray-4;
  }

  .receiver-detail {
    flex: 1;
    @include flex-column;
    gap: 8rpx;

    .receiver-name {
      font-size: $font-size-lg;
      font-weight: $font-weight-medium;
      color: $text-primary;
    }

    .receiver-meta {
      font-size: $font-size-sm;
      color: $text-secondary;
    }
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
}

// 操作按钮
.action-buttons {
  display: flex;
  gap: $spacing-base;
  margin-top: $spacing-lg;
  padding: $spacing-base 0;

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

  .btn-danger {
    background-color: $alert-color;
    color: $white;
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

    .star {
      padding: $spacing-xs;

      &:active {
        transform: scale(1.2);
      }
    }
  }

  .rate-textarea {
    width: 100%;
    height: 200rpx;
    background-color: $bg-tertiary;
    border-radius: $border-radius-base;
    padding: $spacing-base;
    color: $text-primary;
    font-size: $font-size-base;
    box-sizing: border-box;
  }

  .rate-submit {
    @include button-primary;
    width: 100%;
    height: 88rpx;
    margin-top: $spacing-base;
  }
}
</style>
