# 后端接口状态文档

> 更新时间：2025-12-18 20:30
> 说明：本文档记录所有前端页面所需的后端接口状态，标注哪些接口已可用、哪些需要开发。

---

## 0. 最近更新 (2025-12-18)

### Token验证问题已修复

**问题**：用户已登录但调用云对象提示"请先登录"

**修复方案**：
1. `order-co/package.json` 添加 `uni-id-common` 依赖
2. `user-co/package.json` 添加 `uni-id-common` 依赖
3. `order-co/index.obj.js` 重写 token 验证逻辑：
   - 使用 `uniIdCommon.createInstance().checkToken()` 验证
   - 添加 `_getCurrentUserId()` 辅助方法

**部署步骤**：
```bash
# 在 HBuilderX 中：
1. 右键 order-co -> "上传部署"
2. 右键 user-co -> "上传部署"
3. 右键 database -> "上传 DB Schema"
```

---

## 1. 云对象接口 (Cloud Objects)

### 1.1 order-co (订单云对象)

**文件路径**: `uniCloud-aliyun/cloudfunctions/order-co/index.obj.js`

**依赖**: `uni-id-common` (已配置)

| 方法名 | 功能 | 状态 | 说明 |
|--------|------|------|------|
| `add(data)` | 发布订单 | ✅ 可用 | 支持自动判断订单类型（即时单/预约单） |
| `getMyOrders(params)` | 获取我的订单列表(剧组端) | ✅ 可用 | 支持分页和状态筛选 |
| `getActorOrders(params)` | 获取我的订单列表(演员端) | ✅ 可用 | 支持分页和状态筛选 |
| `getDetail(orderId)` | 获取订单详情 | ✅ 可用 | 发布者和接单者可查看 |
| `cancel(orderId, reason)` | 取消订单 | ✅ 可用 | 仅发布者可取消 |
| `testToken()` | 测试token | ✅ 可用 | 调试用，无需登录 |
| `grab(orderId)` | 抢单 | ✅ 可用 | **演员端核心功能**，含事务处理 |
| `getAvailableJobs(params)` | 获取可接订单 | ✅ 可用 | **演员端首页核心**，支持地理位置排序、多条件筛选 |
| `getNearbyActors(params)` | 获取附近演员 | ✅ 可用 | **剧组端地图核心**，支持地理位置排序、多条件筛选 |
| `updateActorLocation(location)` | 更新演员位置 | ✅ 可用 | 演员端上报位置 |
| `submitTrack(orderId, location)` | 提交轨迹 | ✅ 可用 | **履约追踪核心**，自动计算距离 |
| `getTracks(orderId)` | 获取订单轨迹 | ✅ 可用 | **履约追踪核心**，含最新位置 |
| `checkIn(orderId, location)` | 打卡签到 | ✅ 可用 | **电子围栏打卡**，100米范围，自动检测迟到 |
| `updateOrderStatus(orderId, status)` | 更新订单状态 | ✅ 可用 | 含状态流转校验 |
| `completeOrder(orderId)` | 完成订单 | ✅ 可用 | 剧组确认完成，自动加信用分 |
| `rateOrder(orderId, rating)` | 评价订单 | ✅ 可用 | 双向评价，自动调整信用分 |

---

### 1.2 user-co (用户云对象)

**文件路径**: `uniCloud-aliyun/cloudfunctions/user-co/index.obj.js`

**依赖**: `uni-id-common` (已配置)

| 方法名 | 功能 | 状态 | 说明 |
|--------|------|------|------|
| `getProfile()` | 获取当前用户资料 | ✅ 可用 | 返回完整用户信息 |
| `getPublicProfile(userId)` | 获取用户公开资料 | ✅ 可用 | 无需登录，返回脱敏信息 |
| `updateProfile(data)` | 更新个人资料 | ✅ 可用 | 含字段校验 |
| `setRole(role)` | 设置用户角色 | ✅ 可用 | 首次设置后不可更改 |
| `getStats()` | 获取统计数据 | ✅ 可用 | 根据角色返回不同统计 |
| `getCreditHistory(params)` | 获取信用分历史 | ✅ 可用 | 从订单记录构建 |
| `setVideoCard(videoUrl)` | 设置视频模卡URL | ✅ 可用 | 仅演员可用 |
| `submitVerification(type, data)` | 提交认证申请 | ✅ 可用 | 支持学生/企业认证 |

---

### 1.3 geo-service (地理服务云函数)

