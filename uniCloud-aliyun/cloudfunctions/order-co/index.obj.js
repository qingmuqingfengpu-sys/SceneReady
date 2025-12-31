const uniIdCommon = require('uni-id-common')
const db = uniCloud.database()
const dbCmd = db.command

/**
 * 数据校验 - 模块级函数
 * @param {Object} data 订单数据
 * @returns {Object} 校验结果
 */
function validateOrderData(data) {
  // 必填字段校验
  if (!data.people_needed || data.people_needed < 1) {
    return { success: false, message: '需要人数至少为1' }
  }

  if (!data.meeting_location_name) {
    return { success: false, message: '请选择集合地点' }
  }

  if (!data.meeting_location || !data.meeting_location.coordinates) {
    return { success: false, message: '集合地点坐标无效' }
  }

  if (!data.meeting_time) {
    return { success: false, message: '请选择集合时间' }
  }

  // 集合时间必须晚于当前时间
  const meetingTime = new Date(data.meeting_time).getTime()
  if (meetingTime <= Date.now()) {
    return { success: false, message: '集合时间必须晚于当前时间' }
  }

  // 计费方式校验
  if (!['daily', 'hourly'].includes(data.price_type)) {
    return { success: false, message: '计费方式无效' }
  }

  // 金额校验
  if (!data.price_amount || data.price_amount <= 0) {
    return { success: false, message: '金额必须大于0' }
  }

  // 身高范围校验
  if (data.height_min && data.height_max) {
    if (data.height_min > data.height_max) {
      return { success: false, message: '最低身高不能大于最高身高' }
    }
  }

  return { success: true }
}

/**
 * 计算两点间距离(米) - 模块级函数
 * @param {Number} lat1 纬度1
 * @param {Number} lng1 经度1
 * @param {Number} lat2 纬度2
 * @param {Number} lng2 经度2
 * @returns {Number} 距离(米)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000 // 地球半径(米)
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 检查演员是否符合订单要求 - 模块级函数
 * @param {String} actorId 演员ID
 * @param {Object} order 订单信息
 * @returns {Object} 匹配结果
 */
async function checkActorMatch(actorId, order) {
  try {
    const actorRes = await db.collection('uni-id-users')
      .doc(actorId)
      .field({ gender: true, height: true, body_type: true, skills: true })
      .get()

    if (!actorRes.data || actorRes.data.length === 0) {
      return { match: false, reason: '演员信息不存在' }
    }

    const actor = actorRes.data[0]

    // 性别要求检查
    if (order.gender_requirement && order.gender_requirement !== 0) {
      if (actor.gender && actor.gender !== order.gender_requirement) {
        return { match: false, reason: '性别不符合要求' }
      }
    }

    // 身高要求检查
    if (actor.height) {
      if (order.height_min && order.height_min > 0 && actor.height < order.height_min) {
        return { match: false, reason: '身高不符合最低要求' }
      }
      if (order.height_max && order.height_max > 0 && actor.height > order.height_max) {
        return { match: false, reason: '身高超过最高要求' }
      }
    }

    // 体型要求检查
    if (order.body_type && order.body_type.length > 0 && actor.body_type) {
      if (!order.body_type.includes(actor.body_type)) {
        return { match: false, reason: '体型不符合要求' }
      }
    }

    return { match: true }

  } catch (error) {
    console.error('检查演员匹配失败:', error)
    return { match: true } // 出错时默认允许
  }
}

/**
 * 通知附近演员 (推送逻辑) - 模块级函数
 * @param {String} orderId 订单ID
 * @param {Object} orderData 订单数据
 */
