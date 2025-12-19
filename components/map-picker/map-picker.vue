<template>
  <view class="map-picker">
    <map
      id="orderMap"
      class="map-container"
      :latitude="mapCenter.latitude"
      :longitude="mapCenter.longitude"
      :markers="markers"
      :show-location="true"
      @markertap="onMarkerTap"
      @regionchange="onRegionChange"
    >
      <!-- 中心点标记 -->
      <cover-view class="map-center-marker">
        <cover-image
          class="marker-icon"
          src="/static/location-pin.png"
        />
      </cover-view>

      <!-- 控制按钮 -->
      <cover-view class="map-controls">
        <cover-view class="control-btn" @tap="getMyLocation">
          <cover-image class="control-icon" src="/static/location.png" />
        </cover-view>
      </cover-view>
    </map>

    <!-- 地址信息面板 -->
    <view class="address-panel">
      <view class="panel-content">
        <view class="address-info">
          <text class="address-title">{{ currentAddress.name || '选择位置' }}</text>
          <text class="address-detail">{{ currentAddress.address || '移动地图选择地点' }}</text>
        </view>
        <button class="confirm-btn" type="primary" @click="confirmLocation">
          确认选择
        </button>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'MapPicker',
  props: {
    // 初始位置
    initLocation: {
      type: Object,
      default: () => ({
        latitude: 39.908823,
        longitude: 116.397470
      })
    }
  },

  data() {
    return {
      mapCenter: {
        latitude: 39.908823,
        longitude: 116.397470
      },
      markers: [],
      currentAddress: {
        name: '',
        address: '',
        latitude: 0,
        longitude: 0
      }
    }
  },

  mounted() {
    // 初始化地图中心点
    if (this.initLocation.latitude && this.initLocation.longitude) {
      this.mapCenter = {
        latitude: this.initLocation.latitude,
        longitude: this.initLocation.longitude
      }
    } else {
      // 获取当前位置
      this.getMyLocation()
    }
  },

  methods: {
    // 获取当前位置
    getMyLocation() {
      uni.showLoading({ title: '定位中...' })

      uni.getLocation({
        type: 'gcj02',
        success: (res) => {
          this.mapCenter = {
            latitude: res.latitude,
            longitude: res.longitude
          }
          this.getAddressFromLocation(res.latitude, res.longitude)
          uni.hideLoading()
        },
        fail: (err) => {
          console.error('获取位置失败:', err)
          uni.hideLoading()
          uni.showToast({
            title: '定位失败,请检查权限',
            icon: 'none'
          })
        }
      })
    },

    // 地图区域变化
    onRegionChange(e) {
      if (e.type === 'end' && e.causedBy === 'drag') {
        // 用户拖动地图结束,获取中心点坐标
        this.getCenterLocation()
      }
    },

    // 获取地图中心点坐标
    getCenterLocation() {
      const mapContext = uni.createMapContext('orderMap', this)
      mapContext.getCenterLocation({
        success: (res) => {
          this.getAddressFromLocation(res.latitude, res.longitude)
        }
      })
    },

    // 根据坐标获取地址 (逆地理编码)
    async getAddressFromLocation(latitude, longitude) {
      try {
        // 调用云函数进行逆地理编码
        const res = await uniCloud.callFunction({
          name: 'geo-service',
          data: {
            action: 'regeo',
            longitude,
            latitude
          }
        })

        if (res.result && res.result.code === 0) {
          this.currentAddress = {
            name: res.result.data.name || '选中位置',
            address: res.result.data.address || `经度:${longitude.toFixed(6)}, 纬度:${latitude.toFixed(6)}`,
            latitude: latitude,
            longitude: longitude
          }
        } else {
          // 逆地理编码失败时使用默认值
          this.currentAddress = {
            name: '选中位置',
            address: `经度:${longitude.toFixed(6)}, 纬度:${latitude.toFixed(6)}`,
            latitude: latitude,
            longitude: longitude
          }
        }

      } catch (error) {
        console.error('获取地址失败:', error)
        // 出错时也使用默认值
        this.currentAddress = {
          name: '选中位置',
          address: `经度:${longitude.toFixed(6)}, 纬度:${latitude.toFixed(6)}`,
          latitude: latitude,
          longitude: longitude
        }
      }
    },

    // 点击标记
    onMarkerTap(e) {
      console.log('点击标记:', e)
    },

    // 确认选择位置
    confirmLocation() {
      if (!this.currentAddress.latitude || !this.currentAddress.longitude) {
        uni.showToast({
          title: '请选择有效位置',
          icon: 'none'
        })
        return
      }

      this.$emit('confirm', {
        name: this.currentAddress.name,
        address: this.currentAddress.address,
        latitude: this.currentAddress.latitude,
        longitude: this.currentAddress.longitude
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.map-picker {
  position: relative;
  width: 100%;
  height: 100vh;
}

.map-container {
  width: 100%;
  height: 100%;
}

// 中心点标记
.map-center-marker {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -100%);
  z-index: 10;

  .marker-icon {
    width: 40px;
    height: 40px;
  }
}

// 控制按钮
.map-controls {
  position: absolute;
  right: 15px;
  bottom: 250px;
  z-index: 10;

  .control-btn {
    width: 44px;
    height: 44px;
    background-color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    margin-bottom: 10px;

    .control-icon {
      width: 24px;
      height: 24px;
    }
  }
}

// 地址信息面板
.address-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #fff;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 20;

  .panel-content {
    padding: 20px;
  }

  .address-info {
    margin-bottom: 20px;

    .address-title {
      display: block;
      font-size: 16px;
      font-weight: 500;
      color: #333;
      margin-bottom: 8px;
    }

    .address-detail {
      display: block;
      font-size: 13px;
      color: #999;
      line-height: 1.5;
    }
  }

  .confirm-btn {
    width: 100%;
    height: 44px;
    font-size: 16px;
  }
}
</style>
