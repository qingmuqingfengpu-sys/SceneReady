<template>
  <view class="crew-home-map">
    <!-- 地图层 -->
    <map
      id="crewMap"
      class="map-layer"
      :latitude="mapCenter.latitude"
      :longitude="mapCenter.longitude"
      :scale="mapScale"
      :markers="actorMarkers"
      :show-location="true"
      :enable-3D="false"
      :enable-overlooking="false"
      @markertap="onMarkerTap"
      @regionchange="onRegionChange"
      @markerClusterCreate="onMarkerClusterCreate"
      @markerClusterClick="onMarkerClusterClick"
    >
    </map>

    <!-- 底部抽屉 -->
    <view
      class="drawer-container"
      :style="{ height: drawerHeight + 'rpx' }"
      @touchstart="onDrawerTouchStart"
      @touchmove.stop.prevent="onDrawerTouchMove"
      @touchend="onDrawerTouchEnd"
    >
      <!-- 抽屉把手 -->
      <view class="drawer-handle-area">
        <view class="drawer-handle"></view>
      </view>

      <!-- 抽屉内容 -->
      <scroll-view
        scroll-y
        class="drawer-content"
        :style="{ height: (drawerHeight - 60) + 'rpx' }"
      >
        <!-- 搜索栏 -->
        <view class="search-bar">
          <uni-icons type="search" size="20" color="#999"></uni-icons>
          <input
            class="search-input"
            placeholder="搜索演员"
            placeholder-class="search-placeholder"
            v-model="searchKeyword"
            @input="onSearchInput"
          />
          <view v-if="searchKeyword" class="search-clear" @tap="clearSearch">
            <uni-icons type="close" size="16" color="#999"></uni-icons>
          </view>
        </view>

        <!-- 搜索结果列表 -->
        <view v-if="searchKeyword && !searchLoading && searchResults.length > 0" class="search-results">
          <view class="section-header-compact">
            <text class="section-title-text">搜索结果</text>
            <text class="result-count">{{ searchResults.length }}人</text>
          </view>
          <view class="search-list">
            <view
              v-for="actor in searchResults"
              :key="actor.id"
              class="search-item"
              @tap="onSearchResultTap(actor)"
            >
              <image class="actor-avatar" :src="actor.avatar || '/static/default-avatar.png'" mode="aspectFill"></image>
              <view class="actor-info">
                <view class="actor-name">{{ actor.nickname }}</view>
                <view class="actor-meta">
                  <text class="meta-item">{{ actor.height }}cm</text>
                  <text class="meta-divider">|</text>
                  <text class="meta-item">{{ actor.distance }}km</text>
                </view>
              </view>
              <view :class="['credit-badge', getCreditClass(actor.credit_score)]">
                {{ actor.credit_score }}
              </view>
            </view>
          </view>
        </view>

        <!-- 搜索Loading状态 -->
        <view v-if="searchKeyword && searchLoading" class="search-loading">
          <view class="loading-spinner"></view>
          <text class="loading-text">搜索中...</text>
        </view>

        <!-- 搜索无结果 -->
        <view v-else-if="searchKeyword && searchResults.length === 0 && !searchLoading" class="empty-search">
          <text class="empty-text">未找到匹配的演员</text>
        </view>

        <!-- 非搜索状态：显示最近订单和信用分 -->
        <view v-if="!searchKeyword" class="main-content">
          <!-- 最近订单 -->
          <view class="recent-orders-compact">
            <view class="section-header-compact">
              <text class="section-title-text">最近订单</text>
              <view class="more-link" @tap="goToOrderList">
                <text>全部</text>
                <uni-icons type="forward" size="14" color="#FFD700"></uni-icons>
              </view>
            </view>

            <view v-if="orderList.length > 0" class="order-list-compact">
              <view
                v-for="order in orderList.slice(0, 3)"
                :key="order._id"
                class="order-item-compact"
                @tap="goToOrderDetail(order._id)"
              >
                <view class="order-header-compact">
                  <text :class="['order-status-compact', statusClassMap[order.order_status]]">
                    {{ getStatusText(order.order_status) }}
                  </text>
                  <text class="order-time-compact">{{ formatTime(order.create_time) }}</text>
                </view>
                <view class="order-content-compact">
                  <text class="order-location">{{ order.meeting_location_name }}</text>
                  <text class="order-price">{{ (order.price_amount / 100).toFixed(0) }}</text>
                </view>
              </view>
            </view>
            <view v-else class="empty-orders-compact">
              <text class="empty-text-compact">暂无订单</text>
            </view>
          </view>

          <!-- 信用分 -->
          <view class="credit-section-compact">
            <view class="credit-info">
              <text class="credit-title-compact">信用分</text>
              <view class="credit-score-compact">
                <text class="score-value">{{ userInfo.credit_score_crew || 100 }}</text>
                <text class="score-max">/150</text>
              </view>
            </view>
            <view :class="['credit-level-badge', crewCreditLevelClass]">
              {{ crewCreditLevel }}
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- FAB 悬浮按钮 -->
    <cover-view class="fab" @tap="goToPostOrder">
      <cover-view class="fab-bg"></cover-view>
      <cover-view class="fab-icon">+</cover-view>
    </cover-view>

    <!-- 演员详情弹窗 -->
    <uni-popup ref="actorDetailPopup" type="bottom" :safe-area="true">
      <view class="actor-detail-popup">
        <view class="popup-header">
          <text class="popup-title">演员资料</text>
          <view class="popup-close" @tap="closeActorDetail">
            <uni-icons type="close" size="24" color="#fff"></uni-icons>
          </view>
        </view>

        <view v-if="selectedActor" class="actor-detail-content">
          <!-- 视频模卡预览区 -->
          <view class="video-card-preview">
            <video
              v-if="selectedActor.videoCard"
              :src="selectedActor.videoCard"
              :controls="true"
              :autoplay="false"
              :muted="true"
              class="video-player"
            ></video>
            <view v-else class="video-placeholder">
              <uni-icons type="videocam" size="48" color="#666"></uni-icons>
              <text class="placeholder-text">暂无视频模卡</text>
            </view>
          </view>

          <!-- 详细信息 -->
          <view class="detail-info-grid">
            <view class="info-item">
              <text class="info-label">姓名</text>
              <text class="info-value">{{ selectedActor.nickname }}</text>
            </view>
            <view class="info-item">
              <text class="info-label">性别</text>
              <text class="info-value">{{ selectedActor.gender === 1 ? '男' : '女' }}</text>
            </view>
            <view class="info-item">
              <text class="info-label">身高</text>
              <text class="info-value">{{ selectedActor.height }}cm</text>
            </view>
            <view class="info-item">
              <text class="info-label">体型</text>
              <text class="info-value">{{ selectedActor.bodyType }}</text>
            </view>
          </view>

          <view class="detail-skills">
            <text class="skills-label">特长技能</text>
            <view class="skills-list">
              <text v-for="skill in selectedActor.skills" :key="skill" class="skill-tag-large">
                {{ skill }}
              </text>
            </view>
          </view>

          <button class="btn-invite" type="primary" @tap="inviteActor">
            邀请TA接单
          </button>
        </view>
      </view>
    </uni-popup>

    <!-- 底部 TabBar -->
    <custom-tabbar role="crew" :current="0" @refresh="refreshData"></custom-tabbar>
  </view>
