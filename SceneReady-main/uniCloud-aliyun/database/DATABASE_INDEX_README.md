# UniCloud 数据库索引说明文档

## 概述
本文档详细说明了艺拍即合项目中各数据表的索引设计及其作用。合理的索引设计对于提高查询性能、支持LBS功能和优化匹配算法至关重要。

---

## 一、uni-id-users (用户表扩展)

### 新增字段说明

| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| user_role | int | 用户角色: 1-剧组/统筹, 2-演员/学生 | 2 |
| auth_status | int | 认证状态: 0-未认证, 1-认证中, 2-已认证, 3-认证失败 | 0 |
| credit_score_actor | int | 演员信用分(0-150) | 100 |
| credit_score_crew | int | 剧组信用分(0-150) | 100 |
| verify_info | object | 认证详细信息(学生认证/企业认证) | - |

### 索引设计

#### 1. user_role_auth_status (复合索引)
```json
{
  "user_role": 1,
  "auth_status": 1
}
```
**作用:**
- 快速筛选特定角色和认证状态的用户
- 支持查询"已认证的演员"、"待审核的剧组"等场景
- 用于管理后台的用户管理功能

**查询示例:**
```javascript
// 查询所有已认证的演员
db.collection('uni-id-users').where({
  user_role: 2,
  auth_status: 2
}).get()
```

#### 2. credit_score_actor (降序索引)
```json
{
  "credit_score_actor": -1
}
```
**作用:**
- 支持演员信用分排序,用于优先推送高分演员
- 实现"Top 20%演员提前3-5分钟收到推送"功能
- 优化匹配算法中的演员筛选

**查询示例:**
```javascript
// 获取信用分最高的演员(Top 20%)
db.collection('uni-id-users').where({
  user_role: 2,
  auth_status: 2
})
.orderBy('credit_score_actor', 'desc')
.limit(100)
.get()
```

#### 3. credit_score_crew (降序索引)
```json
{
  "credit_score_crew": -1
}
```
**作用:**
- 支持剧组信用分排序,用于标识"金牌剧组"
- 实现高分剧组优先匹配王牌演员的功能
- 在演员端展示剧组信用评级

**查询示例:**
```javascript
// 获取高信用剧组列表
db.collection('uni-id-users').where({
  user_role: 1,
  credit_score_crew: _.gte(120)
})
.orderBy('credit_score_crew', 'desc')
.get()
```

---

## 二、orders (订单表)

### 核心字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| publisher_id | string | 发布者ID(剧组) |
| receiver_id | string | 接单者ID(演员) |
| order_status | int | 订单状态: 0-待接单, 1-进行中, 2-待支付, 3-已完成, 4-已取消 |
| meeting_location | object | 集合地点GeoPoint坐标 |
| meeting_time | timestamp | 集合时间 |
| order_type | string | immediate-即时单(<2h), reservation-预约单(>2h) |
| welfare_tags | array | 福利标签: meal/taxi/accommodation/tea |
| price_type | string | 计费方式: daily-按天, hourly-按时 |
| price_amount | int | 金额(分) |

### 索引设计

#### 1. publisher_id_status (复合索引)
```json
{
  "publisher_id": 1,
  "order_status": 1
}
```
**作用:**
- 剧组端快速查询自己发布的订单列表
- 支持按状态筛选(进行中/已完成/已取消等)
- 优化"我的订单"页面查询性能

**查询示例:**
```javascript
// 查询剧组的进行中订单
db.collection('orders').where({
  publisher_id: 'xxx',
  order_status: 1
}).get()
```

#### 2. receiver_id_status (复合索引)
```json
{
  "receiver_id": 1,
  "order_status": 1
}
```
**作用:**
- 演员端快速查询自己接的订单列表
- 支持按状态查看历史订单、进行中订单
- 统计演员的履约率数据

**查询示例:**
```javascript
// 查询演员已完成的订单数
db.collection('orders').where({
  receiver_id: 'xxx',
  order_status: 3
}).count()
```

