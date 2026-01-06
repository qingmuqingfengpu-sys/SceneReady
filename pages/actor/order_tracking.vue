<template>
  <view class="tracking-page">
    <!-- 申请待审核状态 -->
    <view v-if="applicationStatus === 'pending'" class="pending-page">
      <view class="pending-content">
        <view class="pending-icon">
          <uni-icons type="clock" size="80" color="#FFD700"></uni-icons>
        </view>
        <text class="pending-title">申请审核中</text>
        <text class="pending-desc">您的申请正在等待剧组审核，请耐心等待</text>
        <view class="pending-order-info">
          <view class="order-info-item">
            <text class="label">订单编号</text>
            <text class="value">{{ orderId }}</text>
          </view>
          <view class="order-info-item">
            <text class="label">集合地点</text>
            <text class="value">{{ order.meeting_location_name || '待定' }}</text>
          </view>
          <view class="order-info-item">
            <text class="label">工作时间</text>
            <text class="value">{{ formatDateTime(order.work_start_time) || '待定' }}</text>
          </view>
          <view class="order-info-item">
            <text class="label">工作报酬</text>
            <text class="value price">{{ formatPrice(order.price_amount) }}/{{ order.price_unit === 'day' ? '天' : '时' }}</text>
          </view>
        </view>
        <view class="pending-actions">
          <button class="btn-secondary" @tap="cancelApplication">取消申请</button>
          <button class="btn-primary" @tap="refreshStatus">刷新状态</button>
        </view>
      </view>
    </view>

    <!-- 申请被拒绝状态 -->
    <view v-else-if="applicationStatus === 'rejected'" class="rejected-page">
      <view class="rejected-content">
        <view class="rejected-icon">
          <uni-icons type="close" size="80" color="#FF5252"></uni-icons>
        </view>
        <text class="rejected-title">申请未通过</text>
        <text class="rejected-desc">{{ rejectReason || '很遗憾，您的申请未被通过' }}</text>
        <view class="rejected-actions">
          <button class="btn-primary" @tap="goBack">返回订单列表</button>
        </view>
      </view>
    </view>

    <!-- 已通过/正常追踪状态 -->
    <template v-else>
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

      <!-- 订单取消提示 -->
      <view v-if="isOrderCancelled" class="cancelled-banner">
        <uni-icons type="info" size="20" color="#FF5252"></uni-icons>
        <text v-if="cancelledByType === 'crew'">剧组已取消订单</text>
        <text v-else-if="cancelledByType === 'actor'">您已取消接单</text>
        <text v-else>订单已取消</text>
      </view>

      <!-- 操作按钮 -->
      <view class="bottom-actions" v-if="!isOrderCancelled">
        <button class="btn-secondary" @tap="reportIssue">遇到问题</button>
        <!-- 未出发状态 -->
        <button v-if="!isStarted" class="btn-primary departure" @tap="startDeparture">
          我已出发
        </button>
        <!-- 已出发但未打卡 -->
        <button v-else-if="!isCheckedIn" class="btn-primary" :class="{ disabled: !canCheckIn }" :disabled="!canCheckIn" @tap="checkIn">
          {{ canCheckIn ? '打卡签到' : '未到达集合点' }}
        </button>
        <!-- 已打卡但未完成 -->
        <button v-else-if="!isCompleted" class="btn-primary waiting" disabled>待剧组确认</button>
        <!-- 已完成 -->
        <button v-else class="btn-primary completed" @tap="viewDetail">已完成 - 查看详情</button>
      </view>

      <!-- 订单取消后的返回按钮 -->
      <view class="bottom-actions" v-else>
        <button class="btn-secondary" @tap="goBack">返回</button>
      </view>
    </template>
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
      distanceToMeeting: Infinity,
      // 新增状态
      isStarted: false,           // 是否已出发
      isOrderCancelled: false,    // 订单是否被取消
      cancelledByType: '',        // 取消方: 'crew' | 'actor'
      // 多人申请模式状态
      applicationStatus: '',      // 申请状态: '' | 'pending' | 'approved' | 'rejected'
      rejectReason: ''            // 拒绝原因
    }
  },

  onLoad(options) {
    if (options.id) {
      this.orderId = options.id
      this.loadOrderInfo()
      // 不再自动启动轨迹追踪，需要用户点击"我已出发"后才开始
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

          // 检查多人申请模式下的申请状态
          if (res.data.my_application_status) {
            this.applicationStatus = res.data.my_application_status
            if (res.data.my_application_status === 'rejected') {
              this.rejectReason = res.data.my_reject_reason || ''
            }
            // 如果申请还在待审核或已拒绝，不继续加载追踪信息
            if (this.applicationStatus === 'pending' || this.applicationStatus === 'rejected') {
              // 仍然加载剧组信息用于显示
              if (this.order.publisher_id) {
                await this.loadCrewInfo(this.order.publisher_id)
              }
              return
            }
          }

          // 检查订单是否被取消
          if (this.order.order_status === 4) {
            this.isOrderCancelled = true
            // 判断是谁取消的
            if (this.order.is_cancelled_by_crew) {
              this.cancelledByType = 'crew'
            } else if (this.order.actor_cancel_reason) {
              this.cancelledByType = 'actor'
            }
            this.stopTracking()
            return
          }

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

          // 检查是否已出发（开始轨迹追踪）
          if (this.order.tracking_started) {
            this.isStarted = true
            // 已出发，自动开始轨迹追踪
            this.startTracking()
          } else {
            // 未出发，先获取一次位置用于显示
            this.getMyLocation()
          }

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
          const issueTypes = ['late_warning', 'cannot_arrive', 'safety_issue', 'other']
          const issueType = issueTypes[res.tapIndex]

          if (issueType === 'cannot_arrive') {
            // 无法到达需要特殊处理
            this.handleCannotArrive()
          } else {
            // 其他问题类型直接上报
            this.submitIssue(issueType)
          }
        }
      })
    },

    async handleCannotArrive() {
      uni.showModal({
        title: '确认无法到达',
        content: '确认后您的接单将被取消，订单将重新开放给其他演员。\n\n注意：取消接单将扣除5分信用分。',
        confirmText: '确认取消',
        confirmColor: '#FF5252',
        success: async (modalRes) => {
          if (modalRes.confirm) {
            try {
              uni.showLoading({ title: '处理中...', mask: true })

              const orderCo = uniCloud.importObject('order-co')
              const res = await orderCo.actorCancelOrder(this.orderId, '无法到达')

              uni.hideLoading()

              if (res.code === 0) {
                uni.showToast({
                  title: '已取消接单',
                  icon: 'success'
                })
                setTimeout(() => {
                  uni.navigateBack()
                }, 1500)
              } else {
                uni.showToast({
                  title: res.message || '操作失败',
                  icon: 'none'
                })
              }
            } catch (error) {
              uni.hideLoading()
              console.error('取消接单失败:', error)
              uni.showToast({
                title: '网络错误',
                icon: 'none'
              })
            }
          }
        }
      })
    },

    async submitIssue(issueType) {
      try {
        const orderCo = uniCloud.importObject('order-co')
        const issueData = {
          issue_type: issueType,
          description: ''
        }

        // 添加位置信息
        if (this.myLocation) {
          issueData.location = {
            longitude: this.myLocation.longitude,
            latitude: this.myLocation.latitude
          }
        }

        const res = await orderCo.reportIssue(this.orderId, issueData)

        if (res.code === 0) {
          uni.showToast({
            title: res.message || '已上报',
            icon: 'success'
          })
        } else {
          uni.showToast({
            title: res.message || '上报失败',
            icon: 'none'
          })
        }
      } catch (error) {
        console.error('上报问题失败:', error)
        uni.showToast({
          title: '网络错误',
          icon: 'none'
        })
      }
    },

    async startDeparture() {
      uni.showModal({
        title: '确认出发',
        content: '请保持定位权限开启，追踪过程中请勿退出或切换小程序。',
        confirmText: '我已出发',
        success: async (res) => {
          if (res.confirm) {
            try {
              uni.showLoading({ title: '确认中...', mask: true })

              const orderCo = uniCloud.importObject('order-co')
              const result = await orderCo.startDeparture(this.orderId)

              uni.hideLoading()

              if (result.code === 0) {
                this.isStarted = true
                this.startTracking()
                uni.showToast({
                  title: '已出发，开始追踪',
                  icon: 'success'
                })
              } else {
                uni.showToast({
                  title: result.message || '操作失败',
                  icon: 'none'
                })
              }
            } catch (error) {
              uni.hideLoading()
              console.error('确认出发失败:', error)
              uni.showToast({
                title: '网络错误',
                icon: 'none'
              })
            }
          }
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
      // 完成后跳转到我的订单页面
      uni.navigateTo({
        url: '/pages/actor/my_orders'
      })
    },

    goBack() {
      uni.navigateBack()
    },

    // 取消申请
    async cancelApplication() {
      uni.showModal({
        title: '确认取消',
        content: '确定要取消申请吗？取消后可以重新申请。',
        success: async (res) => {
          if (res.confirm) {
            try {
              uni.showLoading({ title: '取消中...', mask: true })

              const orderCo = uniCloud.importObject('order-co')
              const result = await orderCo.cancelApplication(this.orderId)

              uni.hideLoading()

              if (result.code === 0) {
                uni.showToast({
                  title: '已取消申请',
                  icon: 'success'
                })
                setTimeout(() => {
                  uni.navigateBack()
                }, 1500)
              } else {
                uni.showToast({
                  title: result.message || '取消失败',
                  icon: 'none'
                })
              }
            } catch (error) {
              uni.hideLoading()
              console.error('取消申请失败:', error)
              uni.showToast({
                title: '网络错误',
                icon: 'none'
              })
            }
          }
        }
      })
    },

    // 刷新申请状态
    async refreshStatus() {
      uni.showLoading({ title: '刷新中...', mask: true })
      await this.loadOrderInfo()
      uni.hideLoading()

      if (this.applicationStatus === 'approved') {
        uni.showToast({
          title: '申请已通过！',
          icon: 'success'
        })
      } else if (this.applicationStatus === 'rejected') {
        uni.showToast({
          title: '申请未通过',
          icon: 'none'
        })
      } else {
        uni.showToast({
          title: '仍在审核中',
          icon: 'none'
        })
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

// 申请待审核页面
.pending-page,
.rejected-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-xl;
  background-color: $bg-primary;
}

.pending-content,
.rejected-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.pending-icon,
.rejected-icon {
  margin-bottom: $spacing-lg;
}

.pending-title,
.rejected-title {
  font-size: 48rpx;
  font-weight: $font-weight-bold;
  color: $text-primary;
  margin-bottom: $spacing-sm;
}

.pending-desc,
.rejected-desc {
  font-size: $font-size-base;
  color: $text-secondary;
  margin-bottom: $spacing-xl;
}

.pending-order-info {
  width: 100%;
  background-color: $bg-secondary;
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
  margin-bottom: $spacing-xl;

  .order-info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: $spacing-sm 0;
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);

    &:last-child {
      border-bottom: none;
    }

    .label {
      font-size: $font-size-sm;
      color: $text-secondary;
    }

    .value {
      font-size: $font-size-base;
      color: $text-primary;
      text-align: right;
      max-width: 60%;

      &.price {
        color: $primary-color;
        font-weight: $font-weight-bold;
      }
    }
  }
}

.pending-actions,
.rejected-actions {
  width: 100%;
  display: flex;
  gap: $spacing-base;

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

// 取消提示
.cancelled-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  padding: $spacing-base;
  margin-bottom: $spacing-base;
  background-color: rgba(#FF5252, 0.1);
  border-radius: $border-radius-base;
  border: 1rpx solid rgba(#FF5252, 0.3);

  text {
    font-size: $font-size-base;
    color: #FF5252;
    font-weight: $font-weight-bold;
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

    &.departure {
      background: linear-gradient(135deg, #2979FF 0%, #64B5F6 100%);
    }

    &.completed {
      background: linear-gradient(135deg, #4CAF50 0%, #81C784 100%);
    }

    &.waiting {
      background: linear-gradient(135deg, #FF9800 0%, #FFB74D 100%);
      opacity: 0.8;
    }

    &.disabled {
      opacity: 0.5;
      background: $gray-4;
    }
  }

  .btn-secondary {
    @include button-secondary;
  }
}
</style>
