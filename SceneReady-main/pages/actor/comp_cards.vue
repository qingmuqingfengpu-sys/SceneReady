<template>
  <view class="comp-cards-page">
    <!-- 顶部操作栏 -->
    <view class="action-bar">
      <button class="upload-btn" @tap="chooseUpload">
        <uni-icons type="plusempty" size="20" color="#fff"></uni-icons>
        <text>上传模卡</text>
      </button>
    </view>

    <!-- 模卡列表 -->
    <view class="cards-container" v-if="compCards.length > 0">
      <view class="card-item" v-for="(card, index) in compCards" :key="index">
        <!-- 图片类型 -->
        <image
          v-if="card.type === 'image'"
          class="card-media"
          :src="card.url"
          mode="aspectFill"
          @tap="previewImage(index)"
        ></image>
        <!-- 视频类型 -->
        <video
          v-else
          class="card-media"
          :src="card.url"
          :controls="true"
          :show-center-play-btn="true"
          object-fit="cover"
        ></video>
        <!-- 类型标签 -->
        <view class="card-type-tag" :class="card.type">
          {{ card.type === 'image' ? '图片' : '视频' }}
        </view>
        <!-- 删除按钮 -->
        <view class="delete-btn" @tap.stop="deleteCard(index)">
          <uni-icons type="trash" size="18" color="#fff"></uni-icons>
        </view>
        <!-- 上传时间 -->
        <view class="card-time">
          {{ formatTime(card.create_time) }}
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-else>
      <uni-icons type="image" size="80" color="#ccc"></uni-icons>
      <text class="empty-text">暂无模卡</text>
      <text class="empty-hint">上传照片或视频展示你的形象</text>
      <button class="empty-upload-btn" @tap="chooseUpload">立即上传</button>
    </view>

    <!-- 上传类型选择弹窗 -->
    <uni-popup ref="uploadPopup" type="bottom">
      <view class="upload-options">
        <view class="upload-option" @tap="uploadMultiple('image')">
          <uni-icons type="image" size="28" color="#FFD700"></uni-icons>
          <text>上传图片</text>
          <text class="option-hint">支持多选，最多9张</text>
        </view>
        <view class="upload-option" @tap="uploadMultiple('video')">
          <uni-icons type="videocam" size="28" color="#FFD700"></uni-icons>
          <text>上传视频</text>
          <text class="option-hint">最长30秒</text>
        </view>
        <view class="upload-cancel" @tap="closeUploadPopup">取消</view>
      </view>
    </uni-popup>
  </view>
</template>

