# 艺拍即合 - 后端接口文档

> 最后更新: 2025-12-30

## 接口总览

| 云对象 | 已完成 | 待开发 | 完成率 |
|--------|--------|--------|--------|
| order-co | 17 | 0 | 100% |
| user-co | 8 | 0 | 100% |
| geo-service | 3 | 0 | 100% |
| community-co | 0 | 4 | 0% |
| **总计** | **28** | **4** | **87.5%** |

---

## 1. order-co 订单云对象

**文件路径**: `uniCloud-aliyun/cloudfunctions/order-co/index.obj.js`

### 订单管理

#### add(data) - 发布订单

```javascript
const orderCo = uniCloud.importObject('order-co')
await orderCo.add({
  people_needed: 2,
  role_description: '群众演员',
  meeting_location_name: '重庆大学',
  meeting_location: {
    type: 'Point',
    coordinates: [106.4650, 29.5630]
  },
  meeting_time: Date.now() + 3600000,
  gender_requirement: 0,  // 0-不限, 1-男, 2-女
  height_min: 0,
  height_max: 0,
  body_type: [],
  special_skills: [],
  welfare_tags: ['meal', 'taxi'],
  price_type: 'daily',  // daily-按天, hourly-按时
  price_amount: 30000,  // 单位：分
  remark: ''
})
```

**返回**:
```javascript
{ code: 0, message: '发布成功', data: { order_id: 'xxx', order_type: 'immediate' } }
```

#### getMyOrders(params) - 获取订单列表（剧组端）

```javascript
await orderCo.getMyOrders({
  status: 0,     // 可选，订单状态
  page: 1,
  pageSize: 20
})
```

#### getActorOrders(params) - 获取订单列表（演员端）

```javascript
await orderCo.getActorOrders({
  status: 1,     // 可选，订单状态
  page: 1,
  pageSize: 20
})
```

#### getDetail(orderId) - 获取订单详情

```javascript
await orderCo.getDetail('orderId')
```

#### cancel(orderId, reason) - 取消订单

```javascript
await orderCo.cancel('orderId', '取消原因')
```

### 抢单功能

#### grab(orderId) - 抢单

```javascript
await orderCo.grab('orderId')
```

> 包含事务处理，防止并发抢单

#### getAvailableJobs(params) - 获取可接订单

```javascript
await orderCo.getAvailableJobs({
  longitude: 106.4650,
  latitude: 29.5630,
  maxDistance: 5000,  // 米
  minPrice: 100,      // 可选
  welfare: ['meal'],  // 可选
  page: 1,
  pageSize: 20
})
```

### 演员管理

#### getNearbyActors(params) - 获取附近演员

```javascript
await orderCo.getNearbyActors({
  longitude: 106.4650,
  latitude: 29.5630,
  maxDistance: 5000,
  gender: 2,           // 可选
  heightMin: 160,      // 可选
  skills: ['dancing']  // 可选
})
```

#### updateActorLocation(location) - 更新演员位置

```javascript
await orderCo.updateActorLocation({
  longitude: 106.4650,
  latitude: 29.5630
})
```

### 履约追踪

#### submitTrack(orderId, location) - 提交轨迹

```javascript
await orderCo.submitTrack('orderId', {
  longitude: 106.4650,
  latitude: 29.5630,
  accuracy: 10
})
```

#### getTracks(orderId) - 获取订单轨迹

```javascript
await orderCo.getTracks('orderId')
```

#### checkIn(orderId, location) - 打卡签到

```javascript
await orderCo.checkIn('orderId', {
  longitude: 106.4650,
  latitude: 29.5630
})
```

> 电子围栏范围：100米

### 订单状态

#### updateOrderStatus(orderId, status) - 更新订单状态

```javascript
await orderCo.updateOrderStatus('orderId', 2)
```

**订单状态值**:
- 0: 待接单
- 1: 进行中
- 2: 待支付
- 3: 已完成
- 4: 已取消

#### completeOrder(orderId) - 完成订单

```javascript
await orderCo.completeOrder('orderId')
```

#### rateOrder(orderId, rating) - 评价订单

```javascript
await orderCo.rateOrder('orderId', {
  score: 5,
  comment: '非常专业'
})
```

---

## 2. user-co 用户云对象

**文件路径**: `uniCloud-aliyun/cloudfunctions/user-co/index.obj.js`

### 用户资料

#### getProfile() - 获取当前用户资料

```javascript
const userCo = uniCloud.importObject('user-co')
await userCo.getProfile()
```

#### getPublicProfile(userId) - 获取用户公开资料

```javascript
await userCo.getPublicProfile('userId')
```

#### updateProfile(data) - 更新个人资料

```javascript
await userCo.updateProfile({
  nickname: '新昵称',
  height: 175,
  body_type: 'athletic',
  skills: ['dancing', 'driving']
})
```

#### setRole(role) - 设置用户角色

```javascript
await userCo.setRole(2)  // 1-剧组, 2-演员
```

### 统计与信用

#### getStats() - 获取统计数据

```javascript
await userCo.getStats()
```

#### getCreditHistory(params) - 获取信用分历史

```javascript
await userCo.getCreditHistory({ page: 1, pageSize: 20 })
```

### 认证功能

#### setVideoCard(videoUrl) - 设置视频模卡URL

```javascript
await userCo.setVideoCard('https://xxx.com/video.mp4')
```

#### submitVerification(type, data) - 提交认证申请

```javascript
await userCo.submitVerification('student', {
  real_name: '张三',
  id_number: '500xxx',
  school_name: '重庆大学'
})
```

---

## 3. geo-service 地理服务云函数

**文件路径**: `uniCloud-aliyun/cloudfunctions/geo-service/index.js`

### regeo - 逆地理编码

```javascript
await uniCloud.callFunction({
  name: 'geo-service',
  data: {
    action: 'regeo',
    longitude: 106.4650,
    latitude: 29.5630
  }
})
```

### geo - 地理编码

```javascript
await uniCloud.callFunction({
  name: 'geo-service',
  data: {
    action: 'geo',
    address: '重庆市沙坪坝区',
    city: '重庆'
  }
})
```

### search - POI搜索

```javascript
await uniCloud.callFunction({
  name: 'geo-service',
  data: {
    action: 'search',
    keywords: '咖啡厅',
    city: '重庆'
  }
})
```

---

## 4. community-co 社区云对象（待开发）

**文件路径**: `uniCloud-aliyun/cloudfunctions/community-co/index.obj.js`

| 方法 | 功能 | 状态 |
|------|------|------|
| `getPosts(type, page)` | 获取帖子列表 | 待开发 |
| `createPost(data)` | 发布帖子 | 待开发 |
| `getBlacklist(page)` | 获取红黑榜 | 待开发 |
| `reportUser(userId, reason)` | 举报用户 | 待开发 |

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 401 | 未登录 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

---

## 第三方服务

| 服务 | 状态 | 说明 |
|------|------|------|
| 高德地图API | 已集成 | 地理编码服务 |
| 微信支付 | 待集成 | P1优先级 |
| 学信网API | 待集成 | P2优先级 |
| uni-push | 待集成 | P2优先级 |

---

## 部署说明

1. 上传云函数:
   ```
   右键 order-co -> 上传部署
   右键 user-co -> 上传部署
   右键 geo-service -> 上传部署
   ```

2. 上传数据库 Schema:
   ```
   右键 database -> 上传 DB Schema
   ```

3. Token 验证使用 `uni-id-common` 模块
