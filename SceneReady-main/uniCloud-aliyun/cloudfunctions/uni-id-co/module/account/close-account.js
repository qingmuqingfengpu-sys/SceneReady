const {
  setUserStatus
} = require('../../lib/utils/update-user-info')
const {
  USER_STATUS,
  userCollection,
  dbCmd
} = require('../../common/constants')

/**
 * 注销账户
 * @tutorial https://uniapp.dcloud.net.cn/uniCloud/uni-id-pages.html#close-account
 * @returns
 */
module.exports = async function () {
  const { uid } = this.authInfo

  // 清除用户唯一标识字段，避免注销后无法用相同账号重新注册
  await userCollection.doc(uid).update({
    // 清除微信openid
    wx_openid: dbCmd.set({
      mp: null,
      app: null,
      h5: null,
      web: null
    }),
    // 清除其他第三方登录标识
    ali_openid: null,
    apple_openid: null,
    qq_openid: null,
    wx_unionid: null,
    qq_unionid: null,
    // 清除手机号
    mobile: null,
    mobile_confirmed: 0,
    // 清除邮箱
    email: null,
    email_confirmed: 0,
    // 清除用户名
    username: null,
    // 清除第三方身份信息
    identities: []
  })

  // 设置用户状态为已注销
  return setUserStatus(uid, USER_STATUS.CLOSED)
}
