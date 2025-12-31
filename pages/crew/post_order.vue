<template>
  <view class="post-order-page">
    <uni-forms ref="formRef" :modelValue="formData" :rules="rules" label-width="100">

      <!-- 基本信息 -->
      <view class="form-section">
        <view class="section-header">
          <view class="section-icon">
            <uni-icons type="info-filled" size="18" color="#FFD700"></uni-icons>
          </view>
          <text class="section-title">基本信息</text>
        </view>
        <view class="section-content">
          <uni-forms-item label="需要人数" name="people_needed" required>
            <view class="custom-input-wrapper">
              <input
                class="custom-input"
                type="number"
                v-model="formData.people_needed"
                placeholder="请输入需要人数"
                placeholder-class="input-placeholder"
              />
              <text class="input-suffix">人</text>
            </view>
          </uni-forms-item>

          <uni-forms-item label="角色描述" name="role_description">
            <textarea
              class="custom-textarea"
              v-model="formData.role_description"
              placeholder="请描述角色要求和工作内容"
              placeholder-class="input-placeholder"
              :maxlength="200"
            ></textarea>
          </uni-forms-item>
        </view>
      </view>

      <!-- 集合信息 -->
      <view class="form-section">
        <view class="section-header">
          <view class="section-icon">
            <uni-icons type="location-filled" size="18" color="#2979FF"></uni-icons>
          </view>
          <text class="section-title">集合信息</text>
        </view>
        <view class="section-content">
          <uni-forms-item label="集合地点" name="meeting_location_name" required>
            <view class="picker-box" @click="openMapPicker">
              <text v-if="formData.meeting_location_name" class="picker-value">
                {{ formData.meeting_location_name }}
              </text>
              <text v-else class="picker-placeholder">点击选择集合地点</text>
              <uni-icons type="right" size="16" color="#666"></uni-icons>
            </view>
          </uni-forms-item>

          <uni-forms-item label="集合时间" name="meeting_time" required>
            <view class="picker-box" @click="showDateTimePicker">
              <text v-if="formData.meeting_time" class="picker-value">
                {{ formatTimestamp(formData.meeting_time) }}
              </text>
              <text v-else class="picker-placeholder">请选择集合时间</text>
              <uni-icons type="right" size="16" color="#666"></uni-icons>
            </view>
          </uni-forms-item>
        </view>
      </view>

      <!-- 筛选条件 -->
      <view class="form-section">
        <view class="section-header">
          <view class="section-icon">
            <uni-icons type="person-filled" size="18" color="#4CAF50"></uni-icons>
          </view>
          <text class="section-title">演员要求</text>
        </view>
        <view class="section-content">
          <uni-forms-item label="性别要求" name="gender_requirement">
            <view class="tag-group">
              <view
                v-for="item in genderOptions"
                :key="item.value"
                :class="['tag-item', { active: formData.gender_requirement === item.value }]"
                @click="formData.gender_requirement = item.value"
              >
                {{ item.text }}
              </view>
            </view>
          </uni-forms-item>

          <uni-forms-item label="身高范围" name="height_range">
            <view class="range-input-group">
              <input
                class="range-input"
                type="number"
                v-model="formData.height_min"
                placeholder="最低"
                placeholder-class="input-placeholder"
              />
              <text class="range-separator">-</text>
              <input
                class="range-input"
                type="number"
                v-model="formData.height_max"
                placeholder="最高"
                placeholder-class="input-placeholder"
              />
              <text class="range-unit">cm</text>
            </view>
          </uni-forms-item>

          <uni-forms-item label="体型要求" name="body_type">
            <view class="tag-group">
              <view
                v-for="item in bodyTypeOptions"
                :key="item.value"
                :class="['tag-item', { active: formData.body_type.includes(item.value) }]"
                @click="toggleArrayItem(formData.body_type, item.value)"
              >
                {{ item.text }}
              </view>
            </view>
          </uni-forms-item>

          <uni-forms-item label="特长要求" name="special_skills">
            <view class="tag-group wrap">
              <view
                v-for="item in skillOptions"
                :key="item.value"
                :class="['tag-item', { active: formData.special_skills.includes(item.value) }]"
                @click="toggleArrayItem(formData.special_skills, item.value)"
              >
                {{ item.text }}
              </view>
            </view>
          </uni-forms-item>
        </view>
      </view>

      <!-- 福利标签 -->
      <view class="form-section">
        <view class="section-header">
          <view class="section-icon">
            <uni-icons type="gift-filled" size="18" color="#FF9800"></uni-icons>
          </view>
          <text class="section-title">福利待遇</text>
        </view>
        <view class="section-content">
          <uni-forms-item label="福利标签" name="welfare_tags">
            <view class="tag-group wrap">
              <view
                v-for="item in welfareOptions"
                :key="item.value"
                :class="['tag-item welfare', { active: formData.welfare_tags.includes(item.value) }]"
                @click="toggleArrayItem(formData.welfare_tags, item.value)"
              >
                {{ item.text }}
              </view>
            </view>
          </uni-forms-item>
        </view>
      </view>

      <!-- 定价设置 -->
      <view class="form-section">
        <view class="section-header">
          <view class="section-icon">
            <uni-icons type="wallet-filled" size="18" color="#FFD700"></uni-icons>
          </view>
          <text class="section-title">定价设置</text>
        </view>
        <view class="section-content">
          <uni-forms-item label="计费方式" name="price_type" required>
            <view class="tag-group">
              <view
                v-for="item in priceTypeOptions"
                :key="item.value"
                :class="['tag-item', { active: formData.price_type === item.value }]"
                @click="formData.price_type = item.value"
              >
                {{ item.text }}
              </view>
            </view>
          </uni-forms-item>

          <uni-forms-item label="金额" name="price_amount" required>
            <view class="price-input-wrapper">
              <text class="price-prefix">$</text>
              <input
                class="price-input"
                type="digit"
                v-model="formData.price_amount"
                placeholder="0"
                placeholder-class="input-placeholder"
              />
              <text class="price-suffix">元/{{ formData.price_type === 'daily' ? '天' : '时' }}</text>
            </view>
          </uni-forms-item>
        </view>
      </view>

      <!-- 备注 -->
      <view class="form-section">
        <view class="section-header">
          <view class="section-icon">
            <uni-icons type="compose-filled" size="18" color="#9E9E9E"></uni-icons>
          </view>
          <text class="section-title">其他信息</text>
        </view>
        <view class="section-content">
          <uni-forms-item label="备注" name="remark">
            <textarea
              class="custom-textarea"
              v-model="formData.remark"
              placeholder="其他补充说明（选填）"
              placeholder-class="input-placeholder"
              :maxlength="200"
            ></textarea>
          </uni-forms-item>
        </view>
      </view>

    </uni-forms>

    <!-- 日期时间选择弹窗 -->
    <uni-popup ref="dateTimePopup" type="bottom" class="datetime-popup-wrapper">
      <view class="datetime-popup">
        <view class="popup-header">
          <text class="popup-cancel" @tap="closeDateTimePicker">取消</text>
          <text class="popup-title">选择集合时间</text>
          <text class="popup-confirm" @tap="confirmDateTime">确定</text>
        </view>

        <view class="picker-content">
          <view class="picker-row">
            <text class="picker-label">日期</text>
            <picker mode="date" :value="tempDate" :start="minDate" @change="onDateChange">
              <view class="picker-value-box">
                <text class="picker-value-text">{{ tempDate || '请选择' }}</text>
                <uni-icons type="right" size="14" color="#666"></uni-icons>
              </view>
            </picker>
          </view>

          <view class="picker-row">
            <text class="picker-label">时间</text>
            <picker mode="time" :value="tempTime" @change="onTempTimeChange">
              <view class="picker-value-box">
                <text class="picker-value-text">{{ tempTime || '请选择' }}</text>
                <uni-icons type="right" size="14" color="#666"></uni-icons>
              </view>
            </picker>
          </view>
        </view>
      </view>
    </uni-popup>

    <!-- 提交区域 -->
    <view class="submit-section">
      <view class="order-type-tip">
        <view class="tip-icon-wrapper">
          <uni-icons type="info" size="16" color="#FFD700"></uni-icons>
        </view>
        <text class="tip-text">{{ orderTypeTip }}</text>
      </view>
      <button class="submit-btn" @click="handleSubmit">
        <text class="btn-text">发布需求</text>
      </button>
    </view>

  </view>
