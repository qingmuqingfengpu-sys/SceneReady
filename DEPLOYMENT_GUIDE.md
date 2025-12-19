# 艺拍即合 - 部署配置指南

> 更新时间：2025-12-18 20:30

---

## 🔧 最近修复 (2025-12-18)

### Token验证问题已修复

**问题**：用户已登录但调用云对象提示"请先登录"

**修复内容**：
- `order-co/package.json` 添加 `uni-id-common` 依赖
- `user-co/package.json` 添加 `uni-id-common` 依赖
- `order-co/index.obj.js` 重写 token 验证逻辑
- 创建 `uni-id-users.schema.json` 添加自定义字段

**必须执行的部署步骤**：
```bash
1. 右键 order-co -> "上传部署"
2. 右键 user-co -> "上传部署"
3. 右键 database -> "上传 DB Schema"
4. 重新编译运行小程序
```

---

## ✅ 已完成的配置

### 1. 页面路由配置 (pages.json)

已添加以下页面路由:
```json
{
  "path": "pages/crew/post_order",
  "style": {
    "navigationBarTitleText": "发布需求"
  }
},
{
  "path": "pages/crew/index",
  "style": {
    "navigationBarTitleText": "剧组端"
  }
},
{
  "path": "pages/crew/order_list",
  "style": {
    "navigationBarTitleText": "我的订单"
  }
}
```

### 2. 高德地图配置 (manifest.json)

#### 小程序端配置
```json
"mp-weixin": {
  "permission": {
    "scope.userLocation": {
      "desc": "您的位置信息将用于选择集合地点和查找附近订单"
    }
  },
  "requiredPrivateInfos": [
    "chooseLocation",
    "getLocation"
  ]
}
```

#### App端配置
```json
"app-plus": {
  "sdkConfigs": {
    "maps": {
      "amap": {
        "appkey_ios": "976d8beb7728d3ee2b3ef1c8a1b3611a",
        "appkey_android": "976d8beb7728d3ee2b3ef1c8a1b3611a"
      }
    },
    "geolocation": {
      "amap": {
        "appkey_ios": "976d8beb7728d3ee2b3ef1c8a1b3611a",
        "appkey_android": "976d8beb7728d3ee2b3ef1c8a1b3611a"
      }
    }
  }
}
```

---

## 📁 项目文件结构

```
艺拍即合/
├── pages/
│   ├── crew/                        # 剧组端页面
│   │   ├── index.vue               # 剧组首页
│   │   ├── post_order.vue          # 发布需求页面
│   │   └── order_list.vue          # 订单列表页面
│   └── index/
│       └── index.vue               # 应用首页
├── components/
│   └── map-picker/                 # 地图选点组件(可选)
│       └── map-picker.vue
├── uniCloud-aliyun/
│   ├── database/                   # 数据库Schema
│   │   ├── uni-id-users.schema.json  # 用户表扩展 (新建)
│   │   ├── uni-id-users.index.json
│   │   ├── orders.schema.json
│   │   ├── orders.index.json
│   │   ├── order_tracks.schema.json
│   │   ├── order_tracks.index.json
│   │   └── DATABASE_INDEX_README.md
│   └── cloudfunctions/             # 云函数
│       ├── order-co/               # 订单云对象 (17个方法)
│       │   ├── index.obj.js        # 已修复token验证
│       │   └── package.json        # 已添加uni-id-common依赖
│       ├── user-co/                # 用户云对象 (8个方法)
│       │   ├── index.obj.js
│       │   └── package.json        # 已添加uni-id-common依赖
│       └── geo-service/            # 地理编码服务 (3个方法)
│           ├── index.js
│           └── package.json
├── pages.json                      # 页面配置
├── manifest.json                   # 应用配置
└── readme.md                       # 需求文档
```

---

## 🚀 部署步骤

### 步骤1: 上传云函数

#### 1.1 上传 order-co 云对象
1. 在 HBuilderX 中打开项目
2. 找到 `uniCloud-aliyun/cloudfunctions/order-co`
3. 右键点击文件夹
4. 选择 **"上传部署"** → **"上传云端安装依赖并运行"**
5. 等待上传完成

