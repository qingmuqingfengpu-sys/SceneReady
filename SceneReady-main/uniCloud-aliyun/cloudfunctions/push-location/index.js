'use strict'

const db = uniCloud.database()
const dbCmd = db.command

/**
 * push-location 云函数
 *
 * 功能：
 * 1. 演员上传位置时，推送给订阅该区域的剧组用户
 * 2. 管理用户的视口订阅
 *
 * 调用方式：
 * - action: 'updateLocation' - 演员更新位置
 * - action: 'subscribe' - 用户订阅视口
 * - action: 'unsubscribe' - 用户取消订阅
 * - action: 'setActive' - 设置用户活跃状态
 */
exports.main = async (event, context) => {
  const { action, data } = event

  switch (action) {
    case 'updateLocation':
      return await updateActorLocation(data, context)
    case 'subscribe':
      return await subscribeViewport(data, context)
    case 'unsubscribe':
      return await unsubscribeViewport(data, context)
    case 'setActive':
      return await setActiveStatus(data, context)
    default:
      return { code: -1, msg: 'Unknown action' }
  }
}

/**
 * 演员更新位置 - 推送给订阅该区域的用户
 */
async function updateActorLocation(data, context) {
  const { actor_id, latitude, longitude, actor_info } = data

  if (!actor_id || latitude == null || longitude == null) {
    return { code: -1, msg: 'Missing required fields' }
  }

  try {
    // 1. 更新演员在数据库中的位置
    await db.collection('uni-id-users').doc(actor_id).update({
      current_location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      location_update_time: Date.now()
    })

    // 2. 查找订阅了包含该位置的视口的活跃用户
    // 条件：演员位置在用户订阅的视口范围内
    const subscriptions = await db.collection('user-viewport-subscriptions')
      .where({
        is_active: true,
        role: 'crew', // 只推送给剧组用户
        // 检查演员位置是否在订阅的视口范围内
        'viewport.southwest.latitude': dbCmd.lte(latitude),
        'viewport.southwest.longitude': dbCmd.lte(longitude),
        'viewport.northeast.latitude': dbCmd.gte(latitude),
        'viewport.northeast.longitude': dbCmd.gte(longitude)
      })
      .field({
        push_clientid: true,
        user_id: true
      })
      .limit(1000) // 限制推送数量
      .get()

    if (subscriptions.data.length === 0) {
      console.log('没有用户订阅该区域')
      return { code: 0, msg: 'No subscribers in this area', pushed: 0 }
    }

    // 3. 获取推送客户端ID列表
    const pushClientIds = subscriptions.data
      .map(s => s.push_clientid)
      .filter(Boolean)

    if (pushClientIds.length === 0) {
      return { code: 0, msg: 'No valid push clients', pushed: 0 }
    }

    // 4. 构建推送消息
    const pushMessage = {
      type: 'location-update',
      data: {
        actor_id: actor_id,
        latitude: latitude,
        longitude: longitude,
        timestamp: Date.now(),
        // 可选：附带演员基本信息
        actor_info: actor_info || null
      }
    }

    // 5. 使用 uni-push 发送透传消息
    const pushResult = await uniCloud.sendMessage({
      push_clientid: pushClientIds,
      title: '位置更新',
      content: JSON.stringify(pushMessage),
      payload: pushMessage,
      // 透传消息配置
      options: {
        // HW: 华为通道配置
        HW: {
          '/message/android/category': 'VOIP',
          '/message/android/notification/importance': 'NORMAL'
        },
        // XM: 小米通道配置
        XM: {
          '/extra.channel_id': 'location_update'
        },
        // OPPO通道配置
        OP: {
          '/channel_id': 'location_update'
        },
        // VIVO通道配置
        VV: {
          '/classification': 1
        }
      },
      // 使用透传模式，不显示通知栏
      settings: {
        strategy: {
          default: 1  // 1-在线走长连接，离线不推送
        }
      }
    })

    console.log('推送结果:', pushResult, '推送给', pushClientIds.length, '个用户')

    return {
      code: 0,
      msg: 'Push sent',
      pushed: pushClientIds.length,
      result: pushResult
    }

  } catch (error) {
    console.error('updateActorLocation error:', error)
    return { code: -1, msg: error.message }
  }
}

/**
 * 用户订阅视口 - 当用户打开地图页面时调用
 */
async function subscribeViewport(data, context) {
  const { push_clientid, viewport, user_location, role, platform } = data

  // 从 context 获取用户ID
  const uid = context.CLIENTUID || context.OPENID
  if (!uid) {
    return { code: 401, msg: 'Unauthorized' }
  }

  if (!push_clientid) {
    return { code: -1, msg: 'Missing push_clientid' }
  }

  try {
    // 查找是否已存在订阅
    const existing = await db.collection('user-viewport-subscriptions')
      .where({
        user_id: uid
      })
      .limit(1)
      .get()

    const subscriptionData = {
      user_id: uid,
      push_clientid: push_clientid,
      viewport: viewport || null,
      user_location: user_location || null,
      role: role || 'crew',
      platform: platform || 'mp-weixin',
      is_active: true,
      update_time: Date.now()
    }

    if (existing.data.length > 0) {
      // 更新现有订阅
      await db.collection('user-viewport-subscriptions')
        .doc(existing.data[0]._id)
        .update(subscriptionData)
    } else {
      // 创建新订阅
      subscriptionData.create_time = Date.now()
      await db.collection('user-viewport-subscriptions').add(subscriptionData)
    }

    return { code: 0, msg: 'Subscribed' }

  } catch (error) {
    console.error('subscribeViewport error:', error)
    return { code: -1, msg: error.message }
  }
}

/**
 * 用户取消订阅 - 当用户离开地图页面时调用
 */
async function unsubscribeViewport(data, context) {
  const uid = context.CLIENTUID || context.OPENID
  if (!uid) {
    return { code: 401, msg: 'Unauthorized' }
  }

  try {
    await db.collection('user-viewport-subscriptions')
      .where({
        user_id: uid
      })
      .update({
        is_active: false,
        update_time: Date.now()
      })

    return { code: 0, msg: 'Unsubscribed' }

  } catch (error) {
    console.error('unsubscribeViewport error:', error)
    return { code: -1, msg: error.message }
  }
}

/**
 * 设置用户活跃状态
 */
async function setActiveStatus(data, context) {
  const { is_active, viewport, user_location } = data
  const uid = context.CLIENTUID || context.OPENID

  if (!uid) {
    return { code: 401, msg: 'Unauthorized' }
  }

  try {
    const updateData = {
      is_active: is_active,
      update_time: Date.now()
    }

    // 如果提供了视口信息，一并更新
    if (viewport) {
      updateData.viewport = viewport
    }
    if (user_location) {
      updateData.user_location = user_location
    }

    await db.collection('user-viewport-subscriptions')
      .where({
        user_id: uid
      })
      .update(updateData)

    return { code: 0, msg: 'Status updated' }

  } catch (error) {
    console.error('setActiveStatus error:', error)
    return { code: -1, msg: error.message }
  }
}