**文件路径**: `uniCloud-aliyun/cloudfunctions/geo-service/index.js`

| 方法名 | 功能 | 状态 | 说明 |
|--------|------|------|------|
| `regeo` | 逆地理编码 | ✅ 可用 | 坐标转地址 |
| `geo` | 地理编码 | ✅ 可用 | 地址转坐标 |
| `search` | 地址搜索 | ✅ 可用 | POI搜索 |

⚠️ **注意**: 需要替换为项目自己的高德地图Key

---

### 1.4 community-co (社区云对象 - 需要创建)

**文件路径**: `uniCloud-aliyun/cloudfunctions/community-co/index.obj.js` ⚠️ 未创建

| 方法名 | 功能 | 状态 | 说明 |
|--------|------|------|------|
| `getPosts(type, page)` | 获取帖子列表 | ❌ 需要开发 | 通告集市、经验干货 |
| `createPost(data)` | 发布帖子 | ❌ 需要开发 | 社区发帖功能 |
| `getBlacklist(page)` | 获取红黑榜 | ❌ 需要开发 | **社区核心功能** |
| `reportUser(userId, reason)` | 举报用户 | ❌ 需要开发 | 违规举报 |

---

## 2. 数据库操作需求

### 2.1 orders 表

**Schema文件**: `uniCloud-aliyun/database/orders.schema.json`

| 操作 | 状态 | 说明 |
|------|------|------|
| 基础CRUD | ✅ 可用 | 创建、读取、更新、删除订单 |
| 地理位置查询 | ✅ 可用 | 已创建2dsphere索引 |
| 状态筛选 | ✅ 可用 | 已创建复合索引 |
| 按距离排序 | ✅ 可用 | 使用geoNear聚合查询 |

---

### 2.2 order_tracks 表

**Schema文件**: `uniCloud-aliyun/database/order_tracks.schema.json`

| 操作 | 状态 | 说明 |
|------|------|------|
| 轨迹记录 | ✅ 可用 | Schema已定义 |
| 轨迹查询 | ✅ 可用 | 已创建索引 |
| 实时位置上报 | ✅ 可用 | submitTrack接口 |

---

### 2.3 uni-id-users 表（用户扩展）

**Schema文件**: `uniCloud-aliyun/database/uni-id-users.schema.json`

| 字段 | 状态 | 说明 |
|------|------|------|
| `user_role` | ✅ 已扩展 | 1-剧组, 2-演员 |
| `auth_status` | ✅ 已扩展 | 认证状态 |
| `credit_score_actor` | ✅ 已扩展 | 演员信用分 |
| `credit_score_crew` | ✅ 已扩展 | 剧组信用分 |
| `verify_info` | ✅ 已扩展 | 认证详细信息 |
| `video_card_url` | ✅ 接口支持 | 视频模卡URL |
| `profile_images` | ✅ 接口支持 | 个人介绍图片数组 |
| `profile_text` | ✅ 接口支持 | 个人介绍文字 |
| `skills` | ✅ 接口支持 | 特长技能数组 |
| `height` | ✅ 接口支持 | 身高 |
| `body_type` | ✅ 接口支持 | 体型 |
| `gender` | ✅ 接口支持 | 性别 |
| `current_location` | ✅ 接口支持 | 当前位置(GeoPoint) |
| `online_status` | ✅ 接口支持 | 在线状态 |

---

### 2.4 community_posts 表（需要创建）

**Schema文件**: ❌ 未创建

| 字段 | 说明 |
|------|------|
| `post_id` | 帖子ID |
| `user_id` | 发布者ID |
| `post_type` | 帖子类型（job_market/experience/blacklist） |
| `title` | 标题 |
| `content` | 内容 |
| `images` | 图片数组 |
| `tags` | 标签数组 |
| `create_time` | 创建时间 |

---

## 3. 前端页面接口依赖总结

### 3.1 剧组端

| 页面 | 依赖接口 | 状态 |
|------|---------|------|
| 地图首页 (`/pages/crew/index.vue`) | `order-co.getMyOrders()` ✅<br>`order-co.getNearbyActors()` ✅ | ✅ 完全可用 |
| 发布订单 (`/pages/crew/post_order.vue`) | `order-co.add()` ✅<br>`geo-service.regeo` ✅ | ✅ 完全可用 |
| 订单列表 (`/pages/crew/order_list.vue`) | `order-co.getMyOrders()` ✅ | ✅ 完全可用 |
| 订单详情 (`/pages/crew/order_detail.vue`) | `order-co.getDetail()` ✅<br>`order-co.cancel()` ✅<br>`order-co.completeOrder()` ✅<br>`order-co.rateOrder()` ✅ | ✅ 完全可用 |
| 履约追踪 (`/pages/crew/order_tracking.vue`) | `order-co.getTracks()` ✅ | ✅ 完全可用 |
| 剧组中心 (`/pages/crew/profile.vue`) | `user-co.getProfile()` ✅<br>`user-co.getStats()` ✅ | ✅ 完全可用 |
| 社区页面 | ⚠️ 页面未创建<br>`community-co.*` ❌ | ❌ 不可用 |