#### 1.2 上传 geo-service 云函数
1. 找到 `uniCloud-aliyun/cloudfunctions/geo-service`
2. 右键点击文件夹
3. 选择 **"上传部署"** → **"上传云端安装依赖并运行"**
4. 等待上传完成

### 步骤2: 初始化数据库

#### 2.1 上传 Schema
1. 找到 `uniCloud-aliyun/database/orders.schema.json`
2. 右键点击文件
3. 选择 **"上传Schema及扩展校验函数"**
4. 重复以上步骤,上传所有 `.schema.json` 文件:
   - `uni-id-users.schema.json` (已扩展)
   - `orders.schema.json`
   - `order_tracks.schema.json`

#### 2.2 创建索引
1. 登录 [uniCloud Web控制台](https://unicloud.dcloud.net.cn/)
2. 选择你的服务空间
3. 进入 "云数据库" → "数据库集合"
4. 对每个表执行以下操作:

**orders 表索引:**
```javascript
// 在索引管理中添加以下索引
db.collection('orders').createIndex({
  publisher_id: 1,
  order_status: 1
}, { name: 'publisher_id_status' })

db.collection('orders').createIndex({
  order_status: 1,
  create_time: -1
}, { name: 'order_status_create_time' })

db.collection('orders').createIndex({
  meeting_location: '2dsphere'
}, { name: 'meeting_location_2dsphere' })
```

**uni-id-users 表索引:**
```javascript
db.collection('uni-id-users').createIndex({
  user_role: 1,
  auth_status: 1
}, { name: 'user_role_auth_status' })

db.collection('uni-id-users').createIndex({
  credit_score_actor: -1
}, { name: 'credit_score_actor' })
```

**order_tracks 表索引:**
```javascript
db.collection('order_tracks').createIndex({
  order_id: 1,
  report_time: 1
}, { name: 'order_id_report_time' })

db.collection('order_tracks').createIndex({
  location: '2dsphere'
}, { name: 'location_2dsphere' })
```

### 步骤3: 配置微信小程序权限

#### 3.1 配置隐私协议
1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 "设置" → "基本设置" → "服务类目"
3. 添加类目: "教育" → "在线教育"
4. 进入 "设置" → "隐私设置"
5. 在 "用户隐私保护指引" 中添加:
   ```
   我们需要获取您的位置信息,用于:
   1. 选择集合地点
   2. 查找附近的工作机会
   3. 实时定位追踪(仅在接单后)
   ```

#### 3.2 配置合法域名
在微信公众平台添加以下域名到 "服务器域名" 配置:

**request合法域名:**
```
https://restapi.amap.com
https://你的uniCloud服务空间域名.bspapp.com
```

**uploadFile合法域名:**
```
https://你的uniCloud服务空间域名.bspapp.com
```

**downloadFile合法域名:**
```
https://你的uniCloud服务空间域名.bspapp.com
```

---

## 🧪 测试验证

### 1. 测试发单功能

#### 测试用例1: 发布即时单
```
集合时间: 1小时后
预期结果: order_type = 'immediate'
```

#### 测试用例2: 发布预约单
```
集合时间: 3小时后
预期结果: order_type = 'reservation'
```

#### 测试用例3: 权限验证
```
未认证用户发单
预期结果: 返回 "请先完成企业认证"
```

### 2. 测试地图选点

1. 点击 "集合地点" 选择器
2. 在地图上选择位置
3. 验证地址是否正确显示
4. 检查坐标是否正确保存

### 3. 测试云函数

在 HBuilderX 中打开云函数调试:

```javascript
// 测试 order-co.add
uniCloud.importObject('order-co').add({
  people_needed: 1,
  meeting_location_name: '重庆大学',
  meeting_location: {
    type: 'Point',
    coordinates: [106.123, 29.456]
  },
  meeting_time: Date.now() + 3 * 60 * 60 * 1000,
  price_type: 'daily',
  price_amount: 10000
})

// 测试 geo-service
uniCloud.callFunction({
  name: 'geo-service',
  data: {
    action: 'regeo',
    longitude: 106.123,
    latitude: 29.456
  }
})
```

---

## 🎯 快速启动剧组端

### 方法1: 从应用首页跳转
在 `pages/index/index.vue` 中添加按钮:

```vue
<template>
  <view>
    <button @click="goToCrew">剧组端入口</button>
  </view>
</template>

<script>
export default {
  methods: {
    goToCrew() {
      uni.navigateTo({
        url: '/pages/crew/index'
      })
    }
  }
}
</script>
```

### 方法2: 直接设置为启动页
修改 `pages.json`,将剧组首页设为第一页:

```json
{
  "pages": [
    {
      "path": "pages/crew/index",
      "style": {
        "navigationBarTitleText": "剧组端"
      }
    }
    // ... 其他页面
  ]
}
```

---

## 📝 功能清单

### ✅ 已实现的功能

#### 前端功能
- [x] 剧组端首页 (统计卡片、快捷操作、最近订单)
- [x] 发布需求页面 (完整表单、福利标签、定价设置)
- [x] 订单列表页面 (状态筛选、分页加载)
- [x] 地图选点功能 (uni.chooseLocation)
- [x] 地理编码服务集成

#### 后端功能
- [x] 订单创建 (order-co.add)
- [x] 订单类型自动判断 (即时单/预约单)
- [x] 权限校验 (角色、认证状态)
- [x] 订单列表查询 (order-co.getMyOrders)
- [x] 订单取消 (order-co.cancel)
- [x] 信用分扣减逻辑

#### 数据库
- [x] users表扩展 (角色、信用分、认证信息)
- [x] orders表设计 (福利标签、订单类型、定价)
- [x] order_tracks表设计 (轨迹追踪)
- [x] 索引优化 (LBS查询、信用分排序)

---

## 🔧 下一步开发建议

### 1. 演员端功能
- [ ] 演员首页 (任务大厅、附近订单地图)
- [ ] 抢单功能 (距离计算、信用分匹配)
- [ ] 轨迹上报 (LBS追踪)
- [ ] 打卡功能 (电子围栏)

### 2. 推送通知
- [ ] 集成uni-push
- [ ] 新订单推送 (Top 20%演员提前推送)
- [ ] 预约单出发提醒
- [ ] 迟到预警通知

### 3. 支付结算
- [ ] 集成微信支付
- [ ] 自动结算逻辑
- [ ] 钱包余额管理

### 4. 认证审核
- [ ] 学生认证页面 (学信网接口)
- [ ] 企业认证页面 (OCR识别)
- [ ] 管理后台审核

---

## 🐛 常见问题解决

### Q1: 云函数上传失败
**A:**
1. 检查网络连接
2. 确认已登录uniCloud账号
3. 查看HBuilderX控制台错误信息
4. 尝试重新连接服务空间

### Q2: 地图选点无法使用
**A:**
1. 检查 manifest.json 中的权限配置
2. 微信小程序需在公众平台配置合法域名
3. App端检查高德地图Key是否正确

### Q3: 数据库写入失败
**A:**
1. 检查Schema是否已上传
2. 查看云函数日志排查错误
3. 确认字段类型匹配

### Q4: 订单类型判断错误
**A:**
检查集合时间是否正确传递:
```javascript
// 确保meeting_time是时间戳格式
meeting_time: new Date(dateStr).getTime()
```

---

## 📞 技术支持

- **UniCloud文档**: https://uniapp.dcloud.net.cn/uniCloud/
- **高德地图API**: https://lbs.amap.com/api/webservice/summary
- **uni-ui组件库**: https://uniapp.dcloud.net.cn/component/uniui/uni-ui.html

---

## ✅ 部署检查清单

部署前请确认:

- [ ] 所有云函数已上传并运行成功
- [ ] 数据库Schema已上传
- [ ] 数据库索引已创建
- [ ] 高德地图Key已配置
- [ ] 微信小程序权限已配置
- [ ] 合法域名已添加
- [ ] 测试用例全部通过
- [ ] 用户隐私协议已完善

---

**恭喜!您的发单功能已配置完成,可以开始使用了!** 🎉
