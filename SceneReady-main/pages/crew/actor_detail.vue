<template>
  <view class="actor-detail-page">
    <!-- 加载状态 -->
    <view v-if="loading" class="loading-container">
      <uni-load-more status="loading" :content-text="loadingText"></uni-load-more>
    </view>

    <!-- 演员信息 -->
    <view v-else-if="actorInfo" class="actor-content">
      <!-- 头部信息卡片（两个 Tab 共用） -->
      <view class="header-card">
        <view class="avatar-section">
          <image class="avatar" :src="displayAvatar" mode="aspectFill"></image>
          <view v-if="actorInfo.is_realname_auth" class="verified-badge">
            <uni-icons type="auth" size="16" color="#4CAF50"></uni-icons>
          </view>
        </view>
        <view class="basic-info">
          <view class="name-row">
            <text class="nickname">{{ actorInfo.nickname || '演员' }}</text>
            <view class="credit-badge" :class="creditClass">
              {{ actorInfo.credit_score_actor || 100 }}
            </view>
          </view>
          <view class="tags-row">
            <text class="tag" v-if="actorInfo.gender">{{ genderText }}</text>
            <text class="tag" v-if="actorInfo.height">{{ actorInfo.height }}cm</text>
            <text class="tag" v-if="actorInfo.body_type">{{ actorInfo.body_type }}</text>
          </view>
          <view class="auth-status">
            <uni-icons :type="actorInfo.is_realname_auth ? 'auth' : 'info'" size="14" :color="actorInfo.is_realname_auth ? '#4CAF50' : '#999'"></uni-icons>
            <text :class="actorInfo.is_realname_auth ? 'verified' : 'unverified'">
              {{ actorInfo.is_realname_auth ? '已实名认证' : '未实名认证' }}
            </text>
          </view>
        </view>
      </view>

      <!-- Tab 切换（仅当有 orderId 时显示） -->
      <view v-if="orderId" class="tab-container">
        <view class="tab-bar">
          <view
            class="tab-item"
            :class="{ active: currentTab === 0 }"
            @tap="switchTab(0)"
          >
            <text>资料</text>
          </view>
          <view
            class="tab-item"
            :class="{ active: currentTab === 1 }"
            @tap="switchTab(1)"
          >
            <text>履约追踪</text>
          </view>
        </view>
      </view>

      <!-- Tab 内容区域 -->
      <swiper
        v-if="orderId"
        class="tab-content-swiper"
        :current="currentTab"
        @change="onSwiperChange"
        :duration="200"
      >
        <!-- 资料 Tab -->
        <swiper-item>
          <scroll-view scroll-y class="tab-scroll-view">
            <view class="profile-content">
              <!-- 个人简介 -->
              <view class="info-card">
                <view class="card-title">
                  <uni-icons type="person" size="20" color="#FFD700"></uni-icons>
                  <text>个人简介</text>
                </view>
                <view class="card-content">
                  <text class="description">{{ actorInfo.description || '暂无个人简介' }}</text>
                </view>
              </view>

              <!-- 联系方式 -->
              <view class="info-card">
                <view class="card-title">
                  <uni-icons type="phone" size="20" color="#FFD700"></uni-icons>
                  <text>联系方式</text>
                </view>
                <view class="card-content">
                  <view class="contact-row" v-if="actorInfo.mobile">
                    <text class="contact-label">手机号</text>
                    <view class="contact-value-wrap">
                      <text class="contact-value">{{ actorInfo.mobile }}</text>
                      <view class="copy-btn" @tap="copyText(actorInfo.mobile, '手机号')">
                        <uni-icons type="copy" size="16" color="#FFD700"></uni-icons>
                      </view>
                    </view>
                  </view>
                  <view class="contact-row" v-if="actorInfo.wechat_id">
                    <text class="contact-label">微信号</text>
                    <view class="contact-value-wrap">
                      <text class="contact-value">{{ actorInfo.wechat_id }}</text>
                      <view class="copy-btn" @tap="copyText(actorInfo.wechat_id, '微信号')">
                        <uni-icons type="copy" size="16" color="#FFD700"></uni-icons>
                      </view>
                    </view>
                  </view>
                  <view v-if="!actorInfo.mobile && !actorInfo.wechat_id" class="no-contact">
                    <text>暂无联系方式</text>
                  </view>
                </view>
              </view>

              <!-- 详细信息 -->
              <view class="info-card">
                <view class="card-title">
                  <uni-icons type="bars" size="20" color="#FFD700"></uni-icons>
                  <text>详细信息</text>
                </view>
                <view class="card-content">
                  <view class="detail-row">
                    <text class="detail-label">性别</text>
                    <text class="detail-value">{{ genderText }}</text>
                  </view>
                  <view class="detail-row">
                    <text class="detail-label">身高</text>
                    <text class="detail-value">{{ actorInfo.height ? actorInfo.height + 'cm' : '未设置' }}</text>
                  </view>
                  <view class="detail-row">
                    <text class="detail-label">体型</text>
                    <text class="detail-value">{{ actorInfo.body_type || '未设置' }}</text>
                  </view>
                  <view class="detail-row">
                    <text class="detail-label">信用分</text>
                    <text class="detail-value credit" :class="creditClass">{{ actorInfo.credit_score_actor || 100 }}</text>
                  </view>
                  <view class="detail-row">
                    <text class="detail-label">实名认证</text>
                    <text class="detail-value" :class="actorInfo.is_realname_auth ? 'verified' : 'unverified'">
                      {{ actorInfo.is_realname_auth ? '已认证' : '未认证' }}
                    </text>
                  </view>
                  <view class="detail-row" v-if="actorInfo.skills && actorInfo.skills.length > 0">
                    <text class="detail-label">特长技能</text>
                    <view class="skills-wrap">
                      <text class="skill-tag" v-for="skill in actorInfo.skills" :key="skill">{{ getSkillLabel(skill) }}</text>
                    </view>
                  </view>
                </view>
              </view>

              <!-- 模卡展示 -->
              <view class="info-card" v-if="compCards.length > 0">
                <view class="card-title">
                  <uni-icons type="image" size="20" color="#FFD700"></uni-icons>
                  <text>模卡展示</text>
                  <text class="card-count">{{ compCards.length }}张</text>
                </view>
                <view class="card-content">
                  <view class="comp-cards-grid">
                    <view class="comp-card-item" v-for="(card, index) in compCards" :key="index" @tap="previewImage(index)">
                      <image
                        v-if="card.type === 'image' || !card.type"
                        :src="card.url"
                        mode="aspectFill"
                        class="comp-card-image"
                      ></image>
                      <view v-else class="video-card">
                        <video
                          :src="card.url"
                          :controls="false"
                          :show-play-btn="false"
                          :autoplay="false"
                          :muted="true"
                          class="comp-card-video"
                          object-fit="cover"
                        ></video>
                        <view class="video-mask">
                          <uni-icons type="videocam" size="24" color="#fff"></uni-icons>
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
              </view>

              <!-- 视频模卡 -->
              <view class="info-card" v-if="actorInfo.video_card_url">
                <view class="card-title">
                  <uni-icons type="videocam" size="20" color="#FFD700"></uni-icons>
                  <text>视频模卡</text>
                </view>
                <view class="card-content">
                  <video
                    :src="actorInfo.video_card_url"
                    class="video-player"
                    controls
                    object-fit="contain"
                  ></video>
                </view>
              </view>
            </view>
          </scroll-view>
        </swiper-item>

        <!-- 履约追踪 Tab -->
        <swiper-item>
          <tracking-map
            v-if="currentTab === 1"
            :order-id="orderId"
            :actor-id="actorId"
            @view-profile="onViewProfile"
            @completed="onTrackingCompleted"
          ></tracking-map>
        </swiper-item>
      </swiper>

      <!-- 无 orderId 时直接显示资料内容 -->
      <view v-else class="profile-content-full">
        <!-- 个人简介 -->
        <view class="info-card">
          <view class="card-title">
            <uni-icons type="person" size="20" color="#FFD700"></uni-icons>
            <text>个人简介</text>
          </view>
          <view class="card-content">
            <text class="description">{{ actorInfo.description || '暂无个人简介' }}</text>
          </view>
        </view>

        <!-- 联系方式 -->
        <view class="info-card">
          <view class="card-title">
            <uni-icons type="phone" size="20" color="#FFD700"></uni-icons>
            <text>联系方式</text>
          </view>
          <view class="card-content">
            <view class="contact-row" v-if="actorInfo.mobile">
              <text class="contact-label">手机号</text>
              <view class="contact-value-wrap">
                <text class="contact-value">{{ actorInfo.mobile }}</text>
                <view class="copy-btn" @tap="copyText(actorInfo.mobile, '手机号')">
                  <uni-icons type="copy" size="16" color="#FFD700"></uni-icons>
                </view>
              </view>
            </view>
            <view class="contact-row" v-if="actorInfo.wechat_id">
              <text class="contact-label">微信号</text>
              <view class="contact-value-wrap">
                <text class="contact-value">{{ actorInfo.wechat_id }}</text>
                <view class="copy-btn" @tap="copyText(actorInfo.wechat_id, '微信号')">
                  <uni-icons type="copy" size="16" color="#FFD700"></uni-icons>
                </view>
              </view>
            </view>
            <view v-if="!actorInfo.mobile && !actorInfo.wechat_id" class="no-contact">
              <text>暂无联系方式</text>
            </view>
          </view>
        </view>

        <!-- 详细信息 -->
        <view class="info-card">
          <view class="card-title">
            <uni-icons type="bars" size="20" color="#FFD700"></uni-icons>
            <text>详细信息</text>
          </view>
          <view class="card-content">
            <view class="detail-row">
              <text class="detail-label">性别</text>
              <text class="detail-value">{{ genderText }}</text>
            </view>
            <view class="detail-row">
              <text class="detail-label">身高</text>
              <text class="detail-value">{{ actorInfo.height ? actorInfo.height + 'cm' : '未设置' }}</text>
            </view>
            <view class="detail-row">
              <text class="detail-label">体型</text>
              <text class="detail-value">{{ actorInfo.body_type || '未设置' }}</text>
            </view>
            <view class="detail-row">
              <text class="detail-label">信用分</text>
              <text class="detail-value credit" :class="creditClass">{{ actorInfo.credit_score_actor || 100 }}</text>
            </view>
            <view class="detail-row">
              <text class="detail-label">实名认证</text>
              <text class="detail-value" :class="actorInfo.is_realname_auth ? 'verified' : 'unverified'">
                {{ actorInfo.is_realname_auth ? '已认证' : '未认证' }}
              </text>
            </view>
            <view class="detail-row" v-if="actorInfo.skills && actorInfo.skills.length > 0">
              <text class="detail-label">特长技能</text>
              <view class="skills-wrap">
                <text class="skill-tag" v-for="skill in actorInfo.skills" :key="skill">{{ getSkillLabel(skill) }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 模卡展示 -->
        <view class="info-card" v-if="compCards.length > 0">
          <view class="card-title">
            <uni-icons type="image" size="20" color="#FFD700"></uni-icons>
            <text>模卡展示</text>
            <text class="card-count">{{ compCards.length }}张</text>
          </view>
          <view class="card-content">
            <view class="comp-cards-grid">
              <view class="comp-card-item" v-for="(card, index) in compCards" :key="index" @tap="previewImage(index)">
                <image
                  v-if="card.type === 'image' || !card.type"
                  :src="card.url"
                  mode="aspectFill"
                  class="comp-card-image"
                ></image>
                <view v-else class="video-card">
                  <video
                    :src="card.url"
                    :controls="false"
                    :show-play-btn="false"
                    :autoplay="false"
                    :muted="true"
                    class="comp-card-video"
                    object-fit="cover"
                  ></video>
                  <view class="video-mask">
                    <uni-icons type="videocam" size="24" color="#fff"></uni-icons>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 视频模卡 -->
        <view class="info-card" v-if="actorInfo.video_card_url">
          <view class="card-title">
            <uni-icons type="videocam" size="20" color="#FFD700"></uni-icons>
            <text>视频模卡</text>
          </view>
          <view class="card-content">
            <video
              :src="actorInfo.video_card_url"
              class="video-player"
              controls
              object-fit="contain"
            ></video>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="empty-container">
      <uni-icons type="info" size="64" color="#999"></uni-icons>
      <text class="empty-text">演员信息不存在</text>
      <button class="btn-primary" @tap="goBack">返回</button>
    </view>
  </view>
</template>

<script>
import TrackingMap from '@/components/tracking-map/tracking-map.vue'

export default {
  components: {
    TrackingMap
  },
  data() {
    return {
      actorId: '',
      orderId: '',
      actorInfo: null,
      loading: true,
      currentTab: 0,
      loadingText: {
        contentdown: '加载中...',
        contentrefresh: '加载中...',
        contentnomore: '加载中...'
      },
      skillMap: {
        'driving': '开车',
        'dancing': '跳舞',
        'singing': '唱歌',
        'martial_arts': '武术',
        'swimming': '游泳',
        'riding': '骑马',
        'instrument': '乐器',
        'language': '外语'
      }
    }
  },

  computed: {
    displayAvatar() {
      if (!this.actorInfo) return '/static/default-avatar.png'
      const avatarFile = this.actorInfo.avatar_file
      const avatarFileUrl = avatarFile && avatarFile.url ? avatarFile.url : null
      return avatarFileUrl || this.actorInfo.avatar || '/static/default-avatar.png'
    },
    genderText() {
      if (!this.actorInfo) return '未设置'
      const genderMap = { 0: '未设置', 1: '男', 2: '女' }
      return genderMap[this.actorInfo.gender] || '未设置'
    },
    creditClass() {
      const score = this.actorInfo ? this.actorInfo.credit_score_actor || 100 : 100
      if (score >= 130) return 'credit-gold'
      if (score >= 110) return 'credit-silver'
      return 'credit-normal'
    },
    compCards() {
      if (!this.actorInfo || !this.actorInfo.comp_cards) return []
      return this.actorInfo.comp_cards.filter(card => card && card.url)
    }
  },

  onLoad(options) {
    if (options.id) {
      this.actorId = options.id
      if (options.orderId) {
        this.orderId = options.orderId
        // 有 orderId 时默认选中"履约追踪"Tab
        this.currentTab = 1
      }
      this.loadActorInfo()
    } else {
      this.loading = false
    }
  },

  onPullDownRefresh() {
    this.loadActorInfo()
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 1000)
  },

  methods: {
    switchTab(index) {
      this.currentTab = index
    },

    onSwiperChange(e) {
      this.currentTab = e.detail.current
    },

    onViewProfile() {
      this.currentTab = 0
    },

    onTrackingCompleted(data) {
      // 处理追踪完成事件
      console.log('追踪完成:', data)
    },

    async loadActorInfo() {
      try {
        this.loading = true
        const db = uniCloud.database()
        const res = await db.collection('uni-id-users')
          .doc(this.actorId)
          .field({
            nickname: true,
            avatar: true,
            avatar_file: true,
            gender: true,
            height: true,
            body_type: true,
            skills: true,
            description: true,
            comp_cards: true,
            video_card_url: true,
            credit_score_actor: true,
            is_realname_auth: true,
            mobile: true,
            wechat_id: true
          })
          .get()

        if (res.result.data && res.result.data.length > 0) {
          this.actorInfo = res.result.data[0]
        }
      } catch (error) {
        console.error('加载演员信息失败:', error)
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    },

    getSkillLabel(skill) {
      return this.skillMap[skill] || skill
    },

    copyText(text, label) {
      uni.setClipboardData({
        data: text,
        success: () => {
          uni.showToast({
            title: `${label}已复制`,
            icon: 'success'
          })
        }
      })
    },

    previewImage(index) {
      const urls = this.compCards
        .filter(card => card.type === 'image' || !card.type)
        .map(card => card.url)

      if (urls.length > 0) {
        uni.previewImage({
          urls: urls,
          current: index < urls.length ? index : 0
        })
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

.actor-detail-page {
  min-height: 100vh;
  background-color: $bg-primary;
  display: flex;
  flex-direction: column;
}

.loading-container {
  @include flex-center;
  min-height: 60vh;
}

.actor-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: $spacing-base;
  padding-bottom: env(safe-area-inset-bottom);
}

// 头部卡片
.header-card {
  display: flex;
  align-items: flex-start;
  gap: $spacing-lg;
  background-color: $bg-secondary;
  border-radius: $border-radius-lg;
  padding: $spacing-lg;
  margin-bottom: $spacing-base;

  .avatar-section {
    position: relative;
    flex-shrink: 0;

    .avatar {
      width: 160rpx;
      height: 160rpx;
      border-radius: 50%;
      background-color: $gray-4;
      border: 4rpx solid $primary-color;
    }

    .verified-badge {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 40rpx;
      height: 40rpx;
      background-color: $white;
      border-radius: 50%;
      @include flex-center;
    }
  }

  .basic-info {
    flex: 1;
    @include flex-column;
    gap: 12rpx;

    .name-row {
      display: flex;
      align-items: center;
      gap: $spacing-sm;

      .nickname {
        font-size: $font-size-xl;
        font-weight: $font-weight-bold;
        color: $text-primary;
      }

      .credit-badge {
        padding: 4rpx 12rpx;
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

    .tags-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8rpx;

      .tag {
        padding: 4rpx 12rpx;
        background-color: $bg-tertiary;
        border-radius: $border-radius-sm;
        font-size: $font-size-xs;
        color: $text-secondary;
      }
    }

    .auth-status {
      display: flex;
      align-items: center;
      gap: 6rpx;

      text {
        font-size: $font-size-sm;

        &.verified {
          color: $success-color;
        }

        &.unverified {
          color: $text-hint;
        }
      }
    }
  }
}

// Tab 切换
.tab-container {
  margin-bottom: $spacing-base;
}

.tab-bar {
  display: flex;
  background-color: $bg-secondary;
  border-radius: $border-radius-base;
  padding: 8rpx;
}

.tab-item {
  flex: 1;
  height: 72rpx;
  @include flex-center;
  border-radius: $border-radius-sm;
  transition: all 0.2s;

  text {
    font-size: $font-size-base;
    color: $text-secondary;
    font-weight: $font-weight-medium;
  }

  &.active {
    background: linear-gradient(135deg, $primary-color 0%, #FFED4E 100%);

    text {
      color: $black;
      font-weight: $font-weight-bold;
    }
  }
}

// Tab 内容
.tab-content-swiper {
  flex: 1;
  height: calc(100vh - 400rpx);
}

.tab-scroll-view {
  height: 100%;
}

.profile-content,
.profile-content-full {
  padding-bottom: $spacing-lg;
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

    .card-count {
      margin-left: auto;
      padding: 4rpx 16rpx;
      background-color: rgba($primary-color, 0.2);
      border-radius: 20rpx;
      font-size: $font-size-sm;
      font-weight: $font-weight-bold;
      color: $primary-color;
    }
  }

  .card-content {
    .description {
      font-size: $font-size-base;
      color: $text-secondary;
      line-height: 1.6;
    }
  }
}

// 联系方式
.contact-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);

  &:last-child {
    border-bottom: none;
  }

  .contact-label {
    font-size: $font-size-sm;
    color: $text-secondary;
  }

  .contact-value-wrap {
    display: flex;
    align-items: center;
    gap: $spacing-sm;

    .contact-value {
      font-size: $font-size-base;
      color: $text-primary;
      font-family: $font-family-monospace;
    }

    .copy-btn {
      padding: 8rpx;
      background-color: rgba($primary-color, 0.15);
      border-radius: $border-radius-sm;

      &:active {
        opacity: 0.7;
      }
    }
  }
}

.no-contact {
  text-align: center;
  padding: $spacing-lg;

  text {
    font-size: $font-size-sm;
    color: $text-hint;
  }
}

// 详细信息
.detail-row {
  display: flex;
  align-items: flex-start;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);

  &:last-child {
    border-bottom: none;
  }

  .detail-label {
    width: 140rpx;
    font-size: $font-size-sm;
    color: $text-secondary;
    flex-shrink: 0;
  }

  .detail-value {
    flex: 1;
    font-size: $font-size-base;
    color: $text-primary;

    &.verified {
      color: $success-color;
    }

    &.unverified {
      color: $text-hint;
    }

    &.credit {
      font-weight: $font-weight-bold;

      &.credit-gold {
        color: #FFD700;
      }

      &.credit-silver {
        color: #C0C0C0;
      }

      &.credit-normal {
        color: $text-primary;
      }
    }
  }

  .skills-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 8rpx;

    .skill-tag {
      padding: 4rpx 12rpx;
      background-color: rgba($primary-color, 0.15);
      border: 1rpx solid $primary-color;
      border-radius: $border-radius-sm;
      font-size: $font-size-xs;
      color: $primary-color;
    }
  }
}

// 模卡展示
.comp-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-sm;

  .comp-card-item {
    aspect-ratio: 1;
    border-radius: $border-radius-base;
    overflow: hidden;
    background-color: $bg-tertiary;

    &:active {
      opacity: 0.8;
    }

    .comp-card-image {
      width: 100%;
      height: 100%;
    }

    .video-card {
      position: relative;
      width: 100%;
      height: 100%;

      .comp-card-video {
        width: 100%;
        height: 100%;
      }

      .video-mask {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.3);
        @include flex-center;
      }
    }
  }
}

// 视频播放器
.video-player {
  width: 100%;
  height: 400rpx;
  border-radius: $border-radius-base;
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
</style>
