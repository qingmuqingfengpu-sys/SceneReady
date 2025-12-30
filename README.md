# 艺拍即合

> 短剧行业用工平台 - "短剧界的滴滴"

基于 uni-app + uniCloud 的跨平台短剧行业用工匹配应用，解决剧组急需用人和大学生兼职安全保障问题。

## 核心特点

- **快速响应**: 2小时到岗的即时单模式
- **精准匹配**: 基于 LBS 的演员筛选和推荐
- **履约追踪**: 实时位置追踪 + 电子围栏打卡
- **双向信用**: 演员和剧组的双向评价体系

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | uni-app (Vue 3) |
| 云服务 | uniCloud (阿里云) |
| 地图服务 | 高德地图 |
| UI 组件 | uni-ui |
| 用户系统 | uni-id-pages |

## 项目结构

```
艺拍即合/
├── pages/                          # 页面目录
│   ├── index/                      # 应用首页
│   ├── crew/                       # 剧组端 (6个页面)
│   │   ├── index.vue              # 剧组首页（地图模式）
│   │   ├── post_order.vue         # 发布订单
│   │   ├── order_list.vue         # 订单列表
│   │   ├── order_detail.vue       # 订单详情
│   │   ├── order_tracking.vue     # 履约追踪
│   │   └── profile.vue            # 剧组中心
│   └── actor/                      # 演员端 (5个页面)
│       ├── index.vue              # 演员首页（任务大厅）
│       ├── job_detail.vue         # 工作详情
│       ├── my_orders.vue          # 我的订单
│       ├── order_tracking.vue     # 履约追踪
│       └── profile.vue            # 个人中心
├── common/                         # 全局样式
│   ├── theme.scss                 # 主题配置
│   └── common.scss                # 通用样式
├── uniCloud-aliyun/               # 云端代码
│   ├── cloudfunctions/            # 云函数
│   │   ├── order-co/              # 订单云对象 (17个方法)
│   │   ├── user-co/               # 用户云对象 (8个方法)
│   │   ├── geo-service/           # 地理服务 (3个方法)
│   │   └── uni-id-co/             # uni-id 官方模块
│   └── database/                  # 数据库 Schema
│       ├── orders.schema.json     # 订单表
│       ├── order_tracks.schema.json # 轨迹表
│       └── uni-id-users.schema.json # 用户扩展表
└── uni_modules/                    # uni-app 插件
```

## 快速开始

### 环境要求

- HBuilderX 3.0+
- 微信开发者工具
- uniCloud 服务空间（阿里云）

### 安装步骤

1. **克隆项目**
   ```bash
   git clone [项目地址]
   ```

2. **导入 HBuilderX**
   - 打开 HBuilderX
   - 文件 -> 导入 -> 从本地目录导入

3. **关联云服务空间**
   - 右键 `uniCloud-aliyun` -> 关联云服务空间
   - 选择或创建阿里云服务空间

4. **上传云函数**
   ```
   右键 cloudfunctions/order-co -> 上传部署
   右键 cloudfunctions/user-co -> 上传部署
   右键 cloudfunctions/geo-service -> 上传部署
   ```

5. **上传数据库 Schema**
   ```
   右键 database -> 上传 DB Schema
   ```

6. **运行项目**
   - 运行 -> 运行到小程序模拟器 -> 微信开发者工具

### 配置说明

**高德地图 Key** (已配置在 manifest.json):
- App Key: `976d8beb7728d3ee2b3ef1c8a1b3611a`
- 云函数 Key: `82a78366e16299466ec46f919fde5506`

> 建议申请项目专用 Key 替换测试 Key

## 功能模块

### 剧组端
| 功能 | 状态 | 说明 |
|------|------|------|
| 地图首页 | 已完成 | 查看附近演员，筛选演员 |
| 发布订单 | 已完成 | 支持即时单/预约单 |
| 订单管理 | 已完成 | 订单列表、详情、取消 |
| 履约追踪 | 已完成 | 实时查看演员位置 |
| 评价系统 | 已完成 | 对演员评分 |

### 演员端
| 功能 | 状态 | 说明 |
|------|------|------|
| 任务大厅 | 已完成 | 查看可接订单，筛选 |
| 抢单 | 已完成 | 含事务处理防并发 |
| 履约追踪 | 已完成 | 位置上报、打卡 |
| 我的订单 | 已完成 | 订单历史 |
| 评价系统 | 已完成 | 对剧组评分 |

### 待开发功能
- 社区系统（红黑榜、经验分享）
- 微信支付集成
- 推送通知
- 学生/企业认证增强

## 文档索引

| 文档 | 说明 |
|------|------|
| [PRD.md](./PRD.md) | 产品需求文档 |
| [API_STATUS.md](./API_STATUS.md) | 后端接口文档 |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | 开发进度总结 |
| [DATABASE_INDEX_README.md](./uniCloud-aliyun/database/DATABASE_INDEX_README.md) | 数据库索引说明 |

## 开发进度

| 模块 | 进度 | 完成数 |
|------|------|--------|
| 前端页面 | 100% | 12/12 |
| 后端接口 | 87.5% | 28/32 |
| 数据库设计 | 100% | 3/3 |

> 详细进度请查看 [PROJECT_STATUS.md](./PROJECT_STATUS.md)

## 设计规范

- **主色调**: Movie Gold (#FFD700)
- **背景色**: Dark Gray (#121212) - 暗黑模式
- **辅色**: Safety Blue (#2979FF)
- **警告色**: Crimson Red (#FF5252)

## 许可证

本项目为大学生创新创业项目，仅供学习交流使用。
