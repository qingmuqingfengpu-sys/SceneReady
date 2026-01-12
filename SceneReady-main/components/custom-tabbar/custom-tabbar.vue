<template>
  <view class="custom-tabbar-wrapper">
    <view class="custom-tabbar" :style="{ paddingBottom: safeAreaBottom + 'px' }">
      <view class="tabbar-content">
        <view
          v-for="(item, index) in tabList"
          :key="index"
          class="tabbar-item"
          :class="{ active: currentIndex === index }"
          @tap="switchTab(item, index)"
        >
          <view class="icon-wrapper">
            <uni-icons
              :type="currentIndex === index ? item.selectedIcon : item.icon"
              :size="24"
              :color="currentIndex === index ? '#FFD700' : '#666'"
            ></uni-icons>
            <!-- 角标 -->
            <view v-if="item.badge && item.badge > 0" class="badge">
              {{ item.badge > 99 ? '99+' : item.badge }}
            </view>
            <view v-else-if="item.dot" class="dot"></view>
          </view>
          <text class="tabbar-text">{{ item.text }}</text>
        </view>
      </view>
    </view>
    <!-- 占位元素，防止内容被遮挡 -->
    <view class="tabbar-placeholder" :style="{ height: (tabbarHeight + safeAreaBottom) + 'px' }"></view>
  </view>
</template>

<script>
// 演员端 TabBar 配置
const actorTabs = [
  {
    pagePath: '/pages/actor/index',
    text: '接单',
    icon: 'home',
    selectedIcon: 'home-filled'
  },
  {
    pagePath: '/pages/actor/my_orders',
    text: '订单',
    icon: 'list',
    selectedIcon: 'list'
  },
  {
    pagePath: '/pages/actor/profile',
    text: '我的',
    icon: 'person',
    selectedIcon: 'person-filled'
  }
]

// 剧组端 TabBar 配置
const crewTabs = [
  {
    pagePath: '/pages/crew/index',
    text: '首页',
    icon: 'home',
    selectedIcon: 'home-filled'
  },
  {
    pagePath: '/pages/crew/order_list',
    text: '订单',
    icon: 'list',
    selectedIcon: 'list'
  },
  {
    pagePath: '/pages/crew/profile',
    text: '我的',
    icon: 'person',
    selectedIcon: 'person-filled'
  }
]

export default {
  name: 'CustomTabbar',
  props: {
    // 角色类型: actor | crew
    role: {
      type: String,
      default: 'actor'
    },
    // 当前选中的索引
    current: {
      type: Number,
      default: 0
    },
    // 订单角标数量
    orderBadge: {
      type: Number,
      default: 0
    }
  },

  data() {
    return {
      currentIndex: 0,
      safeAreaBottom: 0,
      tabbarHeight: 100 // rpx to px roughly 50px
    }
  },

  computed: {
    tabList() {
      const tabs = this.role === 'crew' ? crewTabs : actorTabs
      // 为订单tab添加角标
      return tabs.map((tab, index) => {
        if (index === 1 && this.orderBadge > 0) {
          return { ...tab, badge: this.orderBadge }
        }
        return tab
      })
    }
  },

  watch: {
    current: {
      immediate: true,
      handler(val) {
        this.currentIndex = val
      }
    }
  },

  created() {
    this.getSafeArea()
  },

  methods: {
    // 获取安全区域
    getSafeArea() {
      const systemInfo = uni.getSystemInfoSync()
      // 获取底部安全区域高度
      if (systemInfo.safeAreaInsets) {
        this.safeAreaBottom = systemInfo.safeAreaInsets.bottom || 0
      } else if (systemInfo.safeArea) {
        this.safeAreaBottom = systemInfo.screenHeight - systemInfo.safeArea.bottom
      }
    },

    // 切换Tab
    switchTab(item, index) {
      if (this.currentIndex === index) {
        // 已经在当前页，触发刷新事件
        this.$emit('refresh')
        return
      }

      this.currentIndex = index
      this.$emit('change', index)

      // 使用 reLaunch 跳转，确保页面栈清晰
      uni.reLaunch({
        url: item.pagePath
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.custom-tabbar-wrapper {
  // wrapper 不需要额外样式，仅用于包裹
}

.custom-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  background: linear-gradient(180deg, #1E1E1E 0%, #151515 100%);
  border-top: 1rpx solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.3);
}

.tabbar-content {
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 100rpx;
}

.tabbar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  padding: 8rpx 0;
  transition: all 0.2s;

  &:active {
    opacity: 0.8;
  }

  &.active {
    .tabbar-text {
      color: #FFD700;
    }
  }
}

.icon-wrapper {
  position: relative;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge {
  position: absolute;
  top: -8rpx;
  right: -16rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  background-color: #FF5252;
  border-radius: 16rpx;
  font-size: 20rpx;
  color: #fff;
  text-align: center;
  line-height: 32rpx;
  font-weight: bold;
}

.dot {
  position: absolute;
  top: 0;
  right: -4rpx;
  width: 16rpx;
  height: 16rpx;
  background-color: #FF5252;
  border-radius: 50%;
}

.tabbar-text {
  font-size: 22rpx;
  color: #666;
  transition: color 0.2s;
}

.tabbar-placeholder {
  width: 100%;
  flex-shrink: 0;
}
</style>