</template>

<script>
export default {
  data() {
    return {
      // 登录状态
      isLoggedIn: false,

      // 地图相关
      mapCenter: {
        latitude: 29.5630,
        longitude: 106.4650
      },
      mapScale: 15,
      actorMarkers: [],

      // 抽屉相关
      drawerHeight: 400,
      drawerMinHeight: 280,
      drawerMaxHeight: 1000,
      touchStartY: 0,
      drawerStartHeight: 0,
      isDragging: false,

      // 搜索
      searchKeyword: '',
      searchResults: [],
      searchLoading: false,
      searchTimer: null,

      // 演员数据（用于地图标记和搜索）
      actorList: [],              // 完整列表数据（用于搜索和详情展示）
      actorMarkerData: [],        // 轻量化地图标记数据（只含经纬度、ID、头像）
      selectedActor: null,
      actorsLoading: false,

      // 演员地图显示相关
      defaultAvatarPath: '/static/default-avatar.png', // 默认头像

      // Uni-Push 2.0 实时位置更新相关
      pushClientId: null,              // 推送客户端ID
      pushConnected: false,            // 推送连接状态
      markerAnimationDuration: 500,    // Marker移动动画时长（毫秒）
      pushMessageHandler: null,        // 推送消息处理函数引用
      miniProgramPollingTimer: null,   // 小程序降级轮询定时器

      // 地图视口区域查询相关
      mapContext: null,                // 地图上下文
      regionChangeDebounceTimer: null, // 防抖定时器
      regionChangeDebounceDelay: 500,  // 防抖延迟（毫秒）
      currentViewport: null,           // 当前视口边界

      // 点聚合相关
      clusterMarkers: [],              // 聚合点标记

      // 用户位置
      userLocation: {
        longitude: null,
        latitude: null
      },

      // 用户信息
      userInfo: {},
      stats: {
        pending: 0,
        ongoing: 0,
        completed: 0
      },
      orderList: [],
      statusClassMap: {
        0: 'status-pending',
        1: 'status-ongoing',
        2: 'status-payment',
        3: 'status-completed',
        4: 'status-canceled'
      }
    }
  },

  computed: {
    crewCreditLevelClass() {
      const score = this.userInfo.credit_score_crew || 100
      if (score >= 130) return 'level-gold'
      if (score >= 110) return 'level-silver'
      return 'level-normal'
    },
    crewCreditLevel() {
      const score = this.userInfo.credit_score_crew || 100
      return this.getCreditLevel(score)
    }
  },

  async onLoad() {
    this.isLoggedIn = this.checkLoginStatus()
    // 初始化地图上下文
    this.mapContext = uni.createMapContext('crewMap', this)
    this.getMyLocation()

    if (this.isLoggedIn) {
      this.loadUserInfo()
      this.loadStats()
      this.loadRecentOrders()
    }
  },

  onPullDownRefresh() {
    this.isLoggedIn = this.checkLoginStatus()
    this.loadActors()
    if (this.isLoggedIn) {
      this.loadStats()
      this.loadRecentOrders()
    }
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 1000)
  },

  // 页面显示时订阅推送
  onShow() {
    this.initPushAndSubscribe()
  },

  // 页面隐藏时标记为非活跃
  onHide() {
    this.setSubscriptionInactive()
  },

  // 页面卸载时清理资源
  onUnload() {
    this.unsubscribePush()
    // 清理防抖定时器
    if (this.regionChangeDebounceTimer) {
      clearTimeout(this.regionChangeDebounceTimer)
      this.regionChangeDebounceTimer = null
    }
  },

  methods: {
    // ========== 刷新数据 ==========
    refreshData() {
      this.isLoggedIn = this.checkLoginStatus()
      this.loadActors()
      if (this.isLoggedIn) {
        this.loadUserInfo()
        this.loadStats()
        this.loadRecentOrders()
      }
    },

    // ========== 地图相关 ==========
    getMyLocation() {
      uni.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 4000,
        success: (res) => {
          this.mapCenter.latitude = res.latitude
          this.mapCenter.longitude = res.longitude
          this.userLocation = {
            longitude: res.longitude,
            latitude: res.latitude
          }
          console.log('定位成功, 精度:', res.accuracy, '米')
          this.loadActors()
          // 获取到位置后初始化推送
          this.initPushAndSubscribe()
        },
        fail: (err) => {
          console.error('获取位置失败:', err)
          uni.showToast({
            title: '定位失败，使用默认位置',
            icon: 'none'
          })
          this.userLocation = {
            longitude: this.mapCenter.longitude,
            latitude: this.mapCenter.latitude
          }
          this.loadActors()
          // 即使使用默认位置也初始化推送
          this.initPushAndSubscribe()
        }
      })
    },

    // 地图视口变化（带防抖）
    onRegionChange(e) {
      if (e.type === 'end') {
        // 清除之前的防抖定时器
        if (this.regionChangeDebounceTimer) {
          clearTimeout(this.regionChangeDebounceTimer)
        }
        // 设置新的防抖定时器
        this.regionChangeDebounceTimer = setTimeout(() => {
          this.loadActorsByViewport()
        }, this.regionChangeDebounceDelay)
      }
    },

    // 按视口区域加载演员
    async loadActorsByViewport() {
      if (!this.mapContext) {
        console.warn('mapContext not initialized')
        return
      }

      try {
        // 获取当前地图视口的西南角和东北角坐标
        this.mapContext.getRegion({
          success: (res) => {
            this.currentViewport = {
              southwest: res.southwest,
              northeast: res.northeast
            }
            console.log('当前视口范围:', this.currentViewport)
            // 使用视口边界加载演员
            this.loadActors(this.currentViewport)

            // 视口变化时，更新推送订阅范围
            if (this.pushConnected) {
              this.updateSubscription()
            }
          },
          fail: (err) => {
            console.error('获取地图视口失败:', err)
            // 降级为使用中心点+半径方式
            this.loadActors(null)
          }
        })
      } catch (error) {
        console.error('loadActorsByViewport error:', error)
        this.loadActors(null)
      }
    },

    onMarkerTap(e) {
      const markerId = e.detail.markerId
      const actor = this.actorList.find(a => a.id === markerId)
      if (actor) {
        this.showActorDetail(actor)
      }
    },

    // 加载演员（用于地图标记和搜索）
    // 显示所有已注册登录的演员：离线显示最后登录位置，在线显示实时位置
    // viewport: { southwest: {latitude, longitude}, northeast: {latitude, longitude} }
    async loadActors(viewport = null) {
      if (!this.userLocation.longitude || !this.userLocation.latitude) {
        return
      }

      if (this.actorsLoading) return
      this.actorsLoading = true

      try {
        const orderCo = uniCloud.importObject('order-co')
        let params = {}

        if (viewport && viewport.southwest && viewport.northeast) {
          // 按视口边界查询（推荐方式）
          params = {
            // 视口边界坐标
            southwest: {
              latitude: viewport.southwest.latitude,
              longitude: viewport.southwest.longitude
            },
            northeast: {
              latitude: viewport.northeast.latitude,
              longitude: viewport.northeast.longitude
            },
            // 仍然传递用户位置用于计算距离
            userLongitude: this.userLocation.longitude,
            userLatitude: this.userLocation.latitude,
            includeOffline: true
          }
          console.log('按视口边界查询演员:', params)
        } else {
          // 降级：按中心点+半径查询
          params = {
            longitude: this.userLocation.longitude,
            latitude: this.userLocation.latitude,
            maxDistance: 10000, // 10km
            includeOffline: true
          }
          console.log('按中心点半径查询演员:', params)
        }

        const res = await orderCo.getNearbyActors(params)

        if (res.code === 0 && res.data) {
          const actorList = res.data.list || res.data // 兼容两种返回格式

          const skillLabelMap = {
            'driving': '开车',
            'dancing': '跳舞',
            'singing': '唱歌',
            'martial_arts': '武术',
            'swimming': '游泳',
            'riding': '骑马',
            'instrument': '乐器',
            'language': '外语'
          }

          const bodyTypeMap = {
            'slim': '偏瘦',
            'standard': '标准',
            'athletic': '健壮',
            'plump': '偏胖'
          }

          // 处理演员数据，分离为轻量化标记数据和完整列表数据
          const processedActors = actorList.map((actor, index) => {
            // 处理头像：avatar_file.url > avatar > 默认头像
            const avatarFile = actor.avatar_file
            const avatarUrl = (avatarFile && avatarFile.url) || actor.avatar || this.defaultAvatarPath

            // 确定演员位置
            const isOnline = actor.online_status === 1
            let actorLat = null
            let actorLng = null

            if (isOnline && actor.current_location) {
              actorLat = actor.current_location.coordinates[1]
              actorLng = actor.current_location.coordinates[0]
            } else if (actor.last_login_location) {
              actorLat = actor.last_login_location.coordinates[1]
              actorLng = actor.last_login_location.coordinates[0]
            } else if (actor.location) {
              actorLat = actor.location.coordinates[1]
              actorLng = actor.location.coordinates[0]
            }

            const actorId = actor._id || index + 1

            return {
              // 完整列表数据
              full: {
                id: actorId,
                _id: actor._id,
                nickname: actor.nickname || '--',
                avatar: avatarUrl,
                height: actor.height || 170,
                gender: actor.gender || 0,
                bodyType: bodyTypeMap[actor.body_type] || actor.body_type || '--',
                credit_score: actor.credit_score_actor || 100,
                distance: actor.distance_km ? parseFloat(actor.distance_km).toFixed(1) : '-',
                skills: (actor.skills || []).map(s => skillLabelMap[s] || s),
                latitude: actorLat,
                longitude: actorLng,
                videoCard: actor.video_card || actor.video_card_url || '',
                isOnline: isOnline,
                lastActiveTime: actor.last_active_time || null
              },
              // 轻量化地图标记数据（只含必要字段）
              marker: {
                id: actorId,
                latitude: actorLat,
                longitude: actorLng,
                avatar: avatarUrl,
                isOnline: isOnline,
                nickname: actor.nickname || '--',
                height: actor.height || 170
              }
            }
          })
          // 过滤掉没有有效坐标的演员
          .filter(item => item.marker.latitude !== null && item.marker.longitude !== null)

          // 分离数据
          this.actorList = processedActors.map(item => item.full)
          this.actorMarkerData = processedActors.map(item => item.marker)

          console.log('演员数据加载完成, 列表数据:', this.actorList.length, '条, 标记数据:', this.actorMarkerData.length, '条')

          // 生成地图标记
          this.updateActorMarkers()
        } else {
          this.actorList = []
          this.actorMarkerData = []
          this.actorMarkers = []
        }
      } catch (error) {
        console.error('加载演员失败:', error)
        this.actorList = []
        this.actorMarkerData = []
        this.actorMarkers = []
      } finally {
        this.actorsLoading = false
      }
    },

    // 更新地图标记（使用轻量化数据，支持点聚合）
    updateActorMarkers() {
      // 使用轻量化的标记数据生成markers
      this.actorMarkers = this.actorMarkerData.map(marker => {
        const isOnline = marker.isOnline
        const statusText = isOnline ? '[在线]' : '[离线]'
        const calloutColor = isOnline ? '#4CAF50' : '#999999'

        return {
          id: marker.id,
          latitude: marker.latitude,
          longitude: marker.longitude,
          iconPath: marker.avatar || this.defaultAvatarPath,
          width: 40,
          height: 40,
          anchor: { x: 0.5, y: 0.5 },
          // 启用点聚合
          joinCluster: true,
          callout: {
            content: statusText + ' ' + marker.nickname + ' ' + marker.height + 'cm',
            display: 'BYCLICK',
            bgColor: '#1E1E1E',
            color: calloutColor,
            fontSize: 12,
            borderRadius: 8,
            padding: 6
          }
        }
      })
    },

    // 点聚合创建事件 - 当标记被聚合时触发
    onMarkerClusterCreate(e) {
      // e.detail.clusters 包含聚合点信息
      // 每个cluster: { clusterId, center: {latitude, longitude}, markerIds: [] }
      const clusters = e.detail.clusters || []
      console.log('点聚合创建:', clusters.length, '个聚合点')

      // 生成聚合点的自定义标记
      this.clusterMarkers = clusters.map(cluster => {
        const count = cluster.markerIds ? cluster.markerIds.length : 0
        return {
          id: cluster.clusterId,
          latitude: cluster.center.latitude,
          longitude: cluster.center.longitude,
          width: 50,
          height: 50,
          callout: {
            content: count + '位演员',
            display: 'ALWAYS',
            bgColor: '#FFD700',
            color: '#000000',
            fontSize: 12,
            borderRadius: 25,
            padding: 8,
            textAlign: 'center'
          }
        }
      })
    },

    // 点聚合点击事件 - 当用户点击聚合点时触发
    onMarkerClusterClick(e) {
      // e.detail.cluster 包含被点击的聚合点信息
      const cluster = e.detail.cluster || e.detail
      console.log('点击聚合点:', cluster)

      if (cluster && cluster.center) {
        // 放大地图以展开聚合点
        const newScale = Math.min(this.mapScale + 2, 20)
        this.mapScale = newScale
        this.mapCenter = {
          latitude: cluster.center.latitude,
          longitude: cluster.center.longitude
        }

        // 提示用户
        uni.showToast({
          title: '展开查看' + (cluster.markerIds ? cluster.markerIds.length : '') + '位演员',
          icon: 'none',
          duration: 1500
        })
      }
    },

    // ========== Uni-Push 2.0 实时位置更新 ==========

    // 初始化推送并订阅
    async initPushAndSubscribe() {
      // 如果没有位置信息，不订阅
      if (!this.userLocation.longitude || !this.userLocation.latitude) {
        console.log('Uni-Push: 等待获取用户位置...')
        return
      }

      try {
        // 1. 获取推送客户端ID
        await this.getPushClientId()

        // 2. 注册推送消息监听
        this.registerPushListener()

        // 3. 向服务器注册订阅
        await this.subscribeToServer()

        console.log('Uni-Push: 初始化完成')
      } catch (error) {
        console.error('Uni-Push: 初始化失败', error)
      }
    },

    // 获取推送客户端ID
    getPushClientId() {
      return new Promise((resolve, reject) => {
        // #ifdef APP-PLUS
        // App端使用 plus.push
        const clientInfo = plus.push.getClientInfo()
        if (clientInfo && clientInfo.clientid) {
          this.pushClientId = clientInfo.clientid
          this.pushConnected = true
          console.log('Uni-Push: 获取到clientId (App)', this.pushClientId)
          resolve(this.pushClientId)
        } else {
          // 监听 clientid 获取
          plus.push.addEventListener('receive', (msg) => {
            // 推送消息接收
          }, false)
          // 延迟获取
          setTimeout(() => {
            const info = plus.push.getClientInfo()
            if (info && info.clientid) {
              this.pushClientId = info.clientid
              this.pushConnected = true
              resolve(this.pushClientId)
            } else {
              reject(new Error('Failed to get push clientId'))
            }
          }, 1500)
        }
        // #endif

        // #ifdef MP-WEIXIN
        // 小程序端使用 websocket 模拟或 订阅消息
        // 注意：微信小程序不支持真正的推送，需要使用其他方案
        // 这里使用 uni-id-pages 的设备ID 作为标识
        const deviceId = uni.getStorageSync('uni_deviceId') || this.generateDeviceId()
        this.pushClientId = deviceId
        this.pushConnected = true
        console.log('Uni-Push: 小程序使用deviceId', this.pushClientId)
        resolve(this.pushClientId)
        // #endif

        // #ifdef H5
        // H5端降级处理
        const deviceId = uni.getStorageSync('uni_deviceId') || this.generateDeviceId()
        this.pushClientId = deviceId
        this.pushConnected = true
        resolve(this.pushClientId)
        // #endif
      })
    },

    // 生成设备ID
    generateDeviceId() {
      const deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      uni.setStorageSync('uni_deviceId', deviceId)
      return deviceId
    },

    // 注册推送消息监听
    registerPushListener() {
      // #ifdef APP-PLUS
      // App端监听推送消息
      this.pushMessageHandler = (msg) => {
        console.log('Uni-Push: 收到推送消息', msg)

        // 解析消息内容
        let payload = null
        if (msg.payload) {
          payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload
        } else if (msg.content) {
          try {
            payload = JSON.parse(msg.content)
          } catch (e) {
            console.warn('Uni-Push: 消息内容解析失败')
            return
          }
        }

        if (payload) {
          this.handlePushMessage(payload)
        }
      }

      // 监听透传消息
      plus.push.addEventListener('receive', this.pushMessageHandler, false)
      console.log('Uni-Push: 已注册App推送监听')
      // #endif

      // #ifdef MP-WEIXIN
      // 小程序端：使用轮询或长连接模拟（实际生产中可使用云开发的实时数据推送）
      // 这里为小程序提供一个降级方案：定时拉取更新
      this.startMiniProgramPolling()
      // #endif
    },

    // 小程序降级方案：定时拉取位置更新
    startMiniProgramPolling() {
      // 小程序不支持真正的推送，使用 30 秒轮询作为降级方案
      // 实际生产中建议使用：
      // 1. 云开发的实时数据推送
      // 2. 或者微信小程序的 WebSocket
      this.miniProgramPollingTimer = setInterval(async () => {
        if (!this.pushConnected) return
        try {
          // 拉取最新位置更新
          const pushLocationCo = uniCloud.importObject('push-location')
          // 这里需要后端提供一个拉取接口
          // const res = await pushLocationCo.pullLocationUpdates({ viewport: this.currentViewport })
          // if (res.code === 0 && res.data) {
          //   res.data.forEach(update => this.handleLocationUpdate(update))
          // }
        } catch (error) {
          console.error('小程序轮询位置更新失败:', error)
        }
      }, 30000)
    },

    // 向服务器注册订阅
    async subscribeToServer() {
      if (!this.pushClientId) {
        console.warn('Uni-Push: 无pushClientId，无法订阅')
        return
      }

      try {
        const pushLocationCo = uniCloud.importObject('push-location')
        const res = await pushLocationCo.subscribe({
          push_clientid: this.pushClientId,
          viewport: this.currentViewport,
          user_location: this.userLocation,
          role: 'crew',
          platform: this.getPlatform()
        })

        if (res.code === 0) {
          console.log('Uni-Push: 订阅成功')
        } else {
          console.error('Uni-Push: 订阅失败', res.msg)
        }
      } catch (error) {
        console.error('Uni-Push: 订阅请求失败', error)
      }
    },

    // 更新订阅（视口变化时调用）
    async updateSubscription() {
      if (!this.pushClientId || !this.pushConnected) return

      try {
        const pushLocationCo = uniCloud.importObject('push-location')
        await pushLocationCo.setActive({
          is_active: true,
          viewport: this.currentViewport,
          user_location: this.userLocation
        })
        console.log('Uni-Push: 订阅已更新')
      } catch (error) {
        console.error('Uni-Push: 更新订阅失败', error)
      }
    },

    // 设置订阅为非活跃状态
    async setSubscriptionInactive() {
      if (!this.pushClientId) return

      try {
        const pushLocationCo = uniCloud.importObject('push-location')
        await pushLocationCo.setActive({
          is_active: false
        })
        console.log('Uni-Push: 已设置为非活跃')
      } catch (error) {
        console.error('Uni-Push: 设置非活跃失败', error)
      }
    },

    // 取消订阅
    async unsubscribePush() {
      // #ifdef APP-PLUS
      // 移除推送监听
      if (this.pushMessageHandler) {
        plus.push.removeEventListener('receive', this.pushMessageHandler)
        this.pushMessageHandler = null
      }
      // #endif

      // #ifdef MP-WEIXIN
      // 停止小程序轮询
      if (this.miniProgramPollingTimer) {
        clearInterval(this.miniProgramPollingTimer)
        this.miniProgramPollingTimer = null
      }
      // #endif

      // 通知服务器取消订阅
      if (this.pushClientId) {
        try {
          const pushLocationCo = uniCloud.importObject('push-location')
          await pushLocationCo.unsubscribe({})
        } catch (error) {
          console.error('Uni-Push: 取消订阅失败', error)
        }
      }

      this.pushConnected = false
      console.log('Uni-Push: 已取消订阅')
    },

    // 处理推送消息
    handlePushMessage(message) {
      console.log('Uni-Push: 处理消息', message)

      if (!message || !message.type) {
        console.warn('Uni-Push: 无效消息格式')
        return
      }

      switch (message.type) {
        case 'location-update':
          // 演员位置更新
          this.handleLocationUpdate(message.data)
          break

        case 'actor-online':
          // 演员上线
          this.handleActorOnline(message.data)
          break

        case 'actor-offline':
          // 演员下线
          this.handleActorOffline(message.data)
          break

        default:
          console.log('Uni-Push: 未知消息类型', message.type)
      }
    },

    // 获取平台类型
    getPlatform() {
      // #ifdef APP-PLUS
      return 'app'
      // #endif
      // #ifdef MP-WEIXIN
      return 'mp-weixin'
      // #endif
      // #ifdef H5
      return 'h5'
      // #endif
      return 'unknown'
    },

    // 处理位置更新事件 - 增量更新 + 平滑移动
    handleLocationUpdate(data) {
      // data格式: { actor_id: 'xxx', latitude: 29.5630, longitude: 106.4650, timestamp: 1704700000000 }
      // 或批量: [{ actor_id, latitude, longitude, timestamp }, ...]

      const updates = Array.isArray(data) ? data : [data]

      updates.forEach(update => {
        const { actor_id, latitude, longitude } = update

        if (!actor_id || latitude == null || longitude == null) {
          return
        }

        // 1. 查找并更新 actorMarkerData 中的数据
        const markerIndex = this.actorMarkerData.findIndex(m => m.id === actor_id)
        if (markerIndex !== -1) {
          const oldLat = this.actorMarkerData[markerIndex].latitude
          const oldLng = this.actorMarkerData[markerIndex].longitude

          // 更新数据
          this.actorMarkerData[markerIndex].latitude = latitude
          this.actorMarkerData[markerIndex].longitude = longitude

          // 2. 使用 translateMarker 实现平滑移动
          this.smoothMoveMarker(actor_id, oldLat, oldLng, latitude, longitude)
        }

        // 3. 同步更新 actorList 中的数据
        const actorIndex = this.actorList.findIndex(a => a.id === actor_id || a._id === actor_id)
        if (actorIndex !== -1) {
          this.actorList[actorIndex].latitude = latitude
          this.actorList[actorIndex].longitude = longitude
        }

        // 4. 更新 actorMarkers 数组中的对应项
        const markersIndex = this.actorMarkers.findIndex(m => m.id === actor_id)
        if (markersIndex !== -1) {
          this.$set(this.actorMarkers[markersIndex], 'latitude', latitude)
          this.$set(this.actorMarkers[markersIndex], 'longitude', longitude)
        }
      })

      console.log('Uni-Push: 处理位置更新', updates.length, '条')
    },

    // 平滑移动Marker
    smoothMoveMarker(markerId, fromLat, fromLng, toLat, toLng) {
      if (!this.mapContext) {
        console.warn('smoothMoveMarker: mapContext未初始化')
        return
      }

      // 如果位置变化很小，不执行动画
      const latDiff = Math.abs(toLat - fromLat)
      const lngDiff = Math.abs(toLng - fromLng)
      if (latDiff < 0.00001 && lngDiff < 0.00001) {
        return
      }

      // 使用 translateMarker 实现平滑移动动画
      this.mapContext.translateMarker({
        markerId: markerId,
        destination: {
          latitude: toLat,
          longitude: toLng
        },
        duration: this.markerAnimationDuration,
        autoRotate: false,
        success: () => {
          // 动画完成
        },
        fail: (err) => {
          // translateMarker 失败时，直接更新位置
          console.warn('translateMarker失败，直接更新位置:', err)
          this.updateActorMarkers()
        }
      })
    },

    // 处理演员上线事件
    handleActorOnline(data) {
      const { actor_id, latitude, longitude, actor_info } = data

      // 检查是否已存在
      const existingIndex = this.actorMarkerData.findIndex(m => m.id === actor_id)

      if (existingIndex !== -1) {
        // 已存在，更新状态
        this.actorMarkerData[existingIndex].isOnline = true
        this.actorMarkerData[existingIndex].latitude = latitude
        this.actorMarkerData[existingIndex].longitude = longitude
      } else if (actor_info) {
        // 不存在且有演员信息，添加新标记
        this.actorMarkerData.push({
          id: actor_id,
          latitude: latitude,
          longitude: longitude,
          avatar: actor_info.avatar || this.defaultAvatarPath,
          isOnline: true,
          nickname: actor_info.nickname || '--',
          height: actor_info.height || 170
        })
      }

      // 更新地图标记
      this.updateActorMarkers()
      console.log('Uni-Push: 演员上线', actor_id)
    },

    // 处理演员下线事件
    handleActorOffline(data) {
      const { actor_id } = data

      // 更新在线状态
      const markerIndex = this.actorMarkerData.findIndex(m => m.id === actor_id)
      if (markerIndex !== -1) {
        this.actorMarkerData[markerIndex].isOnline = false
      }

      const actorIndex = this.actorList.findIndex(a => a.id === actor_id || a._id === actor_id)
      if (actorIndex !== -1) {
        this.actorList[actorIndex].isOnline = false
      }

      // 更新地图标记（更新callout颜色等）
      this.updateActorMarkers()
      console.log('Uni-Push: 演员下线', actor_id)
    },

    showActorDetail(actor) {
      this.selectedActor = actor
      this.$refs.actorDetailPopup.open()
    },

    closeActorDetail() {
      this.$refs.actorDetailPopup.close()
    },

    inviteActor() {
      if (!this.requireLogin('邀请演员')) return
      uni.showToast({
        title: '邀请功能开发中',
        icon: 'none'
      })
    },

    // ========== 抽屉相关 ==========
    onDrawerTouchStart(e) {
      this.touchStartY = e.touches[0].clientY
      this.drawerStartHeight = this.drawerHeight
      this.isDragging = true
    },

    onDrawerTouchMove(e) {
      if (!this.isDragging) return

      const currentY = e.touches[0].clientY
      const deltaY = this.touchStartY - currentY
      const deltaRpx = deltaY * 2

      let newHeight = this.drawerStartHeight + deltaRpx

      if (newHeight < this.drawerMinHeight) {
        newHeight = this.drawerMinHeight
      }
      if (newHeight > this.drawerMaxHeight) {
        newHeight = this.drawerMaxHeight
      }

      this.drawerHeight = newHeight
    },

    onDrawerTouchEnd(e) {
      this.isDragging = false
      this.touchStartY = 0
      this.drawerStartHeight = 0
    },

    // ========== 搜索 ==========
    onSearchInput() {
      // 清除之前的防抖定时器
      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
      }

      const keyword = this.searchKeyword.trim()
      if (!keyword) {
        this.searchResults = []
        this.searchLoading = false
        return
      }

      // 显示loading状态
      this.searchLoading = true

      // 防抖：500ms后调用后端搜索接口
      this.searchTimer = setTimeout(() => {
        this.searchActorsFromApi(keyword)
      }, 500)
    },

    // 调用后端搜索接口
    async searchActorsFromApi(keyword) {
      if (!keyword) {
        this.searchResults = []
        this.searchLoading = false
        return
      }

      try {
        const orderCo = uniCloud.importObject('order-co')

        // 构建搜索参数
        const params = {
          keyword: keyword,
          // 传递用户位置用于计算距离和排序
          userLongitude: this.userLocation.longitude,
          userLatitude: this.userLocation.latitude,
          // 可选：限制搜索结果数量
          limit: 50
        }

        console.log('搜索演员, 关键字:', keyword, '参数:', params)

        const res = await orderCo.searchActors(params)

        if (res.code === 0 && res.data) {
          // 处理搜索结果数据
          const skillLabelMap = {
            'driving': '开车',
            'dancing': '跳舞',
            'singing': '唱歌',
            'martial_arts': '武术',
            'swimming': '游泳',
            'riding': '骑马',
            'instrument': '乐器',
            'language': '外语'
          }

          const bodyTypeMap = {
            'slim': '偏瘦',
            'standard': '标准',
            'athletic': '健壮',
            'plump': '偏胖'
          }

          this.searchResults = res.data.map((actor, index) => {
            const avatarFile = actor.avatar_file
            const avatarUrl = (avatarFile && avatarFile.url) || actor.avatar || this.defaultAvatarPath

            // 确定演员位置
            const isOnline = actor.online_status === 1
            let actorLat = null
            let actorLng = null

            if (isOnline && actor.current_location) {
              actorLat = actor.current_location.coordinates[1]
              actorLng = actor.current_location.coordinates[0]
            } else if (actor.last_login_location) {
              actorLat = actor.last_login_location.coordinates[1]
              actorLng = actor.last_login_location.coordinates[0]
            } else if (actor.location) {
              actorLat = actor.location.coordinates[1]
              actorLng = actor.location.coordinates[0]
            }

            return {
              id: actor._id || index + 1,
              _id: actor._id,
              nickname: actor.nickname || '--',
              avatar: avatarUrl,
              height: actor.height || 170,
              gender: actor.gender || 0,
              bodyType: bodyTypeMap[actor.body_type] || actor.body_type || '--',
              credit_score: actor.credit_score_actor || 100,
              distance: actor.distance_km ? parseFloat(actor.distance_km).toFixed(1) : '-',
              skills: (actor.skills || []).map(s => skillLabelMap[s] || s),
              latitude: actorLat,
              longitude: actorLng,
              videoCard: actor.video_card || actor.video_card_url || '',
              isOnline: isOnline,
              lastActiveTime: actor.last_active_time || null
            }
          })

          console.log('搜索结果:', this.searchResults.length, '条')
        } else {
          this.searchResults = []
          if (res.code !== 0) {
            console.error('搜索失败:', res.message || res.msg)
          }
        }
      } catch (error) {
        console.error('搜索演员失败:', error)
        this.searchResults = []
        uni.showToast({
          title: '搜索失败，请重试',
          icon: 'none'
        })
      } finally {
        this.searchLoading = false
      }
    },

    // 点击搜索结果项 - 定位到地图并显示详情
    onSearchResultTap(actor) {
      if (!actor) return

      // 1. 收起抽屉以便查看地图
      this.drawerHeight = this.drawerMinHeight

      // 2. 移动地图中心到该演员位置
      if (actor.latitude && actor.longitude) {
        // 放大地图比例
        this.mapScale = 17

        // 使用 $set 确保响应式更新地图中心点
        this.$set(this.mapCenter, 'latitude', actor.latitude)
        this.$set(this.mapCenter, 'longitude', actor.longitude)

        console.log('地图聚焦到演员位置:', actor.nickname, actor.latitude, actor.longitude)

        // 如果有 mapContext，尝试使用 includePoints 确保视图包含该点
        if (this.mapContext) {
          this.mapContext.includePoints({
            points: [{
              latitude: actor.latitude,
              longitude: actor.longitude
            }],
            padding: [50, 50, 50, 50],
            success: () => {
              console.log('includePoints 成功')
            },
            fail: (err) => {
              console.warn('includePoints 失败:', err)
            }
          })
        }
      }

      // 3. 显示演员详情弹窗
      // 延迟显示弹窗，确保地图移动完成
      setTimeout(() => {
        this.showActorDetail(actor)
      }, 300)
    },

    clearSearch() {
      this.searchKeyword = ''
      this.searchResults = []
      this.searchLoading = false
    },

    // ========== 登录检查 ==========
    checkLoginStatus() {
      try {
        const token = uni.getStorageSync('uni_id_token')
        const tokenExpired = uni.getStorageSync('uni_id_token_expired')
        return token && tokenExpired && tokenExpired > Date.now()
      } catch (error) {
        return false
      }
    },

    requireLogin(actionName = '此操作') {
      if (this.isLoggedIn) return true

      uni.showModal({
        title: '需要登录',
        content: `${actionName}需要登录后才能使用，是否现在登录？`,
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            uni.setStorageSync('selected_role', 'crew')
            uni.navigateTo({
              url: '/uni_modules/uni-id-pages/pages/login/login-withpwd'
            })
          }
        }
      })
      return false
    },

    async loadUserInfo() {
      try {
        const res = await uniCloud.getCurrentUserInfo()
        this.userInfo = res
      } catch (error) {
        console.error('加载用户信息失败:', error)
      }
    },

    async loadStats() {
      try {
        const token = uni.getStorageSync('uni_id_token')
        if (!token) return

        const userCo = uniCloud.importObject('user-co')
        const res = await userCo.getStats()

        if (res.code === 0 && res.data) {
          this.stats = {
            pending: res.data.pending || 0,
            ongoing: res.data.in_progress || 0,
            completed: res.data.completed || 0
          }
          if (res.data.credit_score) {
            this.userInfo.credit_score_crew = res.data.credit_score
          }
        }
      } catch (error) {
        console.error('加载统计失败:', error)
      }
    },

    async loadRecentOrders() {
      try {
        const token = uni.getStorageSync('uni_id_token')
        if (!token) return

        const orderCo = uniCloud.importObject('order-co')
        const res = await orderCo.getMyOrders({
          page: 1,
          pageSize: 5
        })

        if (res.code === 0) {
          this.orderList = res.data.list
        } else if (res.code === 401) {
          uni.reLaunch({
            url: '/pages/index/index'
          })
        }
      } catch (error) {
        console.error('加载订单失败:', error)
        if (error.message && error.message.includes('登录')) {
          uni.reLaunch({
            url: '/pages/index/index'
          })
        }
      }
    },

    goToPostOrder() {
      if (!this.requireLogin('发布需求')) return
      uni.navigateTo({
        url: '/pages/crew/post_order'
      })
    },

    goToOrderList() {
      if (!this.requireLogin('查看订单')) return
      uni.navigateTo({
        url: '/pages/crew/order_list'
      })
    },

    goToOrderDetail(orderId) {
      if (!this.requireLogin('查看订单详情')) return
      uni.navigateTo({
        url: `/pages/crew/order_detail?id=${orderId}`
      })
    },

    goToProfile() {
      if (!this.requireLogin('查看个人中心')) return
      uni.navigateTo({
        url: '/pages/crew/profile'
      })
    },

    // ========== 工具方法 ==========
    getCreditClass(score) {
      if (score >= 130) return 'credit-gold'
      if (score >= 110) return 'credit-silver'
      return 'credit-normal'
    },

    getCreditLevel(score) {
      if (score >= 130) return '金牌剧组'
      if (score >= 110) return '优质剧组'
      if (score >= 90) return '良好'
      return '普通'
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

    formatTime(timestamp) {
      const date = new Date(timestamp)
      const now = new Date()
      const diff = now - date

      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

      return `${date.getMonth() + 1}-${date.getDate()}`
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.crew-home-map {
  width: 100%;
  height: 100vh;
  position: relative;
  background-color: $bg-primary;
}

// ========== 地图层 ==========
.map-layer {
  width: 100%;
  height: 100%;
}

// ========== 我的图标 ==========
.my-profile-icon-crew {
  position: absolute;
  left: 32rpx;
  top: 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100rpx;
  height: 100rpx;
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 20rpx;
  box-shadow: 0 8rpx 16rpx rgba(0, 0, 0, 0.15);
}

.my-icon-circle {
  width: 48rpx;
  height: 48rpx;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.my-icon-head {
  width: 20rpx;
  height: 20rpx;
  background-color: #333;
  border-radius: 50%;
}

.my-icon-body {
  width: 32rpx;
  height: 18rpx;
  background-color: #333;
  border-radius: 16rpx 16rpx 0 0;
  margin-top: 4rpx;
}

.my-text-crew {
  font-size: 20rpx;
  color: #333;
  font-weight: 600;
  margin-top: 4rpx;
}

// ========== 底部抽屉 ==========
.drawer-container {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: $bg-secondary;
  border-radius: $border-radius-lg $border-radius-lg 0 0;
  z-index: $z-index-drawer;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.3);
  will-change: height;
}

.drawer-handle-area {
  padding: $spacing-sm 0;
  @include flex-center;
}

.drawer-handle {
  width: 80rpx;
  height: 8rpx;
  background-color: $gray-3;
  border-radius: 4rpx;
}

.drawer-content {
  padding: 0 $spacing-base $spacing-base;
  box-sizing: border-box;
}

// ========== 搜索栏 ==========
.search-bar {
  display: flex;
  align-items: center;
  background-color: $bg-tertiary;
  border-radius: $border-radius-base;
  padding: $spacing-sm $spacing-base;
  margin-bottom: $spacing-base;
  gap: $spacing-sm;
}

.search-input {
  flex: 1;
  color: $text-primary;
  font-size: $font-size-base;
}

.search-placeholder {
  color: $text-hint;
}

.search-clear {
  @include flex-center;
}

// ========== 搜索结果 ==========
.search-results {
  margin-bottom: $spacing-base;
}

.result-count {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.search-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.search-item {
  display: flex;
  align-items: center;
  background-color: $bg-tertiary;
  border-radius: $border-radius-base;
  padding: $spacing-base;
  gap: $spacing-base;

  &:active {
    opacity: 0.8;
  }
}

.actor-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: $border-radius-circle;
  background-color: $gray-4;
}

.actor-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.actor-name {
  font-size: $font-size-lg;
  font-weight: $font-weight-medium;
  color: $text-primary;
}

.actor-meta {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: $font-size-sm;
  color: $text-secondary;
}

.meta-item {
  font-family: $font-family-monospace;
}

.meta-divider {
  color: $gray-3;
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

// ========== 搜索Loading ==========
.search-loading {
  padding: $spacing-lg 0;
  @include flex-center;
  @include flex-column;
  gap: $spacing-sm;

  .loading-spinner {
    width: 40rpx;
    height: 40rpx;
    border: 4rpx solid $gray-3;
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
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-search {
  padding: $spacing-lg 0;
  text-align: center;

  .empty-text {
    font-size: $font-size-base;
    color: $text-secondary;
  }
}

// ========== 主内容区 ==========
.main-content {
  display: flex;
  flex-direction: column;
  gap: $spacing-base;
}

// ========== 最近订单 ==========
.recent-orders-compact {
  padding: $spacing-base;
  background-color: $bg-tertiary;
  border-radius: $border-radius-base;
}

.section-header-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-base;

  .section-title-text {
    font-size: $font-size-lg;
    font-weight: $font-weight-bold;
    color: $text-primary;
  }

  .more-link {
    display: flex;
    align-items: center;
    gap: 4rpx;
    font-size: $font-size-sm;
    color: $primary-color;
  }
}

.order-list-compact {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.order-item-compact {
  padding: $spacing-sm;
  background-color: $bg-primary;
  border-radius: $border-radius-sm;

  &:active {
    opacity: 0.8;
  }
}

.order-header-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;

  .order-status-compact {
    padding: 4rpx 12rpx;
    border-radius: 8rpx;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;

    &.status-pending {
      @include status-tag($warning-color);
    }

    &.status-ongoing {
      @include status-tag($secondary-color);
    }

    &.status-completed {
      @include status-tag($success-color);
    }
  }

  .order-time-compact {
    font-size: $font-size-xs;
    color: $text-hint;
  }
}

.order-content-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .order-location {
    flex: 1;
    font-size: $font-size-sm;
    color: $text-secondary;
    @include text-ellipsis;
  }

  .order-price {
    font-size: $font-size-lg;
    font-weight: $font-weight-bold;
    color: $primary-color;
    font-family: $font-family-monospace;

    &::before {
      content: '\00A5';
    }
  }
}

.empty-orders-compact {
  padding: $spacing-lg 0;
  text-align: center;

  .empty-text-compact {
    font-size: $font-size-sm;
    color: $text-secondary;
  }
}

// ========== 信用分 ==========
.credit-section-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-base;
  background: linear-gradient(135deg, rgba($primary-color, 0.2) 0%, rgba($secondary-color, 0.2) 100%);
  border-radius: $border-radius-base;
}

.credit-info {
  display: flex;
  align-items: baseline;
  gap: $spacing-sm;

  .credit-title-compact {
    font-size: $font-size-sm;
    color: $text-secondary;
  }

  .credit-score-compact {
    display: flex;
    align-items: baseline;
    gap: 4rpx;

    .score-value {
      font-size: 40rpx;
      font-weight: $font-weight-bold;
      color: $primary-color;
      font-family: $font-family-monospace;
    }

    .score-max {
      font-size: $font-size-sm;
      color: $text-secondary;
    }
  }
}

.credit-level-badge {
  padding: 8rpx 20rpx;
  border-radius: $border-radius-sm;
  font-size: $font-size-sm;
  font-weight: $font-weight-bold;

  &.level-gold {
    @include credit-badge('gold');
  }

  &.level-silver {
    @include credit-badge('silver');
  }

  &.level-normal {
    @include credit-badge('normal');
  }
}

// ========== FAB 悬浮按钮 ==========
.fab {
  position: fixed;
  right: 32rpx;
  bottom: 120rpx;
  width: 112rpx;
  height: 112rpx;
  z-index: 999;

  .fab-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 112rpx;
    height: 112rpx;
    background-color: #FFD700;
    border-radius: 56rpx;
  }

  .fab-icon {
    position: absolute;
    top: 0;
    left: 0;
    width: 112rpx;
    height: 112rpx;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 72rpx;
    font-weight: 200;
    color: #000000;
    line-height: 112rpx;
    text-align: center;
  }
}

// ========== 演员详情弹窗 ==========
.actor-detail-popup {
  background-color: $bg-secondary;
  border-radius: $border-radius-lg $border-radius-lg 0 0;
  max-height: 90vh;
  overflow: hidden;
}

.popup-header {
  position: relative;
  padding: $spacing-lg;
  background: linear-gradient(135deg, $primary-color 0%, #FFED4E 100%);
  text-align: center;

  .popup-title {
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    color: $black;
  }

  .popup-close {
    position: absolute;
    right: $spacing-lg;
    top: $spacing-lg;
  }
}

.actor-detail-content {
  padding: $spacing-lg;
}

.video-card-preview {
  width: 100%;
  height: 400rpx;
  background-color: $bg-tertiary;
  border-radius: $border-radius-base;
  margin-bottom: $spacing-lg;
  overflow: hidden;

  .video-player {
    width: 100%;
    height: 100%;
  }

  .video-placeholder {
    width: 100%;
    height: 100%;
    @include flex-center;
    @include flex-column;
    gap: $spacing-base;

    .placeholder-text {
      font-size: $font-size-base;
      color: $text-secondary;
    }
  }
}

.detail-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-base;
  margin-bottom: $spacing-lg;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;

  .info-label {
    font-size: $font-size-sm;
    color: $text-secondary;
  }

  .info-value {
    font-size: $font-size-lg;
    font-weight: $font-weight-medium;
    color: $text-primary;
  }
}

.detail-skills {
  margin-bottom: $spacing-lg;

  .skills-label {
    display: block;
    font-size: $font-size-sm;
    color: $text-secondary;
    margin-bottom: $spacing-sm;
  }

  .skills-list {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  .skill-tag-large {
    padding: 8rpx 20rpx;
    background-color: rgba($primary-color, 0.15);
    border: 1rpx solid $primary-color;
    border-radius: $border-radius-base;
    color: $primary-color;
    font-size: $font-size-base;
  }
}

.btn-invite {
  @include button-primary;
  width: 100%;
  margin-top: $spacing-base;
}
</style>