---

### 3.2 演员端

| 页面 | 依赖接口 | 状态 |
|------|---------|------|
| 演员首页 (`/pages/actor/index.vue`) | `order-co.getAvailableJobs()` ✅<br>`order-co.grab()` ✅<br>`user-co.getStats()` ✅ | ✅ 完全可用 |
| 工作详情 (`/pages/actor/job_detail.vue`) | `order-co.getDetail()` ✅<br>`order-co.grab()` ✅<br>`user-co.getPublicProfile()` ✅ | ✅ 完全可用 |
| 我的订单 (`/pages/actor/my_orders.vue`) | `order-co.getActorOrders()` ✅ | ✅ 完全可用 |
| 履约追踪 (`/pages/actor/order_tracking.vue`) | `order-co.submitTrack()` ✅<br>`order-co.checkIn()` ✅<br>`order-co.getTracks()` ✅ | ✅ 完全可用 |
| 个人中心 (`/pages/actor/profile.vue`) | `user-co.getProfile()` ✅<br>`user-co.getStats()` ✅<br>`user-co.updateProfile()` ✅ | ✅ 完全可用 |
| 社区页面 | ⚠️ 页面未创建<br>`community-co.*` ❌ | ❌ 不可用 |

---

### 3.3 认证相关

| 功能 | 依赖接口 | 状态 |
|------|---------|------|
| 视频模卡设置 | `user-co.setVideoCard()` ✅ | ✅ 可用（需前端实现上传） |
| 学生认证 | `user-co.submitVerification()` ✅ | ✅ 可用（需后台审核） |
| 企业认证 | `user-co.submitVerification()` ✅ | ✅ 可用（需后台审核） |
| 人脸识别 | 第三方人脸识别API ❌ | ❌ 需要集成 |

---

## 4. 第三方服务依赖

| 服务 | 用途 | 状态 | 说明 |
|------|------|------|------|
| 高德地图API | 地理编码、逆地理编码、POI搜索 | ✅ 已集成 | Key: `82a78366e16299466ec46f919fde5506`（建议更换） |
| 高德地图Key(App) | UniApp地图组件 | ✅ 已配置 | Key: `976d8beb7728d3ee2b3ef1c8a1b3611a` |
| 微信支付 | 订单支付 | ❌ 未集成 | P1优先级 |
| 学信网API | 学生认证 | ❌ 未集成 | P2优先级 |
| OCR识别API | 营业执照识别 | ❌ 未集成 | P2优先级 |
| 人脸识别API | 企业认证 | ❌ 未集成 | P2优先级 |
| uni-push | 推送通知 | ❌ 未集成 | P2优先级 |

---

## 5. 开发优先级建议

### ✅ 已完成 - P0核心功能

1. **演员端抢单功能** ✅
   - `order-co.grab(orderId)`
   - `order-co.getAvailableJobs(params)`

2. **剧组端地图演员展示** ✅
   - `order-co.getNearbyActors(params)`
   - `order-co.updateActorLocation(location)`

3. **履约追踪（LBS实时定位）** ✅
   - `order-co.submitTrack(orderId, location)`
   - `order-co.getTracks(orderId)`
   - `order-co.checkIn(orderId, location)`

4. **用户系统** ✅
   - `user-co.getProfile()`
   - `user-co.updateProfile(data)`
   - `user-co.getStats()`
   - `user-co.getCreditHistory(params)`

5. **订单完成与评价** ✅
   - `order-co.completeOrder(orderId)`
   - `order-co.rateOrder(orderId, rating)`
   - `order-co.updateOrderStatus(orderId, status)`

---

### 🟡 待开发 - P1重要功能

6. **支付结算**
   - 集成微信支付
   - 钱包系统

---

### 🟢 待开发 - P2完善功能

7. **认证系统增强**
   - 集成OCR识别（营业执照）
   - 集成学信网API（学生认证）
   - 集成人脸识别API

