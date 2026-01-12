# Token 验证问题修复记录

> 状态: 已修复

## 问题描述

用户已登录但调用云对象时提示"请先登录"。

## 原因

`this.getUniIdToken()` 返回的是 token 字符串，不是包含 uid 的对象。

## 解决方案

使用 `uni-id-common` 模块验证 token:

```javascript
const uniIdCommon = require('uni-id-common')

_before: async function () {
  const tokenStr = this.getUniIdToken()
  if (tokenStr) {
    const uniID = uniIdCommon.createInstance({ clientInfo: this.getClientInfo() })
    const payload = await uniID.checkToken(tokenStr)
    if (payload.code === 0) {
      this.authInfo = { uid: payload.uid }
    }
  }
}
```

## 修复文件

- `order-co/package.json` - 添加 uni-id-common 依赖
- `order-co/index.obj.js` - 重写 token 验证逻辑
