<template>
  <view class="post-order-page">
    <uni-forms ref="formRef" :modelValue="formData" :rules="rules" label-width="100">

      <!-- 基本信息 -->
      <view class="form-section">
        <view class="section-title">基本信息</view>
        <uni-forms-item label="需要人数" name="people_needed" required>
          <uni-easyinput
            v-model="formData.people_needed"
            type="number"
            placeholder="请输入需要人数"
          />
        </uni-forms-item>

        <uni-forms-item label="角色描述" name="role_description">
          <uni-easyinput
            v-model="formData.role_description"
            type="textarea"
            placeholder="请描述角色要求和工作内容"
            :inputBorder="false"
          />
        </uni-forms-item>
      </view>

      <!-- 集合信息 -->
      <view class="form-section">
        <view class="section-title">集合信息</view>
        <uni-forms-item label="集合地点" name="meeting_location_name" required>
          <view class="location-picker" @click="openMapPicker">
            <text v-if="formData.meeting_location_name" class="location-text">
              {{ formData.meeting_location_name }}
            </text>
            <text v-else class="placeholder-text">点击选择集合地点</text>
            <uni-icons type="location" size="20" color="#007aff"></uni-icons>
          </view>
        </uni-forms-item>

        <uni-forms-item label="集合时间" name="meeting_time" required>
          <view class="datetime-picker-wrapper" @click="showDateTimePicker">
            <text v-if="formData.meeting_time" class="datetime-text">
              {{ formatTimestamp(formData.meeting_time) }}
            </text>
            <text v-else class="datetime-placeholder">请选择集合时间</text>
            <uni-icons type="calendar" size="20" color="#999"></uni-icons>
          </view>
        </uni-forms-item>
      </view>

      <!-- 筛选条件 -->
      <view class="form-section">
        <view class="section-title">演员要求</view>
        <uni-forms-item label="性别要求" name="gender_requirement">
          <uni-data-checkbox
            v-model="formData.gender_requirement"
            :localdata="genderOptions"
            mode="default"
          />
        </uni-forms-item>

        <uni-forms-item label="身高范围" name="height_range">
          <view class="height-range">
            <uni-easyinput
              v-model="formData.height_min"
              type="number"
              placeholder="最低"
              class="height-input"
            />
            <text class="range-separator">-</text>
            <uni-easyinput
              v-model="formData.height_max"
              type="number"
              placeholder="最高"
              class="height-input"
            />
            <text class="unit-text">cm</text>
          </view>
        </uni-forms-item>

        <uni-forms-item label="体型要求" name="body_type">
          <uni-data-checkbox
            v-model="formData.body_type"
            :localdata="bodyTypeOptions"
            multiple
            mode="tag"
          />
        </uni-forms-item>

        <uni-forms-item label="特长要求" name="special_skills">
          <uni-data-checkbox
            v-model="formData.special_skills"
            :localdata="skillOptions"
            multiple
            mode="tag"
          />
        </uni-forms-item>
      </view>

      <!-- 福利标签 -->
      <view class="form-section">
        <view class="section-title">福利待遇</view>
        <uni-forms-item label="福利标签" name="welfare_tags">
          <uni-data-checkbox
            v-model="formData.welfare_tags"
            :localdata="welfareOptions"
            multiple
            mode="tag"
            selectedColor="#52c41a"
          />
        </uni-forms-item>
      </view>

      <!-- 定价设置 -->
      <view class="form-section">
        <view class="section-title">定价设置</view>
        <uni-forms-item label="计费方式" name="price_type" required>
          <uni-data-checkbox
            v-model="formData.price_type"
            :localdata="priceTypeOptions"
            mode="default"
          />
        </uni-forms-item>

        <uni-forms-item label="金额" name="price_amount" required>
          <view class="price-input-wrapper">
            <uni-easyinput
              v-model="formData.price_amount"
              type="number"
              placeholder="请输入金额"
            />
            <text class="unit-text">元</text>
          </view>
          <view class="price-tip">
            <text class="tip-text">
              {{ formData.price_type === 'daily' ? '按天计费' : '按小时计费' }}
            </text>
          </view>
        </uni-forms-item>
      </view>

      <!-- 备注 -->
      <view class="form-section">
        <view class="section-title">其他信息</view>
        <uni-forms-item label="备注" name="remark">
          <uni-easyinput
            v-model="formData.remark"
            type="textarea"
            placeholder="其他补充说明"
            :inputBorder="false"
          />
        </uni-forms-item>
      </view>

    </uni-forms>

    <!-- 日期时间选择弹窗 -->
    <uni-popup ref="dateTimePopup" type="bottom" class="datetime-popup-wrapper">
      <view class="datetime-popup">
        <view class="popup-header">
          <text class="popup-title">选择集合时间</text>
          <view class="popup-close" @tap="closeDateTimePicker">
            <uni-icons type="close" size="24" color="#666"></uni-icons>
          </view>
        </view>

        <view class="picker-content">
          <view class="picker-item">
            <text class="picker-label">日期</text>
            <picker mode="date" :value="tempDate" :start="minDate" @change="onDateChange">
              <view class="picker-value">
                <text>{{ tempDate || '请选择日期' }}</text>
                <uni-icons type="forward" size="16" color="#999"></uni-icons>
              </view>
            </picker>
          </view>

          <view class="picker-item">
            <text class="picker-label">时间</text>
            <picker mode="time" :value="tempTime" @change="onTempTimeChange">
              <view class="picker-value">
                <text>{{ tempTime || '请选择时间' }}</text>
                <uni-icons type="forward" size="16" color="#999"></uni-icons>
              </view>
            </picker>
          </view>
        </view>

        <view class="popup-footer">
          <button class="cancel-btn" @tap="closeDateTimePicker">取消</button>
          <button class="confirm-btn" type="primary" @tap="confirmDateTime">确定</button>
        </view>
      </view>
    </uni-popup>

    <!-- 提交按钮 -->
    <view class="submit-section">
      <view class="order-type-tip">
        <text class="tip-icon">💡</text>
        <text class="tip-text">{{ orderTypeTip }}</text>
      </view>
      <view v-if="formData.meeting_time" class="time-debug">
        <text>已选时间: {{ formatTimestamp(formData.meeting_time) }}</text>
      </view>
      <button class="submit-btn" type="primary" @click="handleSubmit">发布需求</button>
    </view>

  </view>
