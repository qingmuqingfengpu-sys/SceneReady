const {
  checkLoginUserRecord,
  postLogin
} = require('./login')
const {
  postRegister
} = require('./register')
const {
  findUser
} = require('./account')
const {
  ERROR
} = require('../../common/error')
const {
  USER_STATUS
} = require('../../common/constants')

async function realPreUnifiedLogin (params = {}) {
  const {
    user,
    type
  } = params
  const appId = this.getUniversalClientInfo().appId
  const {
    total,
    userMatched
  } = await findUser({
    userQuery: user,
    authorizedApp: appId
  })
  // 过滤掉已注销的账户，允许用已注销账户的信息重新注册
  const activeUsers = userMatched.filter(u => u.status !== USER_STATUS.CLOSED)
  if (activeUsers.length === 0) {
    if (type === 'login') {
      if (total > 0 && userMatched.length === 0) {
        throw {
          errCode: ERROR.ACCOUNT_NOT_EXISTS_IN_CURRENT_APP
        }
      }
      throw {
        errCode: ERROR.ACCOUNT_NOT_EXISTS
      }
    }
    return {
      type: 'register',
      user
    }
  } if (activeUsers.length === 1) {
    if (type === 'register') {
      throw {
        errCode: ERROR.ACCOUNT_EXISTS
      }
    }
    const userRecord = activeUsers[0]
    checkLoginUserRecord(userRecord)
    return {
      type: 'login',
      user: userRecord
    }
  } else if (activeUsers.length > 1) {
    throw {
      errCode: ERROR.ACCOUNT_CONFLICT
    }
  }
}

async function preUnifiedLogin (params = {}) {
  try {
    const result = await realPreUnifiedLogin.call(this, params)
    return result
  } catch (error) {
    await this.middleware.uniIdLog({
      success: false
    })
    throw error
  }
}

async function postUnifiedLogin (params = {}) {
  const {
    user,
    extraData = {},
    isThirdParty = false,
    type,
    inviteCode
  } = params
  let result
  if (type === 'login') {
    result = await postLogin.call(this, {
      user,
      extraData,
      isThirdParty
    })
  } else if (type === 'register') {
    result = await postRegister.call(this, {
      user,
      extraData,
      isThirdParty,
      inviteCode
    })
  }
  return {
    ...result,
    type
  }
}

module.exports = {
  preUnifiedLogin,
  postUnifiedLogin
}