<script>
export default {
  data() {
    return {
      compCards: [],
      userId: ''
    }
  },

  onLoad() {
    this.loadCompCards()
  },

  onShow() {
    this.loadCompCards()
  },

  onPullDownRefresh() {
    this.loadCompCards().finally(() => {
      uni.stopPullDownRefresh()
    })
  },

  methods: {
    async loadCompCards() {
      try {
        const userInfo = await uniCloud.getCurrentUserInfo()
        if (!userInfo || !userInfo.uid) {
          uni.showToast({ title: '请先登录', icon: 'none' })
          return
        }
        this.userId = userInfo.uid

        const db = uniCloud.database()
        const res = await db.collection('uni-id-users').doc(userInfo.uid).field({
          comp_cards: true
        }).get()

        if (res.result.data && res.result.data.length > 0) {
          this.compCards = res.result.data[0].comp_cards || []
        }
      } catch (error) {
        console.error('加载模卡失败:', error)
        uni.showToast({ title: '加载失败', icon: 'none' })
      }
    },

    chooseUpload() {
      this.$refs.uploadPopup.open()
    },

    closeUploadPopup() {
      this.$refs.uploadPopup.close()
    },

    async uploadMultiple(type) {
      this.closeUploadPopup()

      try {
        let files = []

        if (type === 'image') {
          const chooseRes = await new Promise((resolve, reject) => {
            uni.chooseImage({
              count: 9,
              sizeType: ['compressed'],
              sourceType: ['album', 'camera'],
              success: resolve,
              fail: reject
            })
          })
          files = chooseRes.tempFilePaths
        } else {
          const chooseRes = await new Promise((resolve, reject) => {
            uni.chooseVideo({
              sourceType: ['album', 'camera'],
              maxDuration: 30,
              success: resolve,
              fail: reject
            })
          })
          files = [chooseRes.tempFilePath]
        }

        if (files.length === 0) return

        uni.showLoading({ title: '上传中...', mask: true })

        const newCards = []
        for (let i = 0; i < files.length; i++) {
          uni.showLoading({
            title: `上传中 ${i + 1}/${files.length}`,
            mask: true
          })

          const uploadRes = await uniCloud.uploadFile({
            filePath: files[i],
            cloudPath: `comp_cards/${Date.now()}_${i}_${type === 'image' ? 'img' : 'video'}`
          })

          newCards.push({
            type: type,
            url: uploadRes.fileID,
            create_time: Date.now()
          })
        }

        // 更新数据库
        const db = uniCloud.database()
        const updatedCards = [...this.compCards, ...newCards]

        await db.collection('uni-id-users').doc(this.userId).update({
          comp_cards: updatedCards
        })

        // 更新本地数据
        this.compCards = updatedCards

        uni.hideLoading()
        uni.showToast({
          title: `成功上传${newCards.length}个文件`,
          icon: 'success'
        })

      } catch (error) {
        uni.hideLoading()
        if (error.errMsg && error.errMsg.includes('cancel')) {
          return
        }
        console.error('上传失败:', error)
        uni.showToast({ title: '上传失败', icon: 'none' })
      }
    },

    async deleteCard(index) {
      uni.showModal({
        title: '确认删除',
        content: '确定要删除这张模卡吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              uni.showLoading({ title: '删除中...', mask: true })

              // 删除云存储中的文件
              const card = this.compCards[index]
              if (card.url) {
                try {
                  await uniCloud.deleteFile({ fileList: [card.url] })
                } catch (e) {
                  console.warn('删除云存储文件失败:', e)
                }
              }

              // 更新数据库
              const updatedCards = [...this.compCards]
              updatedCards.splice(index, 1)

              const db = uniCloud.database()
              await db.collection('uni-id-users').doc(this.userId).update({
                comp_cards: updatedCards
              })

              // 更新本地数据
              this.compCards = updatedCards

              uni.hideLoading()
              uni.showToast({ title: '删除成功', icon: 'success' })

            } catch (error) {
              uni.hideLoading()
              console.error('删除失败:', error)
              uni.showToast({ title: '删除失败', icon: 'none' })
            }
          }
        }
      })
    },

    previewImage(index) {
      const imageUrls = this.compCards
        .filter(card => card.type === 'image')
        .map(card => card.url)

      const currentUrl = this.compCards[index].url
      const currentIndex = imageUrls.indexOf(currentUrl)

      uni.previewImage({
        urls: imageUrls,
        current: currentIndex >= 0 ? currentIndex : 0
      })
    },

    formatTime(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      const month = date.getMonth() + 1
      const day = date.getDate()
      return `${month}月${day}日`
    }
  }
}
</script>

<style lang="scss" scoped>
.comp-cards-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
}

.action-bar {
  padding: 20rpx 30rpx;
  background: #fff;
  margin-bottom: 20rpx;
}

.upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #fff;
  border: none;
  border-radius: 50rpx;
  height: 80rpx;
  font-size: 30rpx;
  font-weight: bold;
}

.cards-container {
  display: flex;
  flex-wrap: wrap;
  padding: 0 20rpx;
  gap: 20rpx;
}

.card-item {
  position: relative;
  width: calc(50% - 10rpx);
  aspect-ratio: 3/4;
  border-radius: 16rpx;
  overflow: hidden;
  background: #000;
}

.card-media {
  width: 100%;
  height: 100%;
}

.card-type-tag {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  color: #fff;

  &.image {
    background: rgba(255, 215, 0, 0.9);
  }

  &.video {
    background: rgba(255, 87, 34, 0.9);
  }
}

.delete-btn {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: rgba(255, 59, 48, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-time {
  position: absolute;
  bottom: 16rpx;
  left: 16rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}

.empty-text {
  margin-top: 30rpx;
  font-size: 32rpx;
  color: #999;
}

.empty-hint {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #bbb;
}

.empty-upload-btn {
  margin-top: 40rpx;
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #fff;
  border: none;
  border-radius: 50rpx;
  padding: 20rpx 80rpx;
  font-size: 30rpx;
}

.upload-options {
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}

.upload-option {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 36rpx 40rpx;
  border-bottom: 1rpx solid #f0f0f0;

  text {
    font-size: 32rpx;
    color: #333;
  }

  .option-hint {
    margin-left: auto;
    font-size: 26rpx;
    color: #999;
  }
}

.upload-cancel {
  text-align: center;
  padding: 36rpx;
  font-size: 32rpx;
  color: #666;
  background: #f8f8f8;
}
</style>
