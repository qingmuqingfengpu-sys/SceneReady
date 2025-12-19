# Token验证问题 - 已解决

> 更新时间：2025-12-18
> 状态：已修复

---

## 问题描述

在微信小程序中，用户已登录但调用云对象时提示"请先登录"。

## 问题原因

`this.getUniIdToken()` 返回的是 **token 字符串**，而不是包含 `uid` 的对象。

原代码错误地假设：
```javascript
const token = this.getUniIdToken()
if (!token || !token.uid) {  // 错误！token.uid 不存在
  return { code: 401, message: '请先登录' }
}
```

## 修复方案

### 1. 添加 uni-id-common 依赖

在 `package.json` 中添加：
```json
{
  "dependencies": {
    "uni-id-common": "file:../../../../uni_modules/uni-id-common/uniCloud/cloudfunctions/common/uni-id-common"
  }
}
```

### 2. 重写 token 验证逻辑

```javascript
const uniIdCommon = require('uni-id-common')

module.exports = {
  _before: async function () {
    const clientInfo = this.getClientInfo()
    const tokenStr = this.getUniIdToken()

    if (tokenStr) {
      const uniID = uniIdCommon.createInstance({ clientInfo })
      const payload = await uniID.checkToken(tokenStr)

      if (payload.code === 0 && payload.uid) {
        this.authInfo = {
          uid: payload.uid,
          tokenExpired: payload.tokenExpired
        }
      }
    }
  },

  _getCurrentUserId() {
    return this.authInfo ? this.authInfo.uid : null
  },

  // 在业务方法中使用
  async someMethod() {
    const userId = this._getCurrentUserId()
    if (!userId) {
      return { code: 401, message: '请先登录' }
    }
    // ... 业务逻辑
  }
}
```

## 修复文件清单

| 文件 | 修改内容 |
|------|---------|
| `order-co/package.json` | 添加 uni-id-common 依赖 |
| `user-co/package.json` | 添加 uni-id-common 依赖 |
| `order-co/index.obj.js` | 重写 token 验证逻辑 |
| `database/uni-id-users.schema.json` | 新建，添加自定义字段 |

## 部署步骤

```bash
# 在 HBuilderX 中执行：
1. 右键 order-co -> "上传部署"
2. 右键 user-co -> "上传部署"
3. 右键 database -> "上传 DB Schema"
4. 重新编译运行小程序
```

## 验证方法

1. 登录小程序
2. 调用 `order-co.testToken()` 接口
3. 检查返回的 `uid` 是否正确

```javascript
const orderCo = uniCloud.importObject('order-co')
const result = await orderCo.testToken()
console.log(result)
// 应该返回：{ code: 0, data: { uid: 'xxx', ... } }
```

## 相关文档

- `API_STATUS.md` - 接口状态文档
- `PROJECT_STATUS.md` - 项目进度文档

---

**修复人**: Claude Opus 4.5
**修复日期**: 2025-12-18