async function notifyNearbyActors(orderId, orderData) {
  try {
    const NOTIFY_RADIUS = 5000 // 5公里范围
    const TOP_ACTOR_THRESHOLD = 130 // 高信用演员阈值

    // 获取订单集合地点
    const orderLocation = orderData.meeting_location
    if (!orderLocation || !orderLocation.coordinates) {
      console.log('[Notify] 订单无位置信息，跳过推送')
      return
    }

    const [longitude, latitude] = orderLocation.coordinates

    // 1. 基于地理位置筛选附近演员
    let nearbyActors = []

    try {
      // 尝试使用地理位置查询
      const geoRes = await db.collection('uni-id-users')
        .aggregate()
        .geoNear({
          near: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          distanceField: 'distance',
          maxDistance: NOTIFY_RADIUS,
          spherical: true,
          query: {
            user_role: 2,
            credit_score_actor: dbCmd.gte(90)
          }
        })
        .project({
          _id: 1,
          nickname: 1,
          credit_score_actor: 1,
          push_client_id: 1,
          distance: 1
        })
        .limit(100)
        .end()

      nearbyActors = geoRes.data || []
      console.log('[Notify] GeoNear查询到 ' + nearbyActors.length + ' 名附近演员')
    } catch (geoError) {
      // GeoNear不可用，使用普通查询
      console.log('[Notify] GeoNear不可用，使用普通查询:', geoError.message)

      const actorsRes = await db.collection('uni-id-users')
        .where({
          user_role: 2,
          credit_score_actor: dbCmd.gte(90)
        })
        .field({
          _id: true,
          nickname: true,
          credit_score_actor: true,
          push_client_id: true,
          location: true
        })
        .limit(200)
        .get()

      // 手动计算距离并筛选
      nearbyActors = (actorsRes.data || []).filter(function(actor) {
        if (!actor.location || !actor.location.coordinates) return false
        const actorLng = actor.location.coordinates[0]
        const actorLat = actor.location.coordinates[1]
        const dist = calculateDistance(latitude, longitude, actorLat, actorLng)
        actor.distance = dist
        return dist <= NOTIFY_RADIUS
      })

      console.log('[Notify] 普通查询筛选出 ' + nearbyActors.length + ' 名附近演员')
    }

    if (nearbyActors.length === 0) {
      console.log('[Notify] 附近无可通知演员')
      return
    }

    // 2. 按信用分分组（高信用演员优先推送）
    const topActors = nearbyActors.filter(function(a) { return a.credit_score_actor >= TOP_ACTOR_THRESHOLD })
    const normalActors = nearbyActors.filter(function(a) { return a.credit_score_actor < TOP_ACTOR_THRESHOLD })

    // 3. 构建推送消息
    const priceYuan = (orderData.price_amount / 100).toFixed(0)
    const pushPayload = {
      title: '新订单通知',
      content: orderData.meeting_location_name + ' | ' + priceYuan + '元/' + (orderData.price_type === 'daily' ? '天' : '时'),
      payload: {
        type: 'new_order',
        order_id: orderId,
        order_type: orderData.order_type
      }
    }

    // 4. 记录推送日志
    console.log('[Notify] ========== 推送通知详情 ==========')
    console.log('[Notify] 订单ID: ' + orderId)
    console.log('[Notify] 订单位置: ' + orderData.meeting_location_name + ' (' + longitude + ', ' + latitude + ')')
    console.log('[Notify] 高信用演员(>=130分): ' + topActors.length + ' 人')
    console.log('[Notify] 普通演员: ' + normalActors.length + ' 人')
    console.log('[Notify] 推送内容: ' + pushPayload.content)

    // 提取推送目标用户ID列表
    const topActorIds = topActors.map(function(a) { return a._id })
    const normalActorIds = normalActors.map(function(a) { return a._id })

    console.log('[Notify] 高信用演员IDs: ' + topActorIds.slice(0, 5).join(', ') + (topActorIds.length > 5 ? '...' : ''))
    console.log('[Notify] 普通演员IDs: ' + normalActorIds.slice(0, 5).join(', ') + (normalActorIds.length > 5 ? '...' : ''))
    console.log('[Notify] =====================================')

    // 返回统计信息（供调试）
    return {
      total: nearbyActors.length,
      top_actors: topActors.length,
      normal_actors: normalActors.length,
      top_actor_ids: topActorIds,
      normal_actor_ids: normalActorIds
    }

  } catch (error) {
    console.error('[Notify] 推送通知失败:', error)
  }
}