</template>

<script>
export default {
  data() {
    return {
      tempDate: '',
      tempTime: '',
      minDate: '',

      formData: {
        people_needed: 1,
        role_description: '',
        meeting_location_name: '',
        meeting_location: null,
        meeting_time: null,
        gender_requirement: 0,
        height_min: '',
        height_max: '',
        body_type: [],
        special_skills: [],
        welfare_tags: [],
        price_type: 'daily',
        price_amount: '',
        remark: ''
      },

      genderOptions: [
        { value: 0, text: '不限' },
        { value: 1, text: '男' },
        { value: 2, text: '女' }
      ],

      bodyTypeOptions: [
        { value: 'slim', text: '偏瘦' },
        { value: 'normal', text: '标准' },
        { value: 'athletic', text: '健壮' },
        { value: 'plus', text: '微胖' }
      ],

      skillOptions: [
        { value: 'driving', text: '开车' },
        { value: 'dancing', text: '跳舞' },
        { value: 'singing', text: '唱歌' },
        { value: 'martial_arts', text: '武术' },
        { value: 'swimming', text: '游泳' },
        { value: 'riding', text: '骑马' },
        { value: 'instrument', text: '乐器' },
        { value: 'foreign_language', text: '外语' }
      ],

      welfareOptions: [
        { value: 'meal', text: '包盒饭' },
        { value: 'taxi', text: '包车费' },
        { value: 'accommodation', text: '包住宿' },
        { value: 'tea', text: '有下午茶' },
        { value: 'other', text: '其他福利' }
      ],

      priceTypeOptions: [
        { value: 'daily', text: '按天' },
        { value: 'hourly', text: '按时' }
      ],

      rules: {
        people_needed: {
          rules: [
            { required: true, errorMessage: '请输入需要人数' },
            {
              validateFunction: (rule, value, data, callback) => {
                if (value < 1) {
                  callback('人数至少为1')
                }
                return true
              }
            }
          ]
        },
        meeting_location_name: {
          rules: [{ required: true, errorMessage: '请选择集合地点' }]
        },
        meeting_time: {
          rules: [
            { required: true, errorMessage: '请选择集合时间' },
            {
              validateFunction: (rule, value, data, callback) => {
                if (new Date(value).getTime() <= Date.now()) {
                  callback('集合时间必须晚于当前时间')
                }
                return true
              }
            }
          ]
        },
        price_type: {
          rules: [{ required: true, errorMessage: '请选择计费方式' }]
        },
        price_amount: {
          rules: [
            { required: true, errorMessage: '请输入金额' },
            {
              validateFunction: (rule, value, data, callback) => {
                if (value <= 0) {
                  callback('金额必须大于0')
                }
                return true
              }
            }
          ]
        }
      }
    }
  },

  computed: {
    orderTypeTip() {
      if (!this.formData.meeting_time) {
        return '请先选择集合时间'
      }
      const meetingTime = new Date(this.formData.meeting_time).getTime()
      const now = Date.now()
      const diffHours = (meetingTime - now) / (1000 * 60 * 60)

      if (diffHours < 2) {
        return '即时单: 接单后立即开启实时定位追踪'
      } else {
        return '预约单: 演员出发后开启定位，保护隐私省电'
      }
    }
  },

  mounted() {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    this.minDate = `${year}-${month}-${day}`
  },

  methods: {
    toggleArrayItem(arr, value) {
      const index = arr.indexOf(value)
      if (index > -1) {
        arr.splice(index, 1)
      } else {
        arr.push(value)
      }
    },

    formatTimestamp(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hour}:${minute}`
    },

    showDateTimePicker() {
      if (this.formData.meeting_time) {
        const date = new Date(this.formData.meeting_time)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hour = String(date.getHours()).padStart(2, '0')
        const minute = String(date.getMinutes()).padStart(2, '0')
        this.tempDate = `${year}-${month}-${day}`
        this.tempTime = `${hour}:${minute}`
      } else {
        this.tempDate = ''
        this.tempTime = ''
      }
      this.$refs.dateTimePopup.open()
    },

    closeDateTimePicker() {
      this.$refs.dateTimePopup.close()
    },

    onDateChange(e) {
      this.tempDate = e.detail.value
    },

    onTempTimeChange(e) {
      this.tempTime = e.detail.value
    },

    confirmDateTime() {
      if (!this.tempDate || !this.tempTime) {
        uni.showToast({
          title: '请选择完整的日期和时间',
          icon: 'none'
        })
        return
      }

      const dateTimeStr = `${this.tempDate.replace(/-/g, '/')} ${this.tempTime}:00`
      const timestamp = new Date(dateTimeStr).getTime()

      if (timestamp <= Date.now()) {
        uni.showToast({
          title: '集合时间必须晚于当前时间',
          icon: 'none'
        })
        return
      }

      this.formData.meeting_time = timestamp
      this.closeDateTimePicker()
    },

    openMapPicker() {
      uni.chooseLocation({
        success: async (res) => {
          if (res.name) {
            this.formData.meeting_location_name = res.name
          } else if (res.address) {
            this.formData.meeting_location_name = res.address
          } else {
            const address = await this.getAddressFromLocation(res.longitude, res.latitude)
            this.formData.meeting_location_name = address
          }

          this.formData.meeting_location = {
            type: 'Point',
            coordinates: [res.longitude, res.latitude]
          }
        },
        fail: (err) => {
          console.error('选择地点失败:', err)
          uni.showToast({
            title: '请授权位置权限',
            icon: 'none'
          })
        }
      })
    },

    async getAddressFromLocation(longitude, latitude) {
      try {
        const res = await uniCloud.callFunction({
          name: 'geo-service',
          data: {
            action: 'regeo',
            longitude,
            latitude
          }
        })

        if (res.result && res.result.code === 0) {
          return res.result.data.name || res.result.data.address
        }
      } catch (error) {
        console.error('获取地址失败:', error)
      }
      return `(${longitude.toFixed(4)}, ${latitude.toFixed(4)})`
    },

    async handleSubmit() {
      try {
        await this.$refs.formRef.validate()

        uni.showLoading({
          title: '发布中...',
          mask: true
        })

        const submitData = {
          ...this.formData,
          people_needed: parseInt(this.formData.people_needed),
          height_min: this.formData.height_min ? parseInt(this.formData.height_min) : 0,
          height_max: this.formData.height_max ? parseInt(this.formData.height_max) : 0,
          price_amount: Math.round(parseFloat(this.formData.price_amount) * 100)
        }

        const orderCo = uniCloud.importObject('order-co')
        const result = await orderCo.add(submitData)

        uni.hideLoading()

        if (result.code === 0) {
          uni.showToast({
            title: '发布成功',
            icon: 'success'
          })

          setTimeout(() => {
            const pages = getCurrentPages()
            if (pages.length > 1) {
              uni.navigateBack({
                delta: 1
              })
            } else {
              uni.redirectTo({
                url: '/pages/crew/order_list'
              })
            }
          }, 1500)
        } else {
          uni.showToast({
            title: result.message || '发布失败',
            icon: 'none'
          })
        }

      } catch (err) {
        uni.hideLoading()
        console.error('提交失败:', err)

        if (err.errMsg) {
          uni.showToast({
            title: '请完善必填信息',
            icon: 'none'
          })
        } else {
          uni.showToast({
            title: err.message || '提交失败',
            icon: 'none'
          })
        }
      }
    }
  }
}
</script>

<style lang="scss">
.datetime-popup-wrapper {
  z-index: 10000 !important;
}
</style>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.post-order-page {
  min-height: 100vh;
  background-color: $bg-primary;
  padding-bottom: 200rpx;
}

// 表单分组
.form-section {
  margin-bottom: $spacing-sm;
  background-color: $bg-secondary;

  .section-header {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-base;
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);

    .section-icon {
      width: 40rpx;
      height: 40rpx;
      @include flex-center;
    }

    .section-title {
      font-size: $font-size-lg;
      font-weight: $font-weight-bold;
      color: $text-primary;
    }
  }

  .section-content {
    padding: $spacing-sm $spacing-base;
  }
}

// uni-forms 样式覆盖
:deep(.uni-forms-item) {
  margin-bottom: $spacing-sm;

  .uni-forms-item__label {
    color: $text-secondary !important;
    font-size: $font-size-sm !important;
  }
}

// 自定义输入框
.custom-input-wrapper {
  display: flex;
  align-items: center;
  background-color: $bg-tertiary;
  border-radius: $border-radius-sm;
  padding: $spacing-sm $spacing-base;

  .custom-input {
    flex: 1;
    color: $text-primary;
    font-size: $font-size-base;
  }

  .input-suffix {
    color: $text-hint;
    font-size: $font-size-sm;
    margin-left: $spacing-sm;
  }
}

.custom-textarea {
  width: 100%;
  min-height: 160rpx;
  padding: $spacing-sm $spacing-base;
  background-color: $bg-tertiary;
  border-radius: $border-radius-sm;
  color: $text-primary;
  font-size: $font-size-base;
  box-sizing: border-box;
}

.input-placeholder {
  color: $text-hint;
}

// 选择框
.picker-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-sm $spacing-base;
  background-color: $bg-tertiary;
  border-radius: $border-radius-sm;

  .picker-value {
    flex: 1;
    font-size: $font-size-base;
    color: $text-primary;
    @include text-ellipsis;
  }

  .picker-placeholder {
    flex: 1;
    font-size: $font-size-base;
    color: $text-hint;
  }
}

// 标签组
.tag-group {
  display: flex;
  gap: $spacing-sm;

  &.wrap {
    flex-wrap: wrap;
  }

  .tag-item {
    padding: $spacing-xs $spacing-base;
    background-color: $bg-tertiary;
    border: 1rpx solid rgba(255, 255, 255, 0.1);
    border-radius: $border-radius-sm;
    color: $text-secondary;
    font-size: $font-size-sm;
    transition: all 0.2s;

    &.active {
      background-color: rgba($primary-color, 0.15);
      border-color: $primary-color;
      color: $primary-color;
    }

    &.welfare.active {
      background-color: rgba($success-color, 0.15);
      border-color: $success-color;
      color: $success-color;
    }
  }
}

// 范围输入
.range-input-group {
  display: flex;
  align-items: center;
  gap: $spacing-sm;

  .range-input {
    flex: 1;
    padding: $spacing-sm $spacing-base;
    background-color: $bg-tertiary;
    border-radius: $border-radius-sm;
    color: $text-primary;
    font-size: $font-size-base;
    text-align: center;
  }

  .range-separator {
    color: $text-hint;
    font-size: $font-size-lg;
  }

  .range-unit {
    color: $text-hint;
    font-size: $font-size-sm;
  }
}

// 价格输入
.price-input-wrapper {
  display: flex;
  align-items: center;
  background-color: $bg-tertiary;
  border-radius: $border-radius-sm;
  padding: $spacing-sm $spacing-base;

  .price-prefix {
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    color: $primary-color;
    margin-right: $spacing-xs;
  }

  .price-input {
    flex: 1;
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    color: $primary-color;
    font-family: $font-family-monospace;
  }

  .price-suffix {
    color: $text-hint;
    font-size: $font-size-sm;
    margin-left: $spacing-sm;
  }
}

// 日期时间弹窗
.datetime-popup {
  background-color: $bg-secondary;
  border-radius: $border-radius-lg $border-radius-lg 0 0;
  padding-bottom: env(safe-area-inset-bottom);

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $spacing-base;
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);

    .popup-cancel {
      font-size: $font-size-base;
      color: $text-secondary;
      padding: $spacing-xs $spacing-sm;
    }

    .popup-title {
      font-size: $font-size-lg;
      font-weight: $font-weight-bold;
      color: $text-primary;
    }

    .popup-confirm {
      font-size: $font-size-base;
      color: $primary-color;
      font-weight: $font-weight-bold;
      padding: $spacing-xs $spacing-sm;
    }
  }

  .picker-content {
    padding: $spacing-base;

    .picker-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: $spacing-base 0;
      border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);

      &:last-child {
        border-bottom: none;
      }

      .picker-label {
        font-size: $font-size-base;
        color: $text-secondary;
      }

      .picker-value-box {
        display: flex;
        align-items: center;
        gap: $spacing-sm;

        .picker-value-text {
          font-size: $font-size-base;
          color: $text-primary;
        }
      }
    }
  }
}

// 提交区域
.submit-section {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: $bg-secondary;
  padding: $spacing-base;
  padding-bottom: calc(#{$spacing-base} + env(safe-area-inset-bottom));
  border-top: 1rpx solid rgba(255, 255, 255, 0.1);

  .order-type-tip {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin-bottom: $spacing-base;
    padding: $spacing-sm $spacing-base;
    background-color: rgba($primary-color, 0.1);
    border-radius: $border-radius-sm;
    border: 1rpx solid rgba($primary-color, 0.3);

    .tip-icon-wrapper {
      flex-shrink: 0;
    }

    .tip-text {
      flex: 1;
      font-size: $font-size-sm;
      color: $primary-color;
    }
  }

  .submit-btn {
    @include button-primary;
    width: 100%;
    height: 88rpx;
    @include flex-center;

    .btn-text {
      font-size: $font-size-lg;
      font-weight: $font-weight-bold;
      color: $white;
    }
  }
}
</style>
