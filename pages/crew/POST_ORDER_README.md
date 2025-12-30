# 发布订单页面说明

## 文件

- 页面: `pages/crew/post_order.vue`
- 接口: `order-co.add()`

## 功能

- 基本信息: 需要人数、角色描述
- 集合信息: 地点选择、时间选择
- 演员要求: 性别、身高、体型、特长
- 福利待遇: 包盒饭、报销路费、提供住宿、有下午茶
- 定价设置: 按天/按时 + 金额

## 订单类型

根据集合时间自动判断:
- **即时单** (< 2小时): 接单后立即开启定位追踪
- **预约单** (>= 2小时): 演员出发后开启定位

## 依赖组件

```
uni-forms, uni-easyinput, uni-datetime-picker, uni-data-checkbox, uni-icons
```

## 接口调用

```javascript
const orderCo = uniCloud.importObject('order-co')
await orderCo.add({
  people_needed: 2,
  meeting_location_name: '重庆大学',
  meeting_location: { type: 'Point', coordinates: [106.4650, 29.5630] },
  meeting_time: Date.now() + 3600000,
  welfare_tags: ['meal'],
  price_type: 'daily',
  price_amount: 30000
})
```