</template>

<script>
export default {
  data() {
    return {
      // 临时日期时间
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

      // 性别选项
      genderOptions: [
        { value: 0, text: '不限' },
        { value: 1, text: '男' },
        { value: 2, text: '女' }
      ],

      // 体型选项
      bodyTypeOptions: [
        { value: 'slim', text: '偏瘦' },
        { value: 'normal', text: '标准' },
        { value: 'athletic', text: '健壮' },
        { value: 'plus', text: '微胖' }
      ],

      // 特长选项
      skillOptions: [
        { value: 'driving', text: '会开车' },
        { value: 'dancing', text: '会跳舞' },
        { value: 'singing', text: '会唱歌' },
        { value: 'martial_arts', text: '会武术' },
        { value: 'swimming', text: '会游泳' },
        { value: 'riding', text: '会骑马' },
        { value: 'instrument', text: '会乐器' },
        { value: 'foreign_language', text: '会外语' }
      ],

      // 福利标签选项
      welfareOptions: [
        { value: 'meal', text: '包盒饭' },
        { value: 'taxi', text: '包来回车费' },
        { value: 'accommodation', text: '提供住宿' },
        { value: 'tea', text: '有奶茶/下午茶' },
        { value: 'other', text: '其他福利' }
      ],

      // 计费方式选项
      priceTypeOptions: [
        { value: 'daily', text: '按天' },
        { value: 'hourly', text: '按时' }
      ],

      // 表单校验规则
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
    // 订单类型提示
    orderTypeTip() {
      if (!this.formData.meeting_time) {
        return '请先选择集合时间'
      }
      const meetingTime = new Date(this.formData.meeting_time).getTime()
      const now = Date.now()
      const diffHours = (meetingTime - now) / (1000 * 60 * 60)

      if (diffHours < 2) {
        return '即时单:接单后立即开启实时定位追踪'
      } else {
        return '预约单:演员出发后开启定位,保护隐私省电'
      }
    }
  },

  mounted() {
    // 设置最小日期为今天
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    this.minDate = `${year}-${month}-${day}`
  },

  methods: {
    // 格式化时间戳
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

    // 显示日期时间选择器
    showDateTimePicker() {
      // 如果已有值，初始化临时值
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

    // 关闭日期时间选择器
    closeDateTimePicker() {
      this.$refs.dateTimePopup.close()
    },

    // 日期变化
    onDateChange(e) {
      this.tempDate = e.detail.value
    },

    // 时间变化
    onTempTimeChange(e) {
      this.tempTime = e.detail.value
    },

    // 确认选择
    confirmDateTime() {
      if (!this.tempDate || !this.tempTime) {
        uni.showToast({
          title: '请选择完整的日期和时间',
          icon: 'none'
        })
        return
      }

      // 组合日期和时间 - 使用 iOS 兼容的格式 yyyy/MM/dd HH:mm:ss
      const dateTimeStr = `${this.tempDate.replace(/-/g, '/')} ${this.tempTime}:00`
      const timestamp = new Date(dateTimeStr).getTime()

      // 验证时间必须晚于当前时间
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

    // 打开地图选点
    openMapPicker() {
      uni.chooseLocation({
        success: async (res) => {
          // 优先使用name,如果没有则尝试逆地理编码
          if (res.name) {
            this.formData.meeting_location_name = res.name
          } else if (res.address) {
            this.formData.meeting_location_name = res.address
          } else {
            // 调用地理编码服务获取详细地址
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

    // 根据坐标获取地址
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
      return `位置 (${longitude.toFixed(6)}, ${latitude.toFixed(6)})`
    },

    // 提交表单
    async handleSubmit() {
      try {
        // 表单校验
        await this.$refs.formRef.validate()

        // 显示加载
        uni.showLoading({
          title: '发布中...',
          mask: true
        })

        // 准备提交数据
        const submitData = {
          ...this.formData,
          people_needed: parseInt(this.formData.people_needed),
          height_min: this.formData.height_min ? parseInt(this.formData.height_min) : 0,
          height_max: this.formData.height_max ? parseInt(this.formData.height_max) : 0,
          price_amount: Math.round(parseFloat(this.formData.price_amount) * 100) // 转换为分
        }

        console.log('=== Debug: submitData ===', submitData)

        // 调用云对象
        const orderCo = uniCloud.importObject('order-co')

        // 先测试 token 是否正常
        console.log('=== Debug: testing token ===')
        try {
          const tokenTest = await orderCo.testToken()
          console.log('=== Debug: testToken result ===', tokenTest)
        } catch (tokenErr) {
          console.error('=== Debug: testToken error ===', tokenErr)
        }

        console.log('=== Debug: calling add ===')
        const result = await orderCo.add(submitData)
        console.log('=== Debug: add result ===', result)

        uni.hideLoading()

        if (result.code === 0) {
          uni.showToast({
            title: '发布成功',
            icon: 'success'
          })

          // 延迟跳转到订单列表
          setTimeout(() => {
            // 获取当前页面栈
            const pages = getCurrentPages()
            if (pages.length > 1) {
              // 如果有上一页，则返回
              uni.navigateBack({
                delta: 1
              })
            } else {
              // 如果没有上一页，跳转到订单列表
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
          // 表单校验错误
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
// 全局样式：提升弹窗层级
.datetime-popup-wrapper {
  z-index: 10000 !important;
}
</style>

<style lang="scss" scoped>
.post-order-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 20px;
}

// 表单分组
.form-section {
  margin-bottom: 15px;
  background-color: #fff;

  .section-title {
    padding: 15px;
    font-size: 15px;
    font-weight: 500;
    color: #333;
    border-bottom: 1px solid #e5e5e5;
  }
}

// 地点选择器
.location-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 15px;
  background-color: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 4px;

  .location-text {
    flex: 1;
    font-size: 14px;
    color: #333;
  }

  .placeholder-text {
    flex: 1;
    font-size: 14px;
    color: #999;
  }
}

// 日期时间选择器
.datetime-picker-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 15px;
  background-color: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 4px;

  .datetime-text {
    flex: 1;
    font-size: 14px;
    color: #333;
  }

  .datetime-placeholder {
    flex: 1;
    font-size: 14px;
    color: #999;
  }
}

// 日期时间选择弹窗
.datetime-popup {
  background-color: #fff;
  border-radius: 16px 16px 0 0;
  padding: 20px;
  padding-bottom: 30px;
  max-height: 80vh;
  overflow-y: auto;

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;

    .popup-title {
      font-size: 18px;
      font-weight: 500;
      color: #333;
    }

    .popup-close {
      padding: 5px;
    }
  }

  .picker-content {
    .picker-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 15px 0;
      border-bottom: 1px solid #f0f0f0;

      .picker-label {
        font-size: 15px;
        color: #333;
        min-width: 60px;
      }

      .picker-value {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        color: #666;
        font-size: 15px;
      }
    }
  }

  .popup-footer {
    display: flex;
    gap: 15px;
    margin-top: 20px;
    padding-bottom: env(safe-area-inset-bottom);

    button {
      flex: 1;
      height: 44px;
      border-radius: 8px;
      font-size: 16px;
    }

    .cancel-btn {
      background-color: #f5f5f5;
      color: #666;
    }

    .confirm-btn {
      background-color: #007aff;
      color: #fff;
    }
  }
}

// 身高范围
.height-range {
  display: flex;
  align-items: center;
  gap: 10px;

  .height-input {
    flex: 1;
  }

  .range-separator {
    font-size: 16px;
    color: #999;
  }

  .unit-text {
    font-size: 14px;
    color: #666;
  }
}

// 金额输入
.price-input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;

  .unit-text {
    font-size: 14px;
    color: #666;
  }
}

.price-tip {
  margin-top: 5px;

  .tip-text {
    font-size: 12px;
    color: #999;
  }
}

// 提交区域
.submit-section {
  background-color: #fff;
  padding: 15px;
  margin-top: 15px;

  .order-type-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    padding: 10px;
    background-color: #e6f7ff;
    border-radius: 4px;

    .tip-icon {
      font-size: 18px;
    }

    .tip-text {
      flex: 1;
      font-size: 13px;
      color: #0050b3;
    }
  }

  .time-debug {
    margin-bottom: 10px;
    padding: 8px;
    background-color: #f0f0f0;
    border-radius: 4px;
    font-size: 12px;
    color: #666;
  }

  .submit-btn {
    width: 100%;
    height: 44px;
    font-size: 16px;
    font-weight: 500;
  }
}
</style>
