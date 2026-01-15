<template>
  <view class="enterprise-auth-page">
    <!-- 页面标题 -->
    <view class="page-header">
      <text class="header-title">企业认证</text>
      <text class="header-desc">完成企业认证,提升平台信誉度</text>
    </view>

    <!-- 认证状态显示 -->
    <view v-if="authStatus !== 'none'" class="status-card">
      <view v-if="authStatus === 'pending'" class="status-pending">
        <uni-icons type="info-filled" size="48" color="#FFC107"></uni-icons>
        <text class="status-title">认证审核中</text>
        <text class="status-desc">我们正在审核您的企业认证信息,请耐心等待</text>
        <text class="status-time">提交时间: {{ formatTime(submitTime) }}</text>
      </view>

      <view v-if="authStatus === 'approved'" class="status-approved">
        <uni-icons type="checkmarkempty" size="48" color="#4CAF50"></uni-icons>
        <text class="status-title">认证已通过</text>
        <text class="status-desc">{{ enterpriseName }}</text>
        <text class="status-time">认证时间: {{ formatTime(verifyTime) }}</text>
      </view>

      <view v-if="authStatus === 'rejected'" class="status-rejected">
        <uni-icons type="closeempty" size="48" color="#FF5252"></uni-icons>
        <text class="status-title">认证未通过</text>
        <text class="status-desc">{{ rejectReason || '请检查认证信息后重新提交' }}</text>
        <button class="retry-btn" @tap="resetForm">重新提交</button>
      </view>
    </view>

    <!-- 认证表单 -->
    <view v-if="authStatus === 'none' || authStatus === 'rejected'" class="form-container">
      <view class="form-section">
        <text class="section-title">企业基本信息</text>

        <view class="form-item">
          <text class="item-label">企业名称<text class="required">*</text></text>
          <input
            class="item-input"
            v-model="formData.enterprise_name"
            placeholder="请输入营业执照上的企业全称"
            maxlength="100"
          />
        </view>

        <view class="form-item">
          <text class="item-label">统一社会信用代码<text class="required">*</text></text>
          <input
            class="item-input"
            v-model="formData.enterprise_code"
            placeholder="请输入18位统一社会信用代码"
            maxlength="18"
          />
        </view>

        <view class="form-item">
          <text class="item-label">企业联系电话<text class="required">*</text></text>
          <input
            class="item-input"
            v-model="formData.contact_mobile"
            type="number"
            placeholder="请输入企业对外联系电话"
            maxlength="11"
          />
        </view>
      </view>

      <view class="form-section">
        <text class="section-title">法定代表人信息</text>

        <view class="form-item">
          <text class="item-label">法定代表人姓名<text class="required">*</text></text>
          <input
            class="item-input"
            v-model="formData.legal_representative"
            placeholder="请输入法人姓名"
            maxlength="20"
          />
        </view>

        <view class="form-item upload-item">
          <text class="item-label">法人身份证正面<text class="required">*</text></text>
          <view class="upload-area" @tap="uploadIdCardFront">
            <image
              v-if="formData.id_card_front"
              class="upload-preview"
              :src="formData.id_card_front"
              mode="aspectFill"
            ></image>
            <view v-else class="upload-placeholder">
              <uni-icons type="camera" size="48" color="#999"></uni-icons>
              <text class="upload-hint">点击上传</text>
            </view>
          </view>
        </view>

        <view class="form-item upload-item">
          <text class="item-label">法人身份证反面<text class="required">*</text></text>
          <view class="upload-area" @tap="uploadIdCardBack">
            <image
              v-if="formData.id_card_back"
              class="upload-preview"
              :src="formData.id_card_back"
              mode="aspectFill"
            ></image>
            <view v-else class="upload-placeholder">
              <uni-icons type="camera" size="48" color="#999"></uni-icons>
              <text class="upload-hint">点击上传</text>
            </view>
          </view>
        </view>
      </view>

      <view class="form-section">
        <text class="section-title">营业执照</text>

        <view class="form-item upload-item">
          <text class="item-label">营业执照照片<text class="required">*</text></text>
          <view class="upload-area upload-large" @tap="uploadBusinessLicense">
            <image
              v-if="formData.business_license"
              class="upload-preview"
              :src="formData.business_license"
              mode="aspectFill"
            ></image>
            <view v-else class="upload-placeholder">
              <uni-icons type="camera" size="64" color="#999"></uni-icons>
              <text class="upload-hint">点击上传营业执照</text>
              <text class="upload-tip">请确保照片清晰完整</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 提交按钮 -->
      <view class="submit-section">
        <button
          class="submit-btn"
          :class="{ disabled: !canSubmit }"
          :disabled="!canSubmit"
          @tap="submitAuth"
        >
          提交认证
        </button>
        <text class="submit-hint">提交后将由平台工作人员审核,请确保信息真实有效</text>
      </view>
    </view>

    <!-- 底部 TabBar -->
    <custom-tabbar role="crew" :current="2"></custom-tabbar>
  </view>