module.exports = {
  _before: async function () {
    // 跳过测试方法的登录检查
    if (this.getMethodName() === 'testToken') {
      console.log('skip testToken login check')
      return
    }

    // 获取客户端传来的token字符串
    const clientInfo = this.getClientInfo()
    const tokenStr = this.getUniIdToken()

    console.log('order-co _before:', {
      method: this.getMethodName(),
      hasToken: !!tokenStr,
      clientPlatform: clientInfo.platform
    })

    // 使用 uni-id-common 验证 token
    if (tokenStr) {
      const uniID = uniIdCommon.createInstance({
        clientInfo
      })
      const payload = await uniID.checkToken(tokenStr)

      console.log('checkToken result:', {
        code: payload.code,
        uid: payload.uid,
        errMsg: payload.errMsg
      })

      if (payload.code === 0 && payload.uid) {
        // token 有效，保存用户信息供后续方法使用
        this.authInfo = {
          uid: payload.uid,
          tokenExpired: payload.tokenExpired
        }
      }
    }
  },

  /**
   * 发布订单
   * @param {Object} data 订单数据
   * @returns {Object} 返回结果
   */
  async add(data) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        console.warn('add: user not logged in')
        return {
          code: 401,
          message: '请先登录'
        }
      }

      // 1. 检查用户角色
      const userRes = await db.collection('uni-id-users')
        .doc(userId)
        .field({ user_role: true, auth_status: true })
        .get()

      if (!userRes.data || userRes.data.length === 0) {
        return {
          code: 401,
          message: '用户不存在'
        }
      }

      const user = userRes.data[0]

      // 检查是否为剧组角色
      if (user.user_role !== 1) {
        return {
          code: 403,
          message: '仅剧组用户可以发布需求'
        }
      }

      // 检查认证状态 - 暂时跳过企业认证检查
      // if (user.auth_status !== 2) {
      //   return {
      //     code: 403,
      //     message: '请先完成企业认证'
      //   }
      // }

      // 2. 数据校验
      const validation = validateOrderData(data)
      if (!validation.success) {
        return {
          code: 400,
          message: validation.message
        }
      }

      // 3. 计算订单类型 (immediate / reservation)
      const meetingTime = new Date(data.meeting_time).getTime()
      const now = Date.now()
      const diffHours = (meetingTime - now) / (1000 * 60 * 60)

      let orderType = 'reservation'
      if (diffHours < 2) {
        orderType = 'immediate'
      }

      // 4. 准备订单数据
      const orderData = {
        publisher_id: userId,
        receiver_id: null,
        order_status: 0, // 待接单
        create_time: Date.now(),
        update_time: Date.now(),

        // 基本信息
        people_needed: data.people_needed,
        role_description: data.role_description || '',

        // 集合信息
        meeting_location_name: data.meeting_location_name,
        meeting_location: data.meeting_location,
        meeting_time: meetingTime,

        // 筛选条件
        gender_requirement: data.gender_requirement || 0,
        height_min: data.height_min || 0,
        height_max: data.height_max || 0,
        body_type: data.body_type || [],
        special_skills: data.special_skills || [],

        // 福利与定价
        welfare_tags: data.welfare_tags || [],
        price_type: data.price_type,
        price_amount: data.price_amount,

        // 订单类型
        order_type: orderType,

        // 备注
        remark: data.remark || ''
      }

      // 5. 存入数据库
      const addRes = await db.collection('orders').add(orderData)

      if (!addRes.id) {
        return {
          code: 500,
          message: '订单创建失败'
        }
      }

      // 6. 如果是即时单,触发推送通知给附近演员
      if (orderType === 'immediate') {
        // TODO: 调用推送服务
        notifyNearbyActors(addRes.id, orderData)
      }

      return {
        code: 0,
        message: '发布成功',
        data: {
          order_id: addRes.id,
          order_type: orderType
        }
      }

    } catch (error) {
      console.error('发布订单失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误,请稍后重试'
      }
    }
  },

  /**
   * 测试云对象token获取 - 临时调试方法
   */
  async testToken() {
    const tokenStr = this.getUniIdToken()
    const cloudInfo = this.getCloudInfo()
    const userId = this.authInfo && this.authInfo.uid

    return {
      code: 0,
      message: 'test success',
      data: {
        hasToken: !!tokenStr,
        uid: userId,
        authInfo: this.authInfo || null,
        cloudInfo: cloudInfo,
        timestamp: Date.now()
      }
    }
  },

  /**
   * 获取订单详情
   * @param {String} orderId 订单ID
   * @returns {Object} 订单详情
   */
  async getDetail(orderId) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      if (!orderRes.data || orderRes.data.length === 0) {
        return {
          code: 404,
          message: '订单不存在'
        }
      }

      const order = orderRes.data[0]

      // 权限检查:只有发布者和接单者可以查看详情
      if (order.publisher_id !== userId && order.receiver_id !== userId) {
        return {
          code: 403,
          message: '无权查看此订单'
        }
      }

      // 转换金额单位 (分 -> 元)
      order.price_amount_yuan = (order.price_amount / 100).toFixed(2)

      return {
        code: 0,
        data: order
      }

    } catch (error) {
      console.error('获取订单详情失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 获取我的订单列表 (剧组端)
   * @param {Object} params 查询参数
   * @returns {Object} 订单列表
   */
  async getMyOrders(params = {}) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      const { status, page = 1, pageSize = 20 } = params

      let whereCondition = {
        publisher_id: userId
      }

      // 按状态筛选
      if (typeof status !== 'undefined' && status !== null) {
        whereCondition.order_status = status
      }

      const orderRes = await db.collection('orders')
        .where(whereCondition)
        .orderBy('create_time', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()

      // 转换金额单位
      const orders = orderRes.data.map(order => {
        order.price_amount_yuan = (order.price_amount / 100).toFixed(2)
        return order
      })

      // 获取总数
      const countRes = await db.collection('orders')
        .where(whereCondition)
        .count()

      return {
        code: 0,
        data: {
          list: orders,
          total: countRes.total,
          page,
          pageSize
        }
      }

    } catch (error) {
      console.error('获取订单列表失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 抢单 - 演员接单
   * @param {String} orderId 订单ID
   * @returns {Object} 操作结果
   */
  async grab(orderId) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      // 1. 检查用户角色(必须是演员)
      const userRes = await db.collection('uni-id-users')
        .doc(userId)
        .field({ user_role: true, auth_status: true, credit_score_actor: true })
        .get()

      if (!userRes.data || userRes.data.length === 0) {
        return {
          code: 404,
          message: '用户不存在'
        }
      }

      const user = userRes.data[0]

      if (user.user_role !== 2) {
        return {
          code: 403,
          message: '仅演员可以抢单'
        }
      }

      // 检查认证状态 - 暂时跳过演员认证检查
      // if (user.auth_status !== 2) {
      //   return {
      //     code: 403,
      //     message: '请先完成身份认证'
      //   }
      // }

      // 2. 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      // 兼容处理：data可能是数组或单个对象
      const order = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data
      if (!order) {
        return {
          code: 404,
          message: '订单不存在'
        }
      }

      // 3. 检查订单状态(必须是待接单或招募中)
      if (order.order_status !== 0) {
        return {
          code: 400,
          message: '该订单已满员或已取消'
        }
      }

      // 4. 检查是否是自己发布的订单
      if (order.publisher_id === userId) {
        return {
          code: 400,
          message: '不能接自己发布的订单'
        }
      }

      // 5. 检查是否已经抢过这个单
      const receivers = order.receivers || []
      if (receivers.includes(userId)) {
        return {
          code: 400,
          message: '您已经接过这个单了'
        }
      }

      // 6. 检查是否已满员
      const peopleNeeded = order.people_needed || 1
      if (receivers.length >= peopleNeeded) {
        return {
          code: 400,
          message: '该订单已满员'
        }
      }

      // 7. 检查演员是否符合要求
      const matchResult = await checkActorMatch(userId, order)
      if (!matchResult.match) {
        return {
          code: 400,
          message: matchResult.reason || '您不符合该订单的要求'
        }
      }

      // 8. 更新订单状态(使用事务保证原子性)
      const transaction = await db.startTransaction()
      try {
        // 再次检查订单状态(防止并发抢单)
        const checkRes = await transaction.collection('orders')
          .doc(orderId)
          .get()

        // 兼容处理：data可能是数组或单个对象
        const checkOrder = Array.isArray(checkRes.data) ? checkRes.data[0] : checkRes.data
        if (!checkOrder || checkOrder.order_status !== 0) {
          await transaction.rollback()
          return {
            code: 400,
            message: '手慢了,订单状态已变更'
          }
        }

        // 再次检查是否已满员
        const currentReceivers = checkOrder.receivers || []
        const neededCount = checkOrder.people_needed || 1
        if (currentReceivers.length >= neededCount) {
          await transaction.rollback()
          return {
            code: 400,
            message: '手慢了,订单已满员'
          }
        }

        // 再次检查是否已抢过
        if (currentReceivers.includes(userId)) {
          await transaction.rollback()
          return {
            code: 400,
            message: '您已经接过这个单了'
          }
        }

        // 添加到接单者列表
        const newReceivers = [...currentReceivers, userId]
        const isFull = newReceivers.length >= neededCount

        // 更新订单
        const updateData = {
          receivers: newReceivers,
          update_time: Date.now()
        }

        // 如果满员，更新状态为进行中
        if (isFull) {
          updateData.order_status = 1 // 进行中
          updateData.grab_time = Date.now()
        }

        // 保持 receiver_id 兼容（存储第一个接单者）
        if (newReceivers.length === 1) {
          updateData.receiver_id = userId
        }

        await transaction.collection('orders')
          .doc(orderId)
          .update(updateData)

        await transaction.commit()

        return {
          code: 0,
          message: isFull ? '抢单成功,订单已满员' : '抢单成功,还需' + (neededCount - newReceivers.length) + '人',
          data: {
            order_id: orderId,
            current_count: newReceivers.length,
            people_needed: neededCount,
            is_full: isFull
          }
        }

      } catch (transError) {
        await transaction.rollback()
        throw transError
      }

    } catch (error) {
      console.error('抢单失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误,请稍后重试'
      }
    }
  },

  /**
   * 获取附近演员 - 剧组端
   * @param {Object} params 查询参数
   * @returns {Object} 演员列表
   */
  async getNearbyActors(params = {}) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      // 检查用户角色(必须是剧组)
      const userRes = await db.collection('uni-id-users')
        .doc(userId)
        .field({ user_role: true })
        .get()

      if (!userRes.data || userRes.data.length === 0) {
        return {
          code: 404,
          message: '用户不存在'
        }
      }

      const user = userRes.data[0]
      if (user.user_role !== 1) {
        return {
          code: 403,
          message: '仅剧组用户可以查看附近演员'
        }
      }

      const {
        longitude,
        latitude,
        maxDistance = 5000, // 默认5km
        gender, // 性别筛选: 1-男, 2-女
        heightMin,
        heightMax,
        bodyType, // 体型筛选
        skills = [], // 特长筛选
        page = 1,
        pageSize = 20
      } = params

      // 构建查询条件
      let whereCondition = {
        user_role: 2, // 演员
        auth_status: 2, // 已认证
        online_status: 1 // 在线
      }

      // 性别筛选
      if (gender && gender !== 0) {
        whereCondition.gender = gender
      }

      // 身高筛选
      if (heightMin && heightMin > 0) {
        whereCondition.height = whereCondition.height || {}
        whereCondition.height = dbCmd.gte(heightMin)
      }
      if (heightMax && heightMax > 0) {
        if (whereCondition.height) {
          whereCondition.height = dbCmd.and([
            dbCmd.gte(heightMin || 0),
            dbCmd.lte(heightMax)
          ])
        } else {
          whereCondition.height = dbCmd.lte(heightMax)
        }
      }

      // 体型筛选
      if (bodyType) {
        whereCondition.body_type = bodyType
      }

      // 特长筛选
      if (skills && skills.length > 0) {
        whereCondition.skills = dbCmd.all(skills)
      }

      let actors = []
      let total = 0

      // 如果有位置信息，使用地理位置查询
      if (longitude && latitude) {
        // 使用聚合查询进行地理位置排序
        const aggregateRes = await db.collection('uni-id-users')
          .aggregate()
          .geoNear({
            near: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            distanceField: 'distance',
            maxDistance: maxDistance,
            spherical: true,
            query: whereCondition
          })
          .project({
            _id: 1,
            nickname: 1,
            avatar: 1,
            gender: 1,
            height: 1,
            body_type: 1,
            skills: 1,
            video_card_url: 1,
            credit_score_actor: 1,
            current_location: 1,
            distance: 1,
            profile_text: 1
          })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .end()

        actors = aggregateRes.data || []

        // 获取总数(简化处理)
        const countRes = await db.collection('uni-id-users')
          .where(whereCondition)
          .count()
        total = countRes.total

      } else {
        // 没有位置信息，按信用分排序
        const actorRes = await db.collection('uni-id-users')
          .where(whereCondition)
          .field({
            _id: true,
            nickname: true,
            avatar: true,
            gender: true,
            height: true,
            body_type: true,
            skills: true,
            video_card_url: true,
            credit_score_actor: true,
            current_location: true,
            profile_text: true
          })
          .orderBy('credit_score_actor', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        actors = actorRes.data || []

        const countRes = await db.collection('uni-id-users')
          .where(whereCondition)
          .count()
        total = countRes.total
      }

      // 处理返回数据
      const list = actors.map(actor => ({
        _id: actor._id,
        nickname: actor.nickname || '未知演员',
        avatar: actor.avatar || '',
        gender: actor.gender,
        gender_text: actor.gender === 1 ? '男' : (actor.gender === 2 ? '女' : '未设置'),
        height: actor.height,
        body_type: actor.body_type,
        skills: actor.skills || [],
        video_card_url: actor.video_card_url || '',
        credit_score: actor.credit_score_actor || 100,
        distance: actor.distance,
        distance_km: actor.distance ? (actor.distance / 1000).toFixed(1) : null,
        location: actor.current_location,
        profile_text: actor.profile_text || ''
      }))

      return {
        code: 0,
        data: {
          list,
          total,
          page,
          pageSize
        }
      }

    } catch (error) {
      console.error('获取附近演员失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 更新演员位置 - 演员端
   * @param {Object} location 位置信息
   * @returns {Object} 操作结果
   */
  async updateActorLocation(location) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return {
          code: 401,
          message: '请先登录'
        }
      }
      const { longitude, latitude } = location

      if (!longitude || !latitude) {
        return {
          code: 400,
          message: '位置信息不完整'
        }
      }

      // 更新用户位置
      await db.collection('uni-id-users')
        .doc(userId)
        .update({
          current_location: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          location_update_time: Date.now(),
          online_status: 1 // 设为在线
        })

      return {
        code: 0,
        message: '位置更新成功'
      }

    } catch (error) {
      console.error('更新位置失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 获取可接订单列表 - 演员端
   * @param {Object} params 查询参数
   * @returns {Object} 订单列表
   */
  async getAvailableJobs(params = {}) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return {
          code: 401,
          message: '请先登录'
        }
      }
      const {
        longitude,
        latitude,
        maxDistance = 10000, // 默认10km
        minPrice,
        maxPrice,
        welfare = [],
        orderType, // immediate/reservation
        dateFilter, // today/tomorrow
        page = 1,
        pageSize = 20
      } = params

      // 构建查询条件
      let whereCondition = {
        order_status: 0, // 待接单
        receiver_id: null // 未被接单
      }

      // 价格筛选
      if (minPrice !== undefined && minPrice > 0) {
        whereCondition.price_amount = whereCondition.price_amount || {}
        whereCondition.price_amount = dbCmd.gte(minPrice * 100) // 转为分
      }
      if (maxPrice !== undefined && maxPrice > 0) {
        if (whereCondition.price_amount) {
          whereCondition.price_amount = dbCmd.and([
            dbCmd.gte(minPrice ? minPrice * 100 : 0),
            dbCmd.lte(maxPrice * 100)
          ])
        } else {
          whereCondition.price_amount = dbCmd.lte(maxPrice * 100)
        }
      }

      // 福利筛选
      if (welfare && welfare.length > 0) {
        whereCondition.welfare_tags = dbCmd.all(welfare)
      }

      // 订单类型筛选
      if (orderType) {
        whereCondition.order_type = orderType
      }

      // 日期筛选
      if (dateFilter) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayStart = today.getTime()
        const todayEnd = todayStart + 24 * 60 * 60 * 1000
        const tomorrowEnd = todayEnd + 24 * 60 * 60 * 1000

        if (dateFilter === 'today') {
          whereCondition.meeting_time = dbCmd.and([
            dbCmd.gte(todayStart),
            dbCmd.lt(todayEnd)
          ])
        } else if (dateFilter === 'tomorrow') {
          whereCondition.meeting_time = dbCmd.and([
            dbCmd.gte(todayEnd),
            dbCmd.lt(tomorrowEnd)
          ])
        }
      }

      let orders = []
      let total = 0

      // 如果有位置信息，使用地理位置查询
      if (longitude && latitude) {
        // 使用聚合查询进行地理位置排序
        const aggregateRes = await db.collection('orders')
          .aggregate()
          .geoNear({
            near: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            distanceField: 'distance',
            maxDistance: maxDistance,
            spherical: true,
            query: whereCondition
          })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .end()

        orders = aggregateRes.data || []

        // 获取总数
        const countRes = await db.collection('orders')
          .where(whereCondition)
          .count()
        total = countRes.total

      } else {
        // 没有位置信息，按时间排序
        const orderRes = await db.collection('orders')
          .where(whereCondition)
          .orderBy('create_time', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        orders = orderRes.data || []

        const countRes = await db.collection('orders')
          .where(whereCondition)
          .count()
        total = countRes.total
      }

      // 获取发布者信息
      const publisherIds = [...new Set(orders.map(o => o.publisher_id))]
      let publisherMap = {}

      if (publisherIds.length > 0) {
        const publisherRes = await db.collection('uni-id-users')
          .where({
            _id: dbCmd.in(publisherIds)
          })
          .field({
            _id: true,
            nickname: true,
            avatar: true,
            credit_score_crew: true
          })
          .get()

        publisherRes.data.forEach(p => {
          publisherMap[p._id] = p
        })
      }

      // 处理返回数据
      const list = orders.map(order => {
        const publisher = publisherMap[order.publisher_id] || {}
        return {
          ...order,
          price_amount_yuan: (order.price_amount / 100).toFixed(2),
          distance_km: order.distance ? (order.distance / 1000).toFixed(1) : null,
          publisher_info: {
            nickname: publisher.nickname || '未知剧组',
            avatar: publisher.avatar || '',
            credit_score: publisher.credit_score_crew || 100
          }
        }
      })

      return {
        code: 0,
        data: {
          list,
          total,
          page,
          pageSize
        }
      }

    } catch (error) {
      console.error('获取可接订单失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 取消订单
   * @param {String} orderId 订单ID
   * @param {String} reason 取消原因
   * @returns {Object} 操作结果
   */
  async cancel(orderId, reason = '') {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      // 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      if (!orderRes.data || orderRes.data.length === 0) {
        return {
          code: 404,
          message: '订单不存在'
        }
      }

      const order = orderRes.data[0]

      // 权限检查
      if (order.publisher_id !== userId) {
        return {
          code: 403,
          message: '无权取消此订单'
        }
      }

      // 只有待接单和进行中的订单可以取消
      if (![0, 1].includes(order.order_status)) {
        return {
          code: 400,
          message: '当前状态不允许取消'
        }
      }

      // 更新订单状态
      await db.collection('orders')
        .doc(orderId)
        .update({
          order_status: 4, // 已取消
          cancel_time: Date.now(),
          cancel_by: userId,
          cancel_reason: reason,
          update_time: Date.now()
        })

      // 如果已有人接单,扣除剧组信用分
      if (order.receiver_id) {
        await db.collection('uni-id-users')
          .doc(userId)
          .update({
            credit_score_crew: dbCmd.inc(-5) // 扣5分
          })
      }

      return {
        code: 0,
        message: '订单已取消'
      }

    } catch (error) {
      console.error('取消订单失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 提交轨迹 - 演员端
   * @param {String} orderId 订单ID
   * @param {Object} location 位置信息
   * @returns {Object} 操作结果
   */
  async submitTrack(orderId, location) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return {
          code: 401,
          message: '请先登录'
        }
      }
      const { longitude, latitude, accuracy, altitude, speed, bearing } = location

      if (!longitude || !latitude) {
        return {
          code: 400,
          message: '位置信息不完整'
        }
      }

      // 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      if (!orderRes.data || orderRes.data.length === 0) {
        return {
          code: 404,
          message: '订单不存在'
        }
      }

      const order = orderRes.data[0]

      // 权限检查(必须是该订单的演员)
      if (order.receiver_id !== userId) {
        return {
          code: 403,
          message: '无权提交此订单轨迹'
        }
      }

      // 只有进行中的订单可以提交轨迹
      if (order.order_status !== 1) {
        return {
          code: 400,
          message: '当前订单状态不允许提交轨迹'
        }
      }

      // 计算到集合地点的距离
      let distanceToDestination = null
      if (order.meeting_location && order.meeting_location.coordinates) {
        distanceToDestination = calculateDistance(
          latitude,
          longitude,
          order.meeting_location.coordinates[1],
          order.meeting_location.coordinates[0]
        )
      }

      // 插入轨迹记录
      const trackData = {
        order_id: orderId,
        user_id: userId,
        location: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        },
        report_time: Date.now(),
        accuracy: accuracy || null,
        altitude: altitude || null,
        speed: speed || null,
        bearing: bearing || null,
        track_type: 'auto',
        distance_to_destination: distanceToDestination
      }

      await db.collection('order_tracks').add(trackData)

      // 同时更新用户位置
      await db.collection('uni-id-users')
        .doc(userId)
        .update({
          current_location: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          location_update_time: Date.now()
        })

      return {
        code: 0,
        message: '轨迹提交成功',
        data: {
          distance_to_destination: distanceToDestination,
          in_fence: distanceToDestination !== null && distanceToDestination <= 100
        }
      }

    } catch (error) {
      console.error('提交轨迹失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 获取订单轨迹
   * @param {String} orderId 订单ID
   * @returns {Object} 轨迹列表
   */
  async getTracks(orderId) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      // 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      if (!orderRes.data || orderRes.data.length === 0) {
        return {
          code: 404,
          message: '订单不存在'
        }
      }

      const order = orderRes.data[0]

      // 权限检查(只有发布者和接单者可以查看轨迹)
      if (order.publisher_id !== userId && order.receiver_id !== userId) {
        return {
          code: 403,
          message: '无权查看此订单轨迹'
        }
      }

      // 查询轨迹
      const tracksRes = await db.collection('order_tracks')
        .where({
          order_id: orderId
        })
        .orderBy('report_time', 'asc')
        .limit(1000)
        .get()

      const tracks = tracksRes.data || []

      // 获取最新位置
      const latestTrack = tracks.length > 0 ? tracks[tracks.length - 1] : null

      return {
        code: 0,
        data: {
          tracks: tracks.map(t => ({
            location: t.location,
            report_time: t.report_time,
            distance_to_destination: t.distance_to_destination,
            track_type: t.track_type
          })),
          latest: latestTrack ? {
            location: latestTrack.location,
            report_time: latestTrack.report_time,
            distance_to_destination: latestTrack.distance_to_destination
          } : null,
          meeting_location: order.meeting_location,
          total: tracks.length
        }
      }

    } catch (error) {
      console.error('获取轨迹失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 打卡签到 - 演员端
   * @param {String} orderId 订单ID
   * @param {Object} location 位置信息
   * @returns {Object} 操作结果
   */
  async checkIn(orderId, location) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return {
          code: 401,
          message: '请先登录'
        }
      }
      const { longitude, latitude } = location

      if (!longitude || !latitude) {
        return {
          code: 400,
          message: '位置信息不完整'
        }
      }

      // 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      if (!orderRes.data || orderRes.data.length === 0) {
        return {
          code: 404,
          message: '订单不存在'
        }
      }

      const order = orderRes.data[0]

      // 权限检查
      if (order.receiver_id !== userId) {
        return {
          code: 403,
          message: '无权为此订单打卡'
        }
      }

      // 订单状态检查
      if (order.order_status !== 1) {
        return {
          code: 400,
          message: '当前订单状态不允许打卡'
        }
      }

      // 检查是否已打卡
      if (order.arrive_time) {
        return {
          code: 400,
          message: '已经打卡过了'
        }
      }

      // 计算到集合地点的距离
      if (!order.meeting_location || !order.meeting_location.coordinates) {
        return {
          code: 400,
          message: '订单集合地点信息不完整'
        }
      }

      const distance = calculateDistance(
        latitude,
        longitude,
        order.meeting_location.coordinates[1],
        order.meeting_location.coordinates[0]
      )

      // 检查是否在电子围栏内(100米)
      const FENCE_RADIUS = 100
      if (distance > FENCE_RADIUS) {
        return {
          code: 400,
          message: `距离集合地点还有${Math.round(distance)}米,请靠近后再打卡`,
          data: {
            distance: Math.round(distance),
            fence_radius: FENCE_RADIUS
          }
        }
      }

      // 记录打卡
      const now = Date.now()
      await db.collection('orders')
        .doc(orderId)
        .update({
          arrive_time: now,
          update_time: now
        })

      // 记录打卡轨迹
      await db.collection('order_tracks').add({
        order_id: orderId,
        user_id: userId,
        location: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        },
        report_time: now,
        track_type: 'checkpoint',
        distance_to_destination: distance
      })

      // 检查是否迟到
      const isLate = now > order.meeting_time
      const lateMinutes = isLate ? Math.floor((now - order.meeting_time) / 60000) : 0

      // 如果迟到,扣除演员信用分
      if (isLate && lateMinutes > 5) {
        const deductPoints = Math.min(Math.floor(lateMinutes / 5), 10) // 每迟到5分钟扣1分,最多扣10分
        await db.collection('uni-id-users')
          .doc(userId)
          .update({
            credit_score_actor: dbCmd.inc(-deductPoints)
          })
      }

      return {
        code: 0,
        message: isLate ? `打卡成功,迟到${lateMinutes}分钟` : '打卡成功',
        data: {
          arrive_time: now,
          is_late: isLate,
          late_minutes: lateMinutes,
          distance: Math.round(distance)
        }
      }

    } catch (error) {
      console.error('打卡失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 更新订单状态
   * @param {String} orderId 订单ID
   * @param {Number} status 新状态
   * @returns {Object} 操作结果
   */
  async updateOrderStatus(orderId, status) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      // 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      if (!orderRes.data || orderRes.data.length === 0) {
        return {
          code: 404,
          message: '订单不存在'
        }
      }

      const order = orderRes.data[0]

      // 权限检查
      if (order.publisher_id !== userId && order.receiver_id !== userId) {
        return {
          code: 403,
          message: '无权修改此订单状态'
        }
      }

      // 状态流转校验
      const validTransitions = {
        0: [1, 4], // 待接单 -> 进行中/已取消
        1: [2, 4], // 进行中 -> 待支付/已取消
        2: [3],    // 待支付 -> 已完成
        3: [],     // 已完成 -> 无
        4: []      // 已取消 -> 无
      }

      if (!validTransitions[order.order_status].includes(status)) {
        return {
          code: 400,
          message: '无效的状态变更'
        }
      }

      // 更新订单状态
      const updateData = {
        order_status: status,
        update_time: Date.now()
      }

      if (status === 3) {
        updateData.finish_time = Date.now()
      }

      await db.collection('orders')
        .doc(orderId)
        .update(updateData)

      return {
        code: 0,
        message: '状态更新成功'
      }

    } catch (error) {
      console.error('更新订单状态失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 完成订单
   * @param {String} orderId 订单ID
   * @returns {Object} 操作结果
   */
  async completeOrder(orderId) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      // 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      if (!orderRes.data || orderRes.data.length === 0) {
        return {
          code: 404,
          message: '订单不存在'
        }
      }

      const order = orderRes.data[0]

      // 权限检查(只有剧组可以确认完成)
      if (order.publisher_id !== userId) {
        return {
          code: 403,
          message: '仅剧组方可以确认订单完成'
        }
      }

      // 状态检查(必须是进行中或待支付)
      if (![1, 2].includes(order.order_status)) {
        return {
          code: 400,
          message: '当前订单状态不允许完成'
        }
      }

      // 检查演员是否已打卡
      if (!order.arrive_time) {
        return {
          code: 400,
          message: '演员尚未打卡,无法完成订单'
        }
      }

      const now = Date.now()

      // 更新订单状态
      await db.collection('orders')
        .doc(orderId)
        .update({
          order_status: 3, // 已完成
          finish_time: now,
          update_time: now
        })

      // 给演员加信用分
      if (order.receiver_id) {
        await db.collection('uni-id-users')
          .doc(order.receiver_id)
          .update({
            credit_score_actor: dbCmd.inc(5) // 完成订单加5分
          })
      }

      // 给剧组加信用分
      await db.collection('uni-id-users')
        .doc(userId)
        .update({
          credit_score_crew: dbCmd.inc(2) // 剧组完成订单加2分
        })

      return {
        code: 0,
        message: '订单已完成',
        data: {
          finish_time: now
        }
      }

    } catch (error) {
      console.error('完成订单失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 评价订单
   * @param {String} orderId 订单ID
   * @param {Object} rating 评价信息
   * @returns {Object} 操作结果
   */
  async rateOrder(orderId, rating) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return {
          code: 401,
          message: '请先登录'
        }
      }
      const { score, comment = '' } = rating

      // 评分校验
      if (!score || score < 1 || score > 5) {
        return {
          code: 400,
          message: '评分必须在1-5之间'
        }
      }

      // 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      if (!orderRes.data || orderRes.data.length === 0) {
        return {
          code: 404,
          message: '订单不存在'
        }
      }

      const order = orderRes.data[0]

      // 只有已完成的订单可以评价
      if (order.order_status !== 3) {
        return {
          code: 400,
          message: '只能评价已完成的订单'
        }
      }

      // 权限检查
      const isPublisher = order.publisher_id === userId
      const isReceiver = order.receiver_id === userId

      if (!isPublisher && !isReceiver) {
        return {
          code: 403,
          message: '无权评价此订单'
        }
      }

      const now = Date.now()
      const ratingData = {
        score: score,
        comment: comment,
        create_time: now
      }

      let updateData = {
        update_time: now
      }

      // 根据角色设置不同的评价字段
      if (isPublisher) {
        // 检查是否已评价
        if (order.publisher_rating && order.publisher_rating.score) {
          return {
            code: 400,
            message: '您已经评价过了'
          }
        }
        updateData.publisher_rating = ratingData

        // 更新演员的平均评分
        if (order.receiver_id) {
          // 简化处理:直接根据评分调整信用分
          const creditChange = score >= 4 ? 2 : (score <= 2 ? -2 : 0)
          if (creditChange !== 0) {
            await db.collection('uni-id-users')
              .doc(order.receiver_id)
              .update({
                credit_score_actor: dbCmd.inc(creditChange)
              })
          }
        }

      } else {
        // 检查是否已评价
        if (order.receiver_rating && order.receiver_rating.score) {
          return {
            code: 400,
            message: '您已经评价过了'
          }
        }
        updateData.receiver_rating = ratingData

        // 更新剧组的平均评分
        const creditChange = score >= 4 ? 2 : (score <= 2 ? -2 : 0)
        if (creditChange !== 0) {
          await db.collection('uni-id-users')
            .doc(order.publisher_id)
            .update({
              credit_score_crew: dbCmd.inc(creditChange)
            })
        }
      }

      await db.collection('orders')
        .doc(orderId)
        .update(updateData)

      return {
        code: 0,
        message: '评价成功'
      }

    } catch (error) {
      console.error('评价订单失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 获取演员的订单列表 - 演员端
   * @param {Object} params 查询参数
   * @returns {Object} 订单列表
   */
  async getActorOrders(params = {}) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return {
          code: 401,
          message: '请先登录'
        }
      }
      const { status, page = 1, pageSize = 20 } = params

      let whereCondition = {
        receiver_id: userId
      }

      // 按状态筛选
      if (typeof status !== 'undefined' && status !== null) {
        whereCondition.order_status = status
      }

      const orderRes = await db.collection('orders')
        .where(whereCondition)
        .orderBy('create_time', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()

      // 转换金额单位
      const orders = orderRes.data.map(order => {
        order.price_amount_yuan = (order.price_amount / 100).toFixed(2)
        return order
      })

      // 获取发布者信息
      const publisherIds = [...new Set(orders.map(o => o.publisher_id))]
      let publisherMap = {}

      if (publisherIds.length > 0) {
        const publisherRes = await db.collection('uni-id-users')
          .where({
            _id: dbCmd.in(publisherIds)
          })
          .field({
            _id: true,
            nickname: true,
            avatar: true,
            credit_score_crew: true
          })
          .get()

        publisherRes.data.forEach(p => {
          publisherMap[p._id] = p
        })
      }

      // 处理返回数据
      const list = orders.map(order => {
        const publisher = publisherMap[order.publisher_id] || {}
        return {
          ...order,
          publisher_info: {
            nickname: publisher.nickname || '未知剧组',
            avatar: publisher.avatar || '',
            credit_score: publisher.credit_score_crew || 100
          }
        }
      })

      // 获取总数
      const countRes = await db.collection('orders')
        .where(whereCondition)
        .count()

      return {
        code: 0,
        data: {
          list,
          total: countRes.total,
          page,
          pageSize
        }
      }

    } catch (error) {
      console.error('获取演员订单列表失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  }
}