#### 3. order_status_create_time (复合索引)
```json
{
  "order_status": 1,
  "create_time": -1
}
```
**作用:**
- **核心索引**:支持"任务大厅"按时间倒序展示待接单订单
- 新订单排在前面,提高抢单效率
- 用于定时任务清理过期订单

**查询示例:**
```javascript
// 任务大厅:获取最新的待接单订单
db.collection('orders').where({
  order_status: 0
})
.orderBy('create_time', 'desc')
.limit(20)
.get()
```

#### 4. meeting_location_2dsphere (地理空间索引)
```json
{
  "meeting_location": "2dsphere"
}
```
**作用:**
- **核心LBS功能**:支持基于位置的订单查询
- 实现"查找附近5km内的订单"功能
- 配合匹配算法计算演员到集合地点的距离

**查询示例:**
```javascript
// 查找用户附近5km内的待接单订单
db.collection('orders').where({
  order_status: 0,
  meeting_location: db.command.geoNear({
    geometry: db.Geo.Point(longitude, latitude),
    maxDistance: 5000,  // 5km
    minDistance: 0
  })
}).get()
```

#### 5. meeting_time (普通索引)
```json
{
  "meeting_time": 1
}
```
**作用:**
- 支持按集合时间范围查询订单
- 用于定时任务:触发"预约单出发提醒"
- 计算最晚出发时间,实现异常预警

**查询示例:**
```javascript
// 查找未来2小时内需要提醒的预约单
const now = Date.now()
const twoHoursLater = now + 2 * 60 * 60 * 1000
db.collection('orders').where({
  order_type: 'reservation',
  order_status: 1,
  meeting_time: db.command.gte(now).and(db.command.lte(twoHoursLater))
}).get()
```

#### 6. order_type_status (复合索引)
```json
{
  "order_type": 1,
  "order_status": 1
}
```
**作用:**
- 区分即时单和预约单的业务逻辑
- 即时单:接单后立即开启LBS追踪
- 预约单:需要计算出发提醒时间

**查询示例:**
```javascript
// 查询所有进行中的即时单
db.collection('orders').where({
  order_type: 'immediate',
  order_status: 1
}).get()
```

---

## 三、order_tracks (轨迹表)

### 核心字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| order_id | string | 关联订单ID |
| user_id | string | 上报位置的演员ID |
| location | object | GeoPoint坐标 |
| report_time | timestamp | 上报时间 |
| track_type | string | auto-自动, manual-手动, checkpoint-打卡 |
| distance_to_destination | double | 距离集合地点的距离(米) |

### 索引设计

#### 1. order_id_report_time (复合索引)
```json
{
  "order_id": 1,
  "report_time": 1
}
```
**作用:**
- **核心索引**:按时间顺序获取某订单的完整轨迹
- 剧组端实时查看演员移动路线
- 支持轨迹回放功能

**查询示例:**
```javascript
// 获取某订单的完整轨迹(按时间排序)
db.collection('order_tracks').where({
  order_id: 'xxx'
})
.orderBy('report_time', 'asc')
.get()
```

#### 2. user_id_report_time (复合索引)
```json
{
  "user_id": 1,
  "report_time": -1
}
```
**作用:**
- 查询演员的历史轨迹记录
- 用于数据分析和行为模式识别
- 安全审计和纠纷处理

**查询示例:**
```javascript
// 获取演员最近的位置记录
db.collection('order_tracks').where({
  user_id: 'xxx'
})
.orderBy('report_time', 'desc')
.limit(1)
.get()
```

#### 3. location_2dsphere (地理空间索引)
```json
{
  "location": "2dsphere"
}
```
**作用:**
- 支持基于位置的轨迹查询
- 实现电子围栏功能:判断演员是否到达集合地点100米内
- 异常位置检测

**查询示例:**
```javascript
// 判断演员是否进入集合地点100米范围
const meetingPoint = db.Geo.Point(lng, lat)
db.collection('order_tracks').where({
  order_id: 'xxx',
  location: db.command.geoNear({
    geometry: meetingPoint,
    maxDistance: 100
  })
})
.orderBy('report_time', 'desc')
.limit(1)
.get()
```

