# 剧组发单页面开发文档

## 📁 文件结构

```
pages/crew/
  └── post_order.vue           # 发单页面

uniCloud-aliyun/cloudfunctions/
  └── order-co/                # 订单云对象
      ├── index.obj.js         # 云对象主文件
      └── package.json         # 配置文件

components/
  └── map-picker/              # 地图选点组件(可选)
      └── map-picker.vue
```

---

## 🎯 功能实现

### 1. 前端页面 (post_order.vue)

#### 核心功能
✅ **基本信息**
- 需要人数输入
- 角色描述输入

✅ **集合信息**
- 地点选择 (使用 `uni.chooseLocation`)
- 时间选择 (使用 `uni-datetime-picker`)

✅ **演员要求**
- 性别筛选 (不限/男/女)
- 身高范围输入
- 体型多选 (偏瘦/标准/健壮/微胖)
- 特长多选 (开车/跳舞/唱歌/武术/游泳/骑马/乐器/外语)

✅ **福利待遇**
- 福利标签多选:
  - 包盒饭 (meal)
  - 包来回车费 (taxi)
  - 提供住宿 (accommodation)
  - 有奶茶/下午茶 (tea)
  - 其他福利 (other)

✅ **定价设置**
- 计费方式切换 (按天 daily / 按时 hourly)
- 金额输入 (元为单位,自动转换为分存储)

✅ **智能提示**
- 根据集合时间自动判断并显示订单类型:
  - **即时单** (<2h): "接单后立即开启实时定位追踪"
  - **预约单** (>2h): "演员出发后开启定位,保护隐私省电"

#### 表单校验规则
```javascript
{
  people_needed: 必填, ≥1
  meeting_location_name: 必填
  meeting_time: 必填, 必须晚于当前时间
  price_type: 必填
  price_amount: 必填, >0
}
```

#### 调用方式
```javascript
// 跳转到发单页面
uni.navigateTo({
  url: '/pages/crew/post_order'
})
```

---

### 2. 云对象 (order-co)

#### 主要方法

##### 2.1 add(data) - 发布订单
**请求参数:**
```javascript
{
  people_needed: 1,                    // 需要人数
  role_description: '',                // 角色描述
  meeting_location_name: '重庆大学',   // 集合地点名称
  meeting_location: {                  // 集合地点坐标
    type: 'Point',
    coordinates: [106.123, 29.456]
  },
  meeting_time: 1702000000000,         // 集合时间戳
  gender_requirement: 0,               // 性别要求
  height_min: 170,                     // 最低身高
  height_max: 180,                     // 最高身高
  body_type: ['normal', 'athletic'],   // 体型要求
  special_skills: ['driving'],         // 特长要求
  welfare_tags: ['meal', 'taxi'],      // 福利标签
  price_type: 'daily',                 // 计费方式
  price_amount: 10000,                 // 金额(分)
  remark: ''                           // 备注
}
```

**返回结果:**
```javascript
{
  code: 0,
  message: '发布成功',
  data: {
    order_id: 'xxx',
    order_type: 'immediate' // 或 'reservation'
  }
}
```

**业务逻辑:**
1. ✅ 检查用户是否登录
2. ✅ 检查用户角色 (必须是剧组 user_role=1)
3. ✅ 检查认证状态 (必须已认证 auth_status=2)
4. ✅ 数据校验 (必填字段、合法性)
5. ✅ **自动判断订单类型**:
   ```javascript
   const diffHours = (meetingTime - now) / (1000 * 60 * 60)
   order_type = diffHours < 2 ? 'immediate' : 'reservation'
   ```
6. ✅ 存入数据库
7. ✅ 如果是即时单,触发推送通知给附近演员

---

##### 2.2 getDetail(orderId) - 获取订单详情
**请求参数:**
```javascript
orderId: 'xxx'
```

**返回结果:**
```javascript
{
  code: 0,
  data: {
    // 订单完整信息
    price_amount_yuan: '100.00' // 自动转换的元为单位金额
  }
}
```

**权限控制:**
- 仅发布者和接单者可以查看详情

---

##### 2.3 getMyOrders(params) - 获取我的订单列表
**请求参数:**
```javascript
{
  status: 0,      // 可选,按状态筛选
  page: 1,        // 页码
  pageSize: 20    // 每页数量
}
```

**返回结果:**
```javascript
{
  code: 0,
  data: {
    list: [],      // 订单列表
    total: 100,    // 总数
    page: 1,
    pageSize: 20
  }
}
```

---

##### 2.4 cancel(orderId, reason) - 取消订单
**请求参数:**
```javascript
{
  orderId: 'xxx',
  reason: '临时取消拍摄'
}
```

**业务逻辑:**
- 仅发布者可以取消
- 仅待接单(0)和进行中(1)状态可以取消
- 如果已有人接单,扣除剧组信用分5分

---

## 🔧 配置步骤

### 1. 配置高德地图 (用于地点选择)

在 `manifest.json` 中配置:

```json
{
  "mp-weixin": {
    "permission": {
      "scope.userLocation": {
        "desc": "需要获取您的位置信息用于选择集合地点"
      }
    },
    "requiredPrivateInfos": [
      "chooseLocation",
      "getLocation"
    ]
  },
  "app-plus": {
    "maps": {
      "amap": {
        "appkey_ios": "你的iOS Key",
        "appkey_android": "你的Android Key"
      }
    }
  }
}
```

### 2. 上传云对象

```bash
# 在HBuilderX中
1. 右键 uniCloud-aliyun/cloudfunctions/order-co
2. 点击 "上传部署"
3. 选择 "上传并运行"
```

### 3. 配置页面路由

在 `pages.json` 中添加:

```json
{
  "pages": [
    {
      "path": "pages/crew/post_order",
      "style": {
        "navigationBarTitleText": "发布需求",
        "enablePullDownRefresh": false
      }
    }
  ]
}
```

---

## 🎨 UI组件依赖

本页面使用了以下 uni-ui 组件:

```
uni-forms           # 表单容器
uni-forms-item      # 表单项
uni-easyinput       # 输入框
uni-datetime-picker # 日期时间选择器
uni-data-checkbox   # 复选框/单选框
uni-section         # 区块分组
uni-icons           # 图标
```

**安装方式:**
```bash
npm install @dcloudio/uni-ui
```

或在HBuilderX中: 工具 -> 插件安装 -> uni-ui

---

## 📊 数据流程图

```
用户填写表单
    ↓
前端校验
    ↓
调用 order-co.add()
    ↓
后端校验 (登录/角色/认证)
    ↓
计算订单类型 (immediate/reservation)
    ↓
存入 orders 表
    ↓
[如果是即时单] 推送通知附近演员
    ↓
返回成功 → 跳转到订单列表
```

---

## 🚀 扩展功能建议

### 1. 地图选点优化
当前使用 `uni.chooseLocation`,在某些平台可能受限。可以:
- 使用自定义地图组件 (已提供 map-picker.vue)
- 集成第三方地图SDK (腾讯地图/百度地图)

### 2. 推送通知实现
在 `_notifyNearbyActors` 方法中实现:
```javascript
// 使用uni-push
const uniPush = uniCloud.getPushManager()
await uniPush.sendMessage({
  push_clientid: actor.push_clientid,
  title: '新订单通知',
  content: `附近有新订单,${orderData.price_amount/100}元/${orderData.price_type}`
})
```

### 3. 智能定价建议
当积累足够数据后,可以开发VIP功能:
```javascript
// 调用云函数获取行业指导价
const priceRes = await uniCloud.callFunction({
  name: 'price-recommend',
  data: {
    city: '重庆',
    height: 180,
    role_type: '群演'
  }
})
// 显示参考价格: 80-120元/天
```

### 4. 草稿保存
在 `onHide` 时自动保存表单到本地:
```javascript
onHide() {
  uni.setStorageSync('order_draft', this.formData)
}

onLoad() {
  const draft = uni.getStorageSync('order_draft')
  if (draft) {
    uni.showModal({
      title: '提示',
      content: '检测到未完成的草稿,是否恢复?',
      success: (res) => {
        if (res.confirm) {
          this.formData = draft
        }
      }
    })
  }
}
```

---

## 🐛 常见问题

### Q1: uni.chooseLocation 无法使用?
**A:** 检查以下配置:
1. manifest.json 中是否配置了 `scope.userLocation` 权限
2. 小程序是否在微信公众平台配置了合法域名
3. App端是否配置了地图Key

### Q2: 云对象调用失败?
**A:**
1. 检查是否已上传部署云对象
2. 查看云函数日志排查错误
3. 确认用户已登录且token有效

### Q3: 时间选择器显示异常?
**A:**
确保 `uni-datetime-picker` 版本为最新:
```bash
npm update @dcloudio/uni-ui
```

---

## 📝 测试用例

### 测试1: 发布即时单
```javascript
{
  meeting_time: Date.now() + 1 * 60 * 60 * 1000, // 1小时后
  // ... 其他字段
}
// 预期: order_type = 'immediate'
```

### 测试2: 发布预约单
```javascript
{
  meeting_time: Date.now() + 3 * 60 * 60 * 1000, // 3小时后
  // ... 其他字段
}
// 预期: order_type = 'reservation'
```

### 测试3: 未认证用户发单
```javascript
// 预期返回: { code: 403, message: '请先完成企业认证' }
```

---

## 📚 相关文档

- [UniCloud云对象文档](https://uniapp.dcloud.net.cn/uniCloud/cloud-obj.html)
- [uni-ui组件库](https://uniapp.dcloud.net.cn/component/uniui/uni-ui.html)
- [高德地图API](https://lbs.amap.com/)
- [订单数据库Schema](../../../uniCloud-aliyun/database/DATABASE_INDEX_README.md)

---

## ✅ 完成状态

- [x] 前端页面开发
- [x] 云对象开发
- [x] 表单校验
- [x] 订单类型自动判断
- [x] 数据库存储
- [x] 权限控制
- [ ] 推送通知实现 (TODO)
- [ ] 地理编码服务 (TODO)
- [ ] 草稿保存功能 (TODO)