</template>

<script>
export default {
  data() {
    return {
      authStatus: 'none', // none, pending, approved, rejected
      submitTime: null,
      verifyTime: null,
      rejectReason: '',
      enterpriseName: '',

      formData: {
        enterprise_name: '',
        enterprise_code: '',
        business_license: '',
        legal_representative: '',
        id_card_front: '',
        id_card_back: '',
        contact_mobile: ''
      },

      uploading: false
    }
  },

  computed: {
    canSubmit() {
      const { enterprise_name, enterprise_code, business_license,
              legal_representative, id_card_front, id_card_back, contact_mobile } = this.formData

      return enterprise_name && enterprise_code && business_license &&
             legal_representative && id_card_front && id_card_back && contact_mobile
    }
  },

  onLoad() {
    this.loadAuthStatus()
  },

  methods: {
    async loadAuthStatus() {
      try {
        uni.showLoading({ title: '加载中...' })

        const userCo = uniCloud.importObject('user-co')
        const res = await userCo.getEnterpriseAuthStatus()

        if (res.code === 0) {
          this.authStatus = res.data.status
          this.submitTime = res.data.submit_time
          this.verifyTime = res.data.verify_time
          this.rejectReason = res.data.reject_reason
          this.enterpriseName = res.data.enterprise_name
        } else if (res.code === 403) {
          uni.showToast({ title: '仅剧组可以申请企业认证', icon: 'none' })
          setTimeout(() => {
            uni.navigateBack()
          }, 1500)
        } else {
          console.error('获取认证状态失败:', res.message)
        }
      } catch (error) {
        console.error('加载认证状态失败:', error)
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },

    // 上传法人身份证正面
    async uploadIdCardFront() {
      if (this.uploading) return
      await this.uploadImage('id_card_front')
    },

    // 上传法人身份证反面
    async uploadIdCardBack() {
      if (this.uploading) return
      await this.uploadImage('id_card_back')
    },

    // 上传营业执照
    async uploadBusinessLicense() {
      if (this.uploading) return
      await this.uploadImage('business_license')
    },

    // 通用图片上传方法
    async uploadImage(fieldName) {
      try {
        // 选择图片
        const chooseRes = await new Promise((resolve, reject) => {
          uni.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera'],
            success: resolve,
            fail: reject
          })
        })

        if (!chooseRes.tempFilePaths || chooseRes.tempFilePaths.length === 0) {
          return
        }

        this.uploading = true
        uni.showLoading({ title: '上传中...' })

        const filePath = chooseRes.tempFilePaths[0]
        const cloudPath = `enterprise_auth/${Date.now()}_${fieldName}.jpg`

        // 上传到云存储
        const uploadRes = await uniCloud.uploadFile({
          filePath: filePath,
          cloudPath: cloudPath
        })

        if (uploadRes.fileID) {
          this.formData[fieldName] = uploadRes.fileID
          uni.showToast({ title: '上传成功', icon: 'success' })
        } else {
          throw new Error('上传失败')
        }
      } catch (error) {
        console.error('上传图片失败:', error)
        uni.showToast({ title: '上传失败', icon: 'none' })
      } finally {
        this.uploading = false
        uni.hideLoading()
      }
    },

    // 提交认证
    async submitAuth() {
      if (!this.canSubmit) return

      // 表单验证
      if (this.formData.enterprise_code.length !== 18) {
        uni.showToast({ title: '统一社会信用代码必须为18位', icon: 'none' })
        return
      }

      if (!/^1[3-9]\d{9}$/.test(this.formData.contact_mobile)) {
        uni.showToast({ title: '请输入正确的手机号码', icon: 'none' })
        return
      }

      try {
        uni.showLoading({ title: '提交中...' })

        const userCo = uniCloud.importObject('user-co')
        const res = await userCo.submitEnterpriseAuth(this.formData)

        if (res.code === 0) {
          uni.showToast({ title: '提交成功', icon: 'success' })

          // 等待提示显示后刷新状态
          setTimeout(() => {
            this.loadAuthStatus()
          }, 1500)
        } else {
          uni.showToast({ title: res.message || '提交失败', icon: 'none' })
        }
      } catch (error) {
        console.error('提交认证失败:', error)
        uni.showToast({ title: '提交失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },

    // 重置表单
    resetForm() {
      this.authStatus = 'none'
      this.formData = {
        enterprise_name: '',
        enterprise_code: '',
        business_license: '',
        legal_representative: '',
        id_card_front: '',
        id_card_back: '',
        contact_mobile: ''
      }
    },

    // 格式化时间
    formatTime(timestamp) {
      if (!timestamp) return ''

      const date = new Date(timestamp)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')

      return `${year}-${month}-${day} ${hour}:${minute}`
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/common/theme.scss';

.enterprise-auth-page {
  min-height: 100vh;
  background-color: $bg-primary;
  padding-bottom: 100rpx;
}

.page-header {
  padding: $spacing-lg $spacing-base;
  background: linear-gradient(135deg, $bg-secondary 0%, $bg-tertiary 100%);

  .header-title {
    display: block;
    font-size: $font-size-xl;
    font-weight: bold;
    color: $text-primary;
    margin-bottom: $spacing-xs;
  }

  .header-desc {
    display: block;
    font-size: $font-size-sm;
    color: $text-secondary;
  }
}

.status-card {
  margin: $spacing-base;
  padding: $spacing-lg;
  background-color: $bg-secondary;
  border-radius: $border-radius-lg;

  .status-pending,
  .status-approved,
  .status-rejected {
    display: flex;
    flex-direction: column;
    align-items: center;

    .status-title {
      font-size: $font-size-lg;
      font-weight: bold;
      color: $text-primary;
      margin-top: $spacing-base;
    }

    .status-desc {
      font-size: $font-size-base;
      color: $text-secondary;
      margin-top: $spacing-sm;
      text-align: center;
    }

    .status-time {
      font-size: $font-size-sm;
      color: $text-hint;
      margin-top: $spacing-base;
    }
  }

  .retry-btn {
    margin-top: $spacing-lg;
    padding: $spacing-sm $spacing-xl;
    background-color: $primary-color;
    color: $text-primary;
    border-radius: $border-radius-base;
    border: none;
    font-size: $font-size-base;
  }
}

.form-container {
  padding: $spacing-base;
}

.form-section {
  margin-bottom: $spacing-lg;
  padding: $spacing-base;
  background-color: $bg-secondary;
  border-radius: $border-radius-lg;

  .section-title {
    display: block;
    font-size: $font-size-lg;
    font-weight: bold;
    color: $text-primary;
    margin-bottom: $spacing-base;
    padding-bottom: $spacing-sm;
    border-bottom: 2rpx solid $bg-tertiary;
  }
}

.form-item {
  margin-bottom: $spacing-base;

  &:last-child {
    margin-bottom: 0;
  }

  .item-label {
    display: block;
    font-size: $font-size-base;
    color: $text-primary;
    margin-bottom: $spacing-sm;

    .required {
      color: $alert-color;
      margin-left: 4rpx;
    }
  }

  .item-input {
    width: 100%;
    height: 80rpx;
    padding: 0 $spacing-base;
    background-color: $bg-tertiary;
    border-radius: $border-radius-base;
    color: $text-primary;
    font-size: $font-size-base;
    border: 2rpx solid transparent;
    transition: border-color 0.3s;

    &:focus {
      border-color: $primary-color;
    }
  }
}

.upload-item {
  .upload-area {
    width: 100%;
    height: 300rpx;
    background-color: $bg-tertiary;
    border-radius: $border-radius-base;
    overflow: hidden;
    position: relative;

    &.upload-large {
      height: 400rpx;
    }

    .upload-preview {
      width: 100%;
      height: 100%;
    }

    .upload-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;

      .upload-hint {
        font-size: $font-size-base;
        color: $text-secondary;
        margin-top: $spacing-sm;
      }

      .upload-tip {
        font-size: $font-size-sm;
        color: $text-hint;
        margin-top: $spacing-xs;
      }
    }
  }
}

.submit-section {
  margin-top: $spacing-xl;
  padding: $spacing-base;

  .submit-btn {
    width: 100%;
    height: 88rpx;
    background: linear-gradient(135deg, $primary-color 0%, #FFA500 100%);
    color: $bg-primary;
    font-size: $font-size-lg;
    font-weight: bold;
    border-radius: $border-radius-base;
    border: none;

    &.disabled {
      background: $bg-tertiary;
      color: $text-hint;
    }
  }

  .submit-hint {
    display: block;
    font-size: $font-size-sm;
    color: $text-hint;
    text-align: center;
    margin-top: $spacing-base;
    line-height: 1.6;
  }
}
</style>