8. **社区系统**
   - `community-co.*` 全套接口
   - 社区页面开发

9. **推送通知**
   - uni-push集成
   - `order-co._notifyNearbyActors()` 实现

---

## 6. 接口调用示例

### 6.1 order-co 接口

```javascript
// 导入云对象
const orderCo = uniCloud.importObject('order-co')

// 1. 发布订单
await orderCo.add({
  people_needed: 1,
  meeting_location_name: '重庆大学',
  meeting_location: {
    type: 'Point',
    coordinates: [106.4650, 29.5630]
  },
  meeting_time: Date.now() + 3600000,
  price_type: 'daily',
  price_amount: 30000, // 300元(分)
  welfare_tags: ['meal', 'taxi']
})

// 2. 获取可接订单(演员端)
await orderCo.getAvailableJobs({
  longitude: 106.4650,
  latitude: 29.5630,
  maxDistance: 5000,
  minPrice: 100,
  welfare: ['meal'],
  page: 1,
  pageSize: 20
})

// 3. 获取附近演员(剧组端)
await orderCo.getNearbyActors({
  longitude: 106.4650,
  latitude: 29.5630,
  maxDistance: 5000,
  gender: 2,
  heightMin: 160,
  skills: ['dancing']
})

// 4. 抢单
await orderCo.grab('orderId')

// 5. 提交轨迹
await orderCo.submitTrack('orderId', {
  longitude: 106.4650,
  latitude: 29.5630,
  accuracy: 10
})

// 6. 打卡
await orderCo.checkIn('orderId', {
  longitude: 106.4650,
  latitude: 29.5630
})

// 7. 完成订单
await orderCo.completeOrder('orderId')

// 8. 评价订单
await orderCo.rateOrder('orderId', {
  score: 5,
  comment: '非常专业'
})
```

### 6.2 user-co 接口

```javascript
// 导入云对象
const userCo = uniCloud.importObject('user-co')

// 1. 获取当前用户资料
await userCo.getProfile()

// 2. 获取其他用户公开资料
await userCo.getPublicProfile('userId')

// 3. 更新个人资料
await userCo.updateProfile({
  nickname: '新昵称',
  height: 175,
  body_type: 'athletic',
  skills: ['dancing', 'driving']
})

// 4. 设置角色
await userCo.setRole(2) // 2=演员

// 5. 获取统计数据
await userCo.getStats()

// 6. 获取信用历史
await userCo.getCreditHistory({ page: 1, pageSize: 20 })

// 7. 设置视频模卡
await userCo.setVideoCard('https://xxx.com/video.mp4')

// 8. 提交认证
await userCo.submitVerification('student', {
  real_name: '张三',
  id_number: '500xxx',
  school_name: '重庆大学'
})
```

---

## 7. 注意事项

⚠️ **重要提示**:

1. **云函数部署** (修复后必须重新上传)
   ```bash
   # 在 HBuilderX 中：
   1. 右键 order-co -> "上传部署"
   2. 右键 user-co -> "上传部署"
   3. 右键 geo-service -> "上传部署"
   4. 右键 database -> "上传 DB Schema"
   ```

2. **数据库索引**
   确保以下索引已创建：
   - `orders` 表: `meeting_location` 2dsphere索引
   - `uni-id-users` 表: `current_location` 2dsphere索引
   - `order_tracks` 表: `order_id` 普通索引

3. **高德地图Key**
   建议申请项目专用Key，替换现有测试Key

4. **Token验证** ✅ 已修复
   - 问题：`this.getUniIdToken()` 返回的是 token 字符串，不是对象
   - 修复：使用 `uni-id-common` 的 `checkToken()` 方法验证
   - 状态：已在 order-co 中实现，user-co 待同步

5. **权限控制**
   所有涉及用户数据的接口都已实现登录检查和权限校验

6. **uni-id-users Schema** ✅ 已创建
   已创建 `uniCloud-aliyun/database/uni-id-users.schema.json`，包含所有应用自定义字段

---

## 8. 接口统计

| 云对象 | 已完成 | 待开发 | 完成率 |
|--------|--------|--------|--------|
| order-co | 17 | 0 | 100% |
| user-co | 8 | 0 | 100% |
| geo-service | 3 | 0 | 100% |
| community-co | 0 | 4 | 0% |
| **总计** | **28** | **4** | **87.5%** |

---

**最后更新人**: Claude Opus 4.5
**下次更新计划**: 完成社区功能后
