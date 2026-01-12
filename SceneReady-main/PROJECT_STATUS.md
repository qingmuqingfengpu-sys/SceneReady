# 艺拍即合 - 项目开发状态

> 最后更新: 2025-12-30

## 整体进度

| 模块 | 进度 | 完成数 |
|------|------|--------|
| 前端页面 | 100% | 12/12 |
| 后端接口 | 87.5% | 28/32 |
| 数据库设计 | 100% | 3/3 |
| 第三方集成 | 10% | 仅高德地图 |

---

## 前端页面

### 通用页面 (1/1)

| 页面 | 路径 | 功能 |
|------|------|------|
| 应用首页 | `pages/index/index.vue` | 角色选择入口、登录状态检查 |

### 剧组端 (6/6)

| 页面 | 路径 | 功能 |
|------|------|------|
| 剧组首页 | `pages/crew/index.vue` | 地图模式、附近演员、统计卡片 |
| 发布订单 | `pages/crew/post_order.vue` | 完整发单表单、福利标签、自动判断订单类型 |
| 订单列表 | `pages/crew/order_list.vue` | 状态筛选、分页加载 |
| 订单详情 | `pages/crew/order_detail.vue` | 订单信息、操作按钮、评价功能 |
| 履约追踪 | `pages/crew/order_tracking.vue` | 实时地图、演员轨迹、电子围栏 |
| 剧组中心 | `pages/crew/profile.vue` | 用户信息、统计数据、功能菜单 |

### 演员端 (5/5)

| 页面 | 路径 | 功能 |
|------|------|------|
| 演员首页 | `pages/actor/index.vue` | 任务大厅、筛选、抢单 |
| 工作详情 | `pages/actor/job_detail.vue` | 订单详情、剧组信息、抢单 |
| 我的订单 | `pages/actor/my_orders.vue` | 状态筛选、订单历史 |
| 履约追踪 | `pages/actor/order_tracking.vue` | 位置上报、打卡、导航 |
| 个人中心 | `pages/actor/profile.vue` | 用户信息、视频模卡、功能菜单 |

---

## 后端接口

### order-co 云对象 (17/17 方法)

| 方法 | 功能 | 状态 |
|------|------|------|
| `add(data)` | 发布订单 | 已完成 |
| `getMyOrders(params)` | 获取订单列表（剧组端） | 已完成 |
| `getActorOrders(params)` | 获取订单列表（演员端） | 已完成 |
| `getDetail(orderId)` | 获取订单详情 | 已完成 |
| `cancel(orderId, reason)` | 取消订单 | 已完成 |
| `grab(orderId)` | 抢单 | 已完成 |
| `getAvailableJobs(params)` | 获取可接订单 | 已完成 |
| `getNearbyActors(params)` | 获取附近演员 | 已完成 |
| `updateActorLocation(location)` | 更新演员位置 | 已完成 |
| `submitTrack(orderId, location)` | 提交轨迹 | 已完成 |
| `getTracks(orderId)` | 获取订单轨迹 | 已完成 |
| `checkIn(orderId, location)` | 打卡（电子围栏100米） | 已完成 |
| `updateOrderStatus(orderId, status)` | 更新订单状态 | 已完成 |
| `completeOrder(orderId)` | 完成订单 | 已完成 |
| `rateOrder(orderId, rating)` | 评价订单 | 已完成 |
| `testToken()` | 测试 token | 已完成 |

### user-co 云对象 (8/8 方法)

| 方法 | 功能 | 状态 |
|------|------|------|
| `getProfile()` | 获取当前用户资料 | 已完成 |
| `getPublicProfile(userId)` | 获取用户公开资料 | 已完成 |
| `updateProfile(data)` | 更新个人资料 | 已完成 |
| `setRole(role)` | 设置用户角色 | 已完成 |
| `getStats()` | 获取统计数据 | 已完成 |
| `getCreditHistory(params)` | 获取信用分历史 | 已完成 |
| `setVideoCard(videoUrl)` | 设置视频模卡URL | 已完成 |
| `submitVerification(type, data)` | 提交认证申请 | 已完成 |

### geo-service 云函数 (3/3 方法)

| 方法 | 功能 | 状态 |
|------|------|------|
| `regeo` | 逆地理编码 | 已完成 |
| `geo` | 地理编码 | 已完成 |
| `search` | POI搜索 | 已完成 |

### community-co 云对象 (0/4 方法 - 待开发)

| 方法 | 功能 | 状态 |
|------|------|------|
| `getPosts(type, page)` | 获取帖子列表 | 待开发 |
| `createPost(data)` | 发布帖子 | 待开发 |
| `getBlacklist(page)` | 获取红黑榜 | 待开发 |
| `reportUser(userId, reason)` | 举报用户 | 待开发 |

---

## 数据库设计

| 表名 | 说明 | 状态 |
|------|------|------|
| `orders` | 订单主表 | 已完成 |
| `order_tracks` | 轨迹记录表 | 已完成 |
| `uni-id-users` | 用户扩展表 | 已完成 |

> 详细索引设计请查看 [DATABASE_INDEX_README.md](./uniCloud-aliyun/database/DATABASE_INDEX_README.md)

---

## 设计系统

| 文件 | 说明 |
|------|------|
| `common/theme.scss` | 主题变量（颜色、字体、间距、圆角） |
| `common/common.scss` | 通用混合宏（布局、按钮、卡片、标签） |

**设计规范**:
- 主色调: Movie Gold (#FFD700)
- 背景色: Dark Gray (#121212)
- 辅色: Safety Blue (#2979FF)
- 警告色: Crimson Red (#FF5252)

---

## 待完成工作

### P1 优先级
- [ ] 社区系统（community-co 云对象 + 页面）
- [ ] 微信支付集成

### P2 优先级
- [ ] 推送通知（uni-push）
- [ ] 学生认证增强（学信网API）
- [ ] 企业认证增强（OCR识别）

### 前端优化
- [ ] 替换模拟数据为真实接口调用
- [ ] 添加缺失的静态资源图标
- [ ] 优化加载状态和骨架屏

---

## 部署清单

部署前请确认:

- [ ] 云函数已上传（order-co、user-co、geo-service）
- [ ] 数据库 Schema 已上传
- [ ] 数据库索引已创建
- [ ] 高德地图 Key 已配置
- [ ] 微信小程序权限已配置

---

## 相关文档

- [README.md](./README.md) - 项目介绍
- [PRD.md](./PRD.md) - 产品需求文档
- [API_STATUS.md](./API_STATUS.md) - 接口详细文档
- [DATABASE_INDEX_README.md](./uniCloud-aliyun/database/DATABASE_INDEX_README.md) - 数据库索引说明