#### 4. order_id_track_type (复合索引)
```json
{
  "order_id": 1,
  "track_type": 1
}
```
**作用:**
- 快速筛选关键点打卡记录(checkpoint)
- 区分自动上报和手动打卡
- 用于验证履约流程:出发打卡、到达打卡

**查询示例:**
```javascript
// 获取某订单的打卡记录
db.collection('order_tracks').where({
  order_id: 'xxx',
  track_type: 'checkpoint'
}).get()
```

---

## 四、匹配算法索引优化建议

### 1. 双向匹配权重查询
结合多个索引实现复杂匹配逻辑:

```javascript
// 为高信用演员推送优质订单
const topActors = await db.collection('uni-id-users')
  .where({
    user_role: 2,
    credit_score_actor: db.command.gte(120)  // 使用 credit_score_actor 索引
  })
  .orderBy('credit_score_actor', 'desc')
  .get()

// 查找附近的高福利订单
const premiumOrders = await db.collection('orders')
  .where({
    order_status: 0,
    welfare_tags: db.command.in(['meal', 'taxi', 'accommodation']),
    meeting_location: db.command.geoNear({  // 使用 meeting_location_2dsphere 索引
      geometry: db.Geo.Point(lng, lat),
      maxDistance: 5000
    })
  })
  .orderBy('create_time', 'desc')  // 使用 order_status_create_time 索引
  .get()
```

### 2. 预约单提醒定时任务
```javascript
// 每分钟执行,查找需要提醒出发的预约单
const now = Date.now()
const reminderWindow = now + 30 * 60 * 1000  // 30分钟后

db.collection('orders').where({
  order_type: 'reservation',  // 使用 order_type_status 索引
  order_status: 1,
  meeting_time: db.command.gte(now).and(db.command.lte(reminderWindow))  // 使用 meeting_time 索引
}).get()
```

---

## 五、性能优化建议

### 1. 索引选择性
- **高选择性索引**:credit_score_actor/crew (降序排列,范围广)
- **中等选择性**:order_status, user_role (枚举值较少但常用)
- **复合索引顺序**:将高选择性字段放在前面

### 2. 避免索引冗余
- 不要创建 (A) 和 (A, B) 的重复索引
- MongoDB 会自动使用复合索引的前缀

### 3. 地理空间索引注意事项
- 2dsphere 索引支持 GeoJSON 格式
- coordinates 格式必须为 `[经度, 纬度]`
- 距离单位为米

### 4. 索引维护
- 定期监控慢查询日志
- 使用 explain() 分析查询计划
- 避免在高频写入字段上建过多索引

---

## 六、数据量预估与索引大小

### 预估数据量(西南大学试点)
- **用户表**:约 5000 名学生 + 100 个剧组 ≈ 5100 条
- **订单表**:每天 50 单 × 180 天 ≈ 9000 条
- **轨迹表**:每单 100 个点 × 9000 单 ≈ 90 万条

### 索引大小估算
- 用户表索引:< 1MB
- 订单表索引:< 5MB
- 轨迹表索引:≈ 50MB (地理索引较大)

**结论**:索引总大小约 60MB,对性能影响可忽略。

---

## 七、验证索引是否生效

使用以下命令验证索引:

```javascript
// 在 uniCloud Web 控制台执行
db.collection('orders')
  .where({ order_status: 0 })
  .orderBy('create_time', 'desc')
  .explain()
```

查看返回结果中的 `winningPlan.stage`,如果是 `IXSCAN` 则表示使用了索引。

---

## 八、总结

本数据库设计通过合理的索引策略实现了:
1. **高性能LBS查询**:支持5km半径内订单匹配
2. **实时轨迹追踪**:毫秒级查询演员位置
3. **双向信用体系**:快速筛选高分用户
4. **智能匹配算法**:复合索引支持多维度筛选
5. **业务逻辑优化**:区分即时单/预约单的不同处理流程

所有索引设计均基于实际业务场景,避免过度索引导致的写入性能下降。
