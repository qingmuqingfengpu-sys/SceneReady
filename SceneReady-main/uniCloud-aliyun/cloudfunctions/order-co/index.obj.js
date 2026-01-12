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

      // 检查用户在申请者列表中的状态
      const applicants = order.applicants || []
      const myApplication = applicants.find(a => a.actor_id === userId)
      const receivers = order.receivers || []
      const isReceiver = receivers.includes(userId)

      // 权限检查:发布者、接单者或申请者可以查看详情
      if (order.publisher_id !== userId && !isReceiver && !myApplication) {
        return {
          code: 403,
          message: '无权查看此订单'
        }
      }

      // 转换金额单位 (分 -> 元)
      order.price_amount_yuan = (order.price_amount / 100).toFixed(2)

      // 添加取消者类型标识
      if (order.order_status === 4 && order.cancel_by) {
        order.is_cancelled_by_crew = order.cancel_by === order.publisher_id
      }

      // 添加当前用户的申请状态(用于演员端显示)
      if (myApplication) {
        order.my_application_status = myApplication.status
        order.my_reject_reason = myApplication.reject_reason || ''
        order.my_apply_time = myApplication.apply_time
        order.my_review_time = myApplication.review_time
      } else if (isReceiver) {
        // 如果已经是接单者,状态为 approved
        order.my_application_status = 'approved'
      }

      // 添加当前演员的追踪状态(多人订单支持)
      const actorTracking = order.actor_tracking || {}
      const myTracking = actorTracking[userId]
      if (myTracking) {
        order.my_tracking = myTracking
        // 覆盖旧的全局字段，使用该演员自己的状态
        order.tracking_started = myTracking.tracking_started || false
        order.arrive_time = myTracking.arrive_time || null
      } else if (isReceiver) {
        // 兼容旧数据，如果没有actor_tracking但是是接单者
        order.my_tracking = {
          tracking_started: order.tracking_started || false,
          tracking_start_time: order.tracking_start_time || null,
          arrive_time: order.arrive_time || null,
          is_completed: order.order_status === 3
        }
      }

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
   * 申请订单 - 演员申请接单(多人审核模式)
   * @param {String} orderId 订单ID
   * @returns {Object} 操作结果
   */
  async apply(orderId) {
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
          message: '仅演员可以申请'
        }
      }

      // 2. 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      const order = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data
      if (!order) {
        return {
          code: 404,
          message: '订单不存在'
        }
      }

      // 3. 检查订单状态(必须是待接单或进行中)
      // 多人订单允许在进行中状态继续申请(未满员时)
      if (order.order_status !== 0 && order.order_status !== 1) {
        return {
          code: 400,
          message: '该订单已停止接受申请'
        }
      }

      // 4. 检查是否是自己发布的订单
      if (order.publisher_id === userId) {
        return {
          code: 400,
          message: '不能申请自己发布的订单'
        }
      }

      // 5. 检查是否已经申请过
      const applicants = order.applicants || []
      const existingApplicant = applicants.find(a => a.actor_id === userId)
      if (existingApplicant) {
        if (existingApplicant.status === 'pending') {
          return { code: 400, message: '您已申请过该订单，请等待审核' }
        } else if (existingApplicant.status === 'approved') {
          return { code: 400, message: '您的申请已通过' }
        } else if (existingApplicant.status === 'rejected') {
          return { code: 400, message: '您的申请已被拒绝' }
        }
      }

      // 6. 允许超过需求人数的人申请，剧组可以选择通过
      // 不再检查是否已满员，让剧组自行决定是否通过

      // 7. 检查演员是否符合要求
      const matchResult = await checkActorMatch(userId, order)
      if (!matchResult.match) {
        return {
          code: 400,
          message: matchResult.reason || '您不符合该订单的要求'
        }
      }

      // 8. 添加申请记录
      const newApplicant = {
        actor_id: userId,
        status: 'pending',
        apply_time: Date.now()
      }

      await db.collection('orders')
        .doc(orderId)
        .update({
          applicants: dbCmd.push(newApplicant),
          update_time: Date.now()
        })

      return {
        code: 0,
        message: '申请已提交，请等待剧组审核',
        data: {
          order_id: orderId,
          status: 'pending'
        }
      }

    } catch (error) {
      console.error('申请订单失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误,请稍后重试'
      }
    }
  },

  /**
   * 审核申请者 - 剧组端
   * @param {String} orderId 订单ID
   * @param {String} actorId 演员ID
   * @param {String} action 操作: approve-通过, reject-拒绝
   * @param {String} reason 拒绝原因(可选)
   * @returns {Object} 操作结果
   */
  async reviewApplicant(orderId, actorId, action, reason = '') {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return { code: 401, message: '请先登录' }
      }

      if (!['approve', 'reject'].includes(action)) {
        return { code: 400, message: '无效的操作' }
      }

      // 1. 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      const order = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data
      if (!order) {
        return { code: 404, message: '订单不存在' }
      }

      // 2. 检查权限(必须是发布者)
      if (order.publisher_id !== userId) {
        return { code: 403, message: '无权审核此订单' }
      }

      // 3. 检查订单状态：待接单或进行中都允许继续审核
      if (![0, 1].includes(order.order_status)) {
        return { code: 400, message: '订单状态不允许审核' }
      }

      // 4. 查找申请者
      const applicants = order.applicants || []
      const applicantIndex = applicants.findIndex(a => a.actor_id === actorId)
      if (applicantIndex === -1) {
        return { code: 404, message: '申请者不存在' }
      }

      const applicant = applicants[applicantIndex]
      if (applicant.status !== 'pending') {
        return { code: 400, message: '该申请已被处理' }
      }

      // 5. 如果是通过，检查是否已满员(但仍允许剧组继续通过)
      const approvedCount = applicants.filter(a => a.status === 'approved').length
      const peopleNeeded = order.people_needed || 1
      // 不再阻止通过，只是给出提示信息
      const isAlreadyFull = approvedCount >= peopleNeeded

      // 6. 更新申请状态
      const now = Date.now()
      applicants[applicantIndex].status = action === 'approve' ? 'approved' : 'rejected'
      applicants[applicantIndex].review_time = now
      if (action === 'reject' && reason) {
        applicants[applicantIndex].reject_reason = reason
      }

      // 7. 构建更新数据
      const updateData = {
        applicants: applicants,
        update_time: now
      }

      // 8. 如果通过，添加到接单者列表
      if (action === 'approve') {
        const receivers = order.receivers || []
        receivers.push(actorId)
        updateData.receivers = receivers

        // 保持 receiver_id 兼容（存储第一个接单者）
        if (receivers.length === 1) {
          updateData.receiver_id = actorId
        }

        // 初始化该演员的追踪状态
        const actorTracking = order.actor_tracking || {}
        actorTracking[actorId] = {
          tracking_started: false,
          tracking_start_time: null,
          arrive_time: null,
          is_completed: false
        }
        updateData.actor_tracking = actorTracking

        // 多人订单：只要有一人通过就进入进行中状态
        // 这样每个演员都可以独立开始履约追踪
        if (order.order_status === 0) {
          updateData.order_status = 1 // 进行中
          updateData.grab_time = now
        }
      }

      await db.collection('orders')
        .doc(orderId)
        .update(updateData)

      const newApprovedCount = approvedCount + 1

      return {
        code: 0,
        message: action === 'approve' ? '已通过该演员的申请' : '已拒绝该演员的申请',
        data: {
          order_id: orderId,
          actor_id: actorId,
          action: action,
          approved_count: action === 'approve' ? newApprovedCount : approvedCount,
          people_needed: peopleNeeded,
          is_full: action === 'approve' && newApprovedCount >= peopleNeeded
        }
      }

    } catch (error) {
      console.error('审核申请失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 获取订单申请者列表 - 剧组端
   * @param {String} orderId 订单ID
   * @returns {Object} 申请者列表(含演员详细信息)
   */
  async getApplicants(orderId) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return { code: 401, message: '请先登录' }
      }

      // 1. 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      const order = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data
      if (!order) {
        return { code: 404, message: '订单不存在' }
      }

      // 2. 检查权限
      if (order.publisher_id !== userId) {
        return { code: 403, message: '无权查看此订单申请' }
      }

      // 3. 获取申请者列表
      const applicants = order.applicants || []
      if (applicants.length === 0) {
        return {
          code: 0,
          data: {
            list: [],
            total: 0,
            approved_count: 0,
            people_needed: order.people_needed || 1
          }
        }
      }

      // 4. 获取演员详细信息
      const actorIds = applicants.map(a => a.actor_id)
      const actorsRes = await db.collection('uni-id-users')
        .where({
          _id: dbCmd.in(actorIds)
        })
        .field({
          _id: true,
          nickname: true,
          avatar: true,
          avatar_file: true,
          gender: true,
          height: true,
          body_type: true,
          skills: true,
          description: true,
          comp_cards: true,
          video_card_url: true,
          credit_score_actor: true,
          is_realname_auth: true,
          mobile: true,
          wechat_id: true
        })
        .get()

      const actorMap = {}
      ;(actorsRes.data || []).forEach(actor => {
        actorMap[actor._id] = actor
      })

      // 5. 组装返回数据
      const list = applicants.map(applicant => {
        const actor = actorMap[applicant.actor_id] || {}
        return {
          ...applicant,
          actor_info: {
            _id: actor._id,
            nickname: actor.nickname || '未知演员',
            avatar: actor.avatar || '',
            avatar_file: actor.avatar_file || null,
            gender: actor.gender,
            gender_text: actor.gender === 1 ? '男' : (actor.gender === 2 ? '女' : '未设置'),
            height: actor.height,
            body_type: actor.body_type,
            skills: actor.skills || [],
            description: actor.description || '',
            comp_cards: actor.comp_cards || [],
            video_card_url: actor.video_card_url || '',
            credit_score: actor.credit_score_actor || 100,
            is_realname_auth: actor.is_realname_auth || false,
            mobile: actor.mobile || '',
            wechat_id: actor.wechat_id || ''
          }
        }
      })

      // 按申请时间倒序，pending状态优先
      list.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (a.status !== 'pending' && b.status === 'pending') return 1
        return (b.apply_time || 0) - (a.apply_time || 0)
      })

      const approvedCount = applicants.filter(a => a.status === 'approved').length

      return {
        code: 0,
        data: {
          list,
          total: applicants.length,
          approved_count: approvedCount,
          people_needed: order.people_needed || 1
        }
      }

    } catch (error) {
      console.error('获取申请者列表失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 获取演员的申请记录 - 演员端
   * @param {Object} params 查询参数
   * @returns {Object} 申请记录列表
   */
  async getMyApplications(params = {}) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return { code: 401, message: '请先登录' }
      }

      const { status, page = 1, pageSize = 20 } = params

      // 构建查询条件
      let whereCondition = {
        'applicants.actor_id': userId
      }

      // 状态筛选
      if (status) {
        whereCondition['applicants.status'] = status
      }

      const orderRes = await db.collection('orders')
        .where(whereCondition)
        .orderBy('create_time', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()

      const orders = orderRes.data || []

      // 处理返回数据
      const list = orders.map(order => {
        const myApplicant = (order.applicants || []).find(a => a.actor_id === userId)
        return {
          _id: order._id,
          role_description: order.role_description || '群众演员',
          meeting_location_name: order.meeting_location_name,
          meeting_time: order.meeting_time,
          price_amount: order.price_amount,
          price_type: order.price_type,
          price_amount_yuan: (order.price_amount / 100).toFixed(2),
          order_status: order.order_status,
          people_needed: order.people_needed || 1,
          application_status: myApplicant ? myApplicant.status : 'unknown',
          apply_time: myApplicant ? myApplicant.apply_time : null,
          review_time: myApplicant ? myApplicant.review_time : null,
          reject_reason: myApplicant ? myApplicant.reject_reason : null
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
      console.error('获取申请记录失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 抢单 - 演员接单 (保留兼容旧版直接抢单模式)
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

      // 2. 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      const order = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data
      if (!order) {
        return {
          code: 404,
          message: '订单不存在'
        }
      }

      // 3. 检查订单状态(必须是待接单)
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
        const checkRes = await transaction.collection('orders')
          .doc(orderId)
          .get()

        const checkOrder = Array.isArray(checkRes.data) ? checkRes.data[0] : checkRes.data
        if (!checkOrder || checkOrder.order_status !== 0) {
          await transaction.rollback()
          return {
            code: 400,
            message: '手慢了,订单状态已变更'
          }
        }

        const currentReceivers = checkOrder.receivers || []
        const neededCount = checkOrder.people_needed || 1
        if (currentReceivers.length >= neededCount) {
          await transaction.rollback()
          return {
            code: 400,
            message: '手慢了,订单已满员'
          }
        }

        if (currentReceivers.includes(userId)) {
          await transaction.rollback()
          return {
            code: 400,
            message: '您已经接过这个单了'
          }
        }

        const newReceivers = [...currentReceivers, userId]
        const isFull = newReceivers.length >= neededCount

        const updateData = {
          receivers: newReceivers,
          update_time: Date.now()
        }

        if (isFull) {
          updateData.order_status = 1
          updateData.grab_time = Date.now()
        }

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
   * 搜索演员 - 剧组端
   * @param {Object} params 搜索参数
   * @param {string} params.keyword 搜索关键词(昵称)
   * @param {number} params.userLongitude 用户经度(用于计算距离)
   * @param {number} params.userLatitude 用户纬度(用于计算距离)
   * @param {number} params.limit 返回数量限制
   * @returns {Object} 搜索结果
   */
  async searchActors(params = {}) {
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
          message: '仅剧组用户可以搜索演员'
        }
      }

      const {
        keyword = '',
        userLongitude,
        userLatitude,
        limit = 50
      } = params

      if (!keyword || keyword.trim() === '') {
        return {
          code: 0,
          data: []
        }
      }

      const searchKeyword = keyword.trim()

      // 构建查询条件 - 搜索所有演员(包括在线和离线，不限制认证状态)
      let whereCondition = {
        user_role: 2, // 演员
        nickname: new RegExp(searchKeyword, 'i') // 模糊匹配昵称
      }

      let actors = []

      // 如果有位置信息，使用地理位置查询计算距离
      if (userLongitude && userLatitude) {
        // 先查询出所有匹配的演员
        const actorRes = await db.collection('uni-id-users')
          .where(whereCondition)
          .field({
            _id: true,
            nickname: true,
            avatar: true,
            avatar_file: true,
            gender: true,
            height: true,
            body_type: true,
            skills: true,
            video_card: true,
            video_card_url: true,
            credit_score_actor: true,
            current_location: true,
            last_login_location: true,
            location: true,
            online_status: true,
            last_active_time: true,
            profile_text: true
          })
          .orderBy('credit_score_actor', 'desc')
          .limit(limit)
          .get()

        actors = actorRes.data || []

        // 计算每个演员与用户的距离
        const userLng = parseFloat(userLongitude)
        const userLat = parseFloat(userLatitude)

        actors = actors.map(actor => {
          let actorLng = null
          let actorLat = null

          // 确定演员位置: 在线用current_location，离线用last_login_location或location
          if (actor.online_status === 1 && actor.current_location && actor.current_location.coordinates) {
            actorLng = actor.current_location.coordinates[0]
            actorLat = actor.current_location.coordinates[1]
          } else if (actor.last_login_location && actor.last_login_location.coordinates) {
            actorLng = actor.last_login_location.coordinates[0]
            actorLat = actor.last_login_location.coordinates[1]
          } else if (actor.location && actor.location.coordinates) {
            actorLng = actor.location.coordinates[0]
            actorLat = actor.location.coordinates[1]
          }

          // 计算距离(单位:米)
          let distance = null
          if (actorLng !== null && actorLat !== null) {
            distance = this._calculateDistance(userLat, userLng, actorLat, actorLng)
          }

          return {
            ...actor,
            distance: distance,
            distance_km: distance !== null ? (distance / 1000).toFixed(1) : null
          }
        })

        // 按距离排序(有距离的在前，无距离的在后)
        actors.sort((a, b) => {
          if (a.distance === null && b.distance === null) return 0
          if (a.distance === null) return 1
          if (b.distance === null) return -1
          return a.distance - b.distance
        })

      } else {
        // 没有位置信息，按信用分排序
        const actorRes = await db.collection('uni-id-users')
          .where(whereCondition)
          .field({
            _id: true,
            nickname: true,
            avatar: true,
            avatar_file: true,
            gender: true,
            height: true,
            body_type: true,
            skills: true,
            video_card: true,
            video_card_url: true,
            credit_score_actor: true,
            current_location: true,
            last_login_location: true,
            location: true,
            online_status: true,
            last_active_time: true,
            profile_text: true
          })
          .orderBy('credit_score_actor', 'desc')
          .limit(limit)
          .get()

        actors = actorRes.data || []
      }

      return {
        code: 0,
        data: actors
      }

    } catch (error) {
      console.error('搜索演员失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 计算两点间的距离(Haversine公式)
   * @param {number} lat1 纬度1
   * @param {number} lng1 经度1
   * @param {number} lat2 纬度2
   * @param {number} lng2 经度2
   * @returns {number} 距离(米)
   */
  _calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000 // 地球半径(米)
    const dLat = this._toRad(lat2 - lat1)
    const dLng = this._toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this._toRad(lat1)) * Math.cos(this._toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  },

  /**
   * 角度转弧度
   * @param {number} deg 角度
   * @returns {number} 弧度
   */
  _toRad(deg) {
    return deg * Math.PI / 180
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
        showAll = false, // 是否显示所有订单(包括已完成/已取消)
        page = 1,
        pageSize = 20
      } = params

      // 构建查询条件
      let whereCondition = {}

      // 如果不是显示全部,查询待接单和进行中(多人单可能还有名额)的订单
      if (!showAll) {
        whereCondition.order_status = dbCmd.in([0, 1]) // 待接单 + 进行中
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
            avatar_file: true,
            credit_score_crew: true
          })
          .get()

        publisherRes.data.forEach(p => {
          publisherMap[p._id] = p
        })
      }

      // 处理返回数据
      let list = orders.map(order => {
        const publisher = publisherMap[order.publisher_id] || {}
        return {
          ...order,
          price_amount_yuan: (order.price_amount / 100).toFixed(2),
          distance_km: order.distance ? (order.distance / 1000).toFixed(1) : null,
          publisher_info: {
            nickname: publisher.nickname || '未知剧组',
            avatar: publisher.avatar || '',
            avatar_file: publisher.avatar_file || null,
            credit_score: publisher.credit_score_crew || 100
          }
        }
      })

      // 如果不是showAll模式，过滤掉已满员的订单
      if (!showAll) {
        list = list.filter(order => {
          const receivers = order.receivers || []
          const peopleNeeded = order.people_needed || 1
          // 只显示还有名额的订单
          return receivers.length < peopleNeeded
        })
      }

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

      // 权限检查(必须是该订单的接单演员之一)
      const receivers = order.receivers || []
      if (!receivers.includes(userId) && order.receiver_id !== userId) {
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

      // 检查该演员是否已开始轨迹追踪(必须先点击"我已出发")
      const actorTracking = order.actor_tracking || {}
      const myTracking = actorTracking[userId]
      if (!myTracking || !myTracking.tracking_started) {
        return {
          code: 400,
          message: '请先点击"我已出发"开始轨迹追踪'
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

      // 权限检查(必须是该订单的接单演员之一)
      const receivers = order.receivers || []
      if (!receivers.includes(userId) && order.receiver_id !== userId) {
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

      // 检查该演员是否已打卡(从actor_tracking中检查)
      const actorTracking = order.actor_tracking || {}
      const myTracking = actorTracking[userId]
      if (myTracking && myTracking.arrive_time) {
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

      // 更新该演员的打卡状态
      const actorTrackingUpdate = order.actor_tracking || {}
      actorTrackingUpdate[userId] = {
        ...(actorTrackingUpdate[userId] || {}),
        arrive_time: now
      }

      await db.collection('orders')
        .doc(orderId)
        .update({
          actor_tracking: actorTrackingUpdate,
          // 保持向后兼容：如果是第一个打卡的演员，也更新旧字段
          arrive_time: order.arrive_time || now,
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
   * 演员出发 - 开始轨迹追踪
   * @param {String} orderId 订单ID
   * @returns {Object} 操作结果
   */
  async startDeparture(orderId) {
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

      // 权限检查(必须是该订单的接单演员之一)
      const receivers = order.receivers || []
      if (!receivers.includes(userId) && order.receiver_id !== userId) {
        return {
          code: 403,
          message: '无权操作此订单'
        }
      }

      // 订单状态检查(必须是进行中)
      if (order.order_status !== 1) {
        return {
          code: 400,
          message: '当前订单状态不允许出发'
        }
      }

      // 检查该演员是否已经出发(从actor_tracking中检查)
      const actorTracking = order.actor_tracking || {}
      const myTracking = actorTracking[userId]
      if (myTracking && myTracking.tracking_started) {
        return {
          code: 400,
          message: '您已经点击过出发了'
        }
      }

      const now = Date.now()

      // 更新该演员的追踪状态
      actorTracking[userId] = {
        ...(myTracking || {}),
        tracking_started: true,
        tracking_start_time: now
      }

      // 更新订单
      await db.collection('orders')
        .doc(orderId)
        .update({
          actor_tracking: actorTracking,
          // 保持向后兼容：如果是第一个出发的演员，也更新旧字段
          tracking_started: true,
          tracking_start_time: order.tracking_start_time || now,
          start_off_time: order.start_off_time || now,
          update_time: now
        })

      return {
        code: 0,
        message: '已出发,开始轨迹追踪',
        data: {
          start_time: now
        }
      }

    } catch (error) {
      console.error('开始出发失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 上报问题 - 演员端
   * @param {String} orderId 订单ID
   * @param {Object} issueData 问题数据
   * @returns {Object} 操作结果
   */
  async reportIssue(orderId, issueData) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      const { issue_type, description = '', location } = issueData

      // 校验问题类型
      const validTypes = ['late_warning', 'cannot_arrive', 'safety_issue', 'other']
      if (!validTypes.includes(issue_type)) {
        return {
          code: 400,
          message: '无效的问题类型'
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
          message: '无权操作此订单'
        }
      }

      // 订单状态检查
      if (order.order_status !== 1) {
        return {
          code: 400,
          message: '当前订单状态不允许上报问题'
        }
      }

      const now = Date.now()

      // 构建问题记录
      const issueRecord = {
        order_id: orderId,
        reporter_id: userId,
        issue_type: issue_type,
        issue_description: description,
        report_time: now,
        status: 'pending'
      }

      // 添加位置信息
      if (location && location.longitude && location.latitude) {
        issueRecord.location = {
          type: 'Point',
          coordinates: [parseFloat(location.longitude), parseFloat(location.latitude)]
        }
      }

      // 插入问题记录
      await db.collection('order_issues').add(issueRecord)

      // 问题类型对应的消息
      const messageMap = {
        'late_warning': '已通知剧组您可能迟到',
        'safety_issue': '已上报安全问题',
        'other': '问题已上报',
        'cannot_arrive': '问题已记录'
      }

      return {
        code: 0,
        message: messageMap[issue_type] || '问题已上报',
        data: {
          issue_type: issue_type
        }
      }

    } catch (error) {
      console.error('上报问题失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 演员取消订单(无法到达)
   * @param {String} orderId 订单ID
   * @param {String} reason 取消原因
   * @returns {Object} 操作结果
   */
  async actorCancelOrder(orderId, reason = '无法到达') {
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

      // 权限检查(必须是该订单的演员)
      if (order.receiver_id !== userId) {
        return {
          code: 403,
          message: '无权取消此订单'
        }
      }

      // 订单状态检查(必须是进行中)
      if (order.order_status !== 1) {
        return {
          code: 400,
          message: '当前订单状态不允许取消'
        }
      }

      const now = Date.now()
      const receivers = order.receivers || []

      // 从接单者列表中移除当前演员
      const newReceivers = receivers.filter(id => id !== userId)

      // 构建更新数据
      let updateData = {
        receivers: newReceivers,
        actor_cancel_reason: reason,
        update_time: now
      }

      // 如果接单者列表为空,订单重新变为待接单
      if (newReceivers.length === 0) {
        updateData.order_status = 0 // 待接单
        updateData.receiver_id = null
        updateData.tracking_started = false
        updateData.tracking_start_time = null
        updateData.start_off_time = null
      } else {
        // 如果还有其他接单者,更新receiver_id为第一个
        updateData.receiver_id = newReceivers[0]
      }

      // 更新订单
      await db.collection('orders')
        .doc(orderId)
        .update(updateData)

      // 扣除演员信用分5分
      await db.collection('uni-id-users')
        .doc(userId)
        .update({
          credit_score_actor: dbCmd.inc(-5)
        })

      // 记录问题到order_issues表
      await db.collection('order_issues').add({
        order_id: orderId,
        reporter_id: userId,
        issue_type: 'cannot_arrive',
        issue_description: reason,
        report_time: now,
        status: 'processed',
        process_time: now,
        process_result: '演员已取消接单,订单重新开放'
      })

      return {
        code: 0,
        message: '已取消接单,订单将重新开放给其他演员',
        data: {
          order_status: newReceivers.length === 0 ? 0 : 1
        }
      }

    } catch (error) {
      console.error('演员取消订单失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 获取订单问题上报列表
   * @param {String} orderId 订单ID
   * @returns {Object} 问题列表
   */
  async getOrderIssues(orderId) {
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

      // 权限检查(发布者和接单者都可以查看)
      if (order.publisher_id !== userId && order.receiver_id !== userId) {
        return {
          code: 403,
          message: '无权查看此订单问题'
        }
      }

      // 查询问题列表
      const issuesRes = await db.collection('order_issues')
        .where({
          order_id: orderId
        })
        .orderBy('report_time', 'desc')
        .get()

      const issues = issuesRes.data || []

      // 问题类型映射
      const typeMap = {
        'late_warning': '迟到预警',
        'cannot_arrive': '无法到达',
        'safety_issue': '安全问题',
        'other': '其他问题'
      }

      return {
        code: 0,
        data: {
          list: issues.map(issue => ({
            ...issue,
            issue_type_text: typeMap[issue.issue_type] || issue.issue_type
          })),
          total: issues.length
        }
      }

    } catch (error) {
      console.error('获取问题列表失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 取消申请 - 演员端
   * @param {String} orderId 订单ID
   * @returns {Object} 操作结果
   */
  async cancelApplication(orderId) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return { code: 401, message: '请先登录' }
      }

      // 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      const order = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data
      if (!order) {
        return { code: 404, message: '订单不存在' }
      }

      // 检查订单状态(只有待接单状态的申请可以取消)
      if (order.order_status !== 0) {
        return { code: 400, message: '订单已开始,无法取消申请' }
      }

      // 查找用户的申请
      const applicants = order.applicants || []
      const myApplicationIndex = applicants.findIndex(a => a.actor_id === userId)

      if (myApplicationIndex === -1) {
        return { code: 404, message: '未找到您的申请记录' }
      }

      const myApplication = applicants[myApplicationIndex]

      // 只有 pending 状态可以取消
      if (myApplication.status !== 'pending') {
        if (myApplication.status === 'approved') {
          return { code: 400, message: '申请已通过,无法取消' }
        } else {
          return { code: 400, message: '申请已被处理,无法取消' }
        }
      }

      // 从申请者列表中移除
      applicants.splice(myApplicationIndex, 1)

      await db.collection('orders')
        .doc(orderId)
        .update({
          applicants: applicants,
          update_time: Date.now()
        })

      return {
        code: 0,
        message: '已取消申请',
        data: {
          order_id: orderId
        }
      }

    } catch (error) {
      console.error('取消申请失败:', error)
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
            avatar_file: true,
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
            avatar_file: publisher.avatar_file || null,
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
  },

  /**
   * 获取特定演员的追踪信息 - 剧组端
   * @param {String} orderId 订单ID
   * @param {String} actorId 演员ID
   * @returns {Object} 演员追踪信息
   */
  async getActorTracking(orderId, actorId) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return { code: 401, message: '请先登录' }
      }

      // 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      const order = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data
      if (!order) {
        return { code: 404, message: '订单不存在' }
      }

      // 权限检查(必须是发布者)
      if (order.publisher_id !== userId) {
        return { code: 403, message: '无权查看此信息' }
      }

      // 检查演员是否在接单者列表中
      const receivers = order.receivers || []
      if (!receivers.includes(actorId)) {
        return { code: 400, message: '该演员不是此订单的接单者' }
      }

      // 获取演员追踪状态
      const actorTracking = order.actor_tracking || {}
      const tracking = actorTracking[actorId] || {
        tracking_started: false,
        tracking_start_time: null,
        arrive_time: null,
        is_completed: false
      }

      // 获取该演员的轨迹记录
      const tracksRes = await db.collection('order_tracks')
        .where({
          order_id: orderId,
          user_id: actorId
        })
        .orderBy('report_time', 'desc')
        .limit(50)
        .get()

      const tracks = tracksRes.data || []

      // 获取最新位置
      const latestTrack = tracks.length > 0 ? tracks[0] : null

      // 获取演员信息
      const actorRes = await db.collection('uni-id-users')
        .doc(actorId)
        .field({
          nickname: true,
          avatar: true,
          avatar_file: true,
          mobile: true
        })
        .get()

      const actorInfo = actorRes.data && actorRes.data.length > 0 ? actorRes.data[0] : {}

      return {
        code: 0,
        data: {
          order_id: orderId,
          actor_id: actorId,
          actor_info: {
            nickname: actorInfo.nickname || '演员',
            avatar: actorInfo.avatar || '',
            avatar_file: actorInfo.avatar_file || null,
            mobile: actorInfo.mobile || ''
          },
          tracking: tracking,
          meeting_location: order.meeting_location,
          meeting_location_name: order.meeting_location_name,
          meeting_time: order.meeting_time,
          order_status: order.order_status,
          latest_location: latestTrack ? {
            location: latestTrack.location,
            report_time: latestTrack.report_time,
            distance_to_destination: latestTrack.distance_to_destination
          } : null,
          tracks: tracks.map(t => ({
            location: t.location,
            report_time: t.report_time,
            distance_to_destination: t.distance_to_destination,
            track_type: t.track_type
          })).reverse(),
          is_online: latestTrack ? (Date.now() - latestTrack.report_time < 60000) : false
        }
      }

    } catch (error) {
      console.error('获取演员追踪信息失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 完成单个演员的订单 - 剧组端
   * @param {String} orderId 订单ID
   * @param {String} actorId 演员ID
   * @returns {Object} 操作结果
   */
  async completeActorOrder(orderId, actorId) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return { code: 401, message: '请先登录' }
      }

      // 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      const order = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data
      if (!order) {
        return { code: 404, message: '订单不存在' }
      }

      // 权限检查(必须是发布者)
      if (order.publisher_id !== userId) {
        return { code: 403, message: '仅剧组方可以确认订单完成' }
      }

      // 状态检查(必须是进行中)
      if (order.order_status !== 1) {
        return { code: 400, message: '当前订单状态不允许完成' }
      }

      // 检查演员是否在接单者列表中
      const receivers = order.receivers || []
      if (!receivers.includes(actorId)) {
        return { code: 400, message: '该演员不是此订单的接单者' }
      }

      // 检查演员是否已打卡
      const actorTracking = order.actor_tracking || {}
      const tracking = actorTracking[actorId]
      if (!tracking || !tracking.arrive_time) {
        return { code: 400, message: '该演员尚未打卡，无法完成' }
      }

      const now = Date.now()

      // 更新该演员的完成状态
      actorTracking[actorId] = {
        ...tracking,
        is_completed: true,
        complete_time: now
      }

      // 检查是否所有演员都已完成
      const allCompleted = receivers.every(rid => {
        const t = actorTracking[rid]
        return t && t.is_completed
      })

      const updateData = {
        actor_tracking: actorTracking,
        update_time: now
      }

      // 如果所有人都完成了，更新订单状态
      if (allCompleted) {
        updateData.order_status = 3 // 已完成
        updateData.finish_time = now
      }

      await db.collection('orders')
        .doc(orderId)
        .update(updateData)

      // 给演员加信用分
      await db.collection('uni-id-users')
        .doc(actorId)
        .update({
          credit_score_actor: dbCmd.inc(5) // 完成订单加5分
        })

      return {
        code: 0,
        message: allCompleted ? '所有演员已完成，订单已结束' : '已确认该演员完成',
        data: {
          actor_id: actorId,
          is_completed: true,
          all_completed: allCompleted
        }
      }

    } catch (error) {
      console.error('完成演员订单失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 通知剧组问题 - 演员端
   * 用于演员向剧组发送迟到预警、其他问题等通知
   * @param {String} orderId 订单ID
   * @param {Object} data 通知数据
   * @param {String} data.message 通知消息
   * @param {String} data.issue_type 问题类型: late_warning | other
   * @param {Object} data.actor_location 演员当前位置
   * @returns {Object} 操作结果
   */
  async notifyCrewIssue(orderId, data) {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return { code: 401, message: '请先登录' }
      }

      if (!orderId) {
        return { code: 400, message: '订单ID不能为空' }
      }

      if (!data || !data.message) {
        return { code: 400, message: '通知消息不能为空' }
      }

      // 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      const order = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data
      if (!order) {
        return { code: 404, message: '订单不存在' }
      }

      // 检查用户是否是该订单的接单者
      const receivers = order.receivers || []
      const isInApplicants = (order.applicants || []).some(a => a.actor_id === userId && a.status === 'approved')

      if (!receivers.includes(userId) && !isInApplicants) {
        return { code: 403, message: '您不是此订单的接单者' }
      }

      const now = Date.now()

      // 获取演员信息
      const actorRes = await db.collection('uni-id-users')
        .doc(userId)
        .field({ nickname: true, avatar: true, mobile: true })
        .get()

      const actor = Array.isArray(actorRes.data) ? actorRes.data[0] : actorRes.data
      const actorName = actor ? actor.nickname : '演员'

      // 创建问题记录
      const issueRecord = {
        order_id: orderId,
        actor_id: userId,
        actor_name: actorName,
        issue_type: data.issue_type || 'other',
        issue_description: data.message,
        report_time: now,
        location: data.actor_location || null,
        status: 'pending', // pending | read | resolved
        create_time: now
      }

      // 保存到问题记录表
      await db.collection('order_issues').add(issueRecord)

      // 更新订单的问题标记
      const updateData = {
        has_issues: true,
        last_issue_time: now,
        update_time: now
      }

      // 如果是迟到预警，记录到actor_tracking
      if (data.issue_type === 'late_warning') {
        const actorTracking = order.actor_tracking || {}
        if (actorTracking[userId]) {
          actorTracking[userId].late_warning_time = now
          actorTracking[userId].late_warning_sent = true
          updateData.actor_tracking = actorTracking
        }
      }

      await db.collection('orders')
        .doc(orderId)
        .update(updateData)

      // TODO: 发送推送通知给剧组
      // 可以通过uni-push或其他推送服务实现
      // const publisherId = order.publisher_id
      // await sendPushNotification(publisherId, {
      //   title: '订单问题通知',
      //   content: data.message
      // })

      return {
        code: 0,
        message: '已通知剧组',
        data: {
          issue_id: issueRecord._id,
          notify_time: now
        }
      }

    } catch (error) {
      console.error('通知剧组失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 从订单中移除演员 - 剧组端
   * 用于剧组在演员迟到超时后取消其接单资格
   * @param {String} orderId 订单ID
   * @param {String} actorId 演员ID
   * @param {String} reason 取消原因: late_cancellation | crew_cancel | other
   * @returns {Object} 操作结果
   */
  async removeActorFromOrder(orderId, actorId, reason = 'late_cancellation') {
    try {
      const userId = this.authInfo && this.authInfo.uid

      if (!userId) {
        return { code: 401, message: '请先登录' }
      }

      if (!orderId || !actorId) {
        return { code: 400, message: '参数不完整' }
      }

      // 查询订单
      const orderRes = await db.collection('orders')
        .doc(orderId)
        .get()

      const order = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data
      if (!order) {
        return { code: 404, message: '订单不存在' }
      }

      // 权限检查(必须是发布者)
      if (order.publisher_id !== userId) {
        return { code: 403, message: '仅剧组方可以移除演员' }
      }

      // 状态检查(必须是进行中)
      if (order.order_status !== 1) {
        return { code: 400, message: '当前订单状态不允许移除演员' }
      }

      // 检查演员是否在接单者列表中
      const receivers = order.receivers || []
      if (!receivers.includes(actorId)) {
        return { code: 400, message: '该演员不是此订单的接单者' }
      }

      // 检查演员是否已打卡（已打卡的不能移除）
      const actorTracking = order.actor_tracking || {}
      const tracking = actorTracking[actorId]
      if (tracking && tracking.arrive_time) {
        return { code: 400, message: '该演员已打卡，无法移除' }
      }

      const now = Date.now()

      // 从receivers中移除该演员
      const newReceivers = receivers.filter(id => id !== actorId)

      // 从actor_tracking中移除该演员
      delete actorTracking[actorId]

      // 更新申请者状态为cancelled
      const applicants = order.applicants || []
      const updatedApplicants = applicants.map(a => {
        if (a.actor_id === actorId) {
          return {
            ...a,
            status: 'cancelled',
            cancel_reason: reason,
            cancel_time: now
          }
        }
        return a
      })

      // 构建更新数据
      const updateData = {
        receivers: newReceivers,
        actor_tracking: actorTracking,
        applicants: updatedApplicants,
        update_time: now
      }

      // 如果没有接单者了，将订单状态改回待接单
      if (newReceivers.length === 0) {
        updateData.order_status = 0 // 待接单
        updateData.receiver_id = null
      }

      await db.collection('orders')
        .doc(orderId)
        .update(updateData)

      // 记录取消日志
      await db.collection('order_issues').add({
        order_id: orderId,
        actor_id: actorId,
        issue_type: 'actor_removed',
        issue_description: '演员被移除: ' + reason,
        report_time: now,
        operator_id: userId,
        operator_type: 'crew',
        status: 'resolved',
        create_time: now
      })

      // 扣除演员信用分（迟到取消扣5分）
      if (reason === 'late_cancellation') {
        await db.collection('uni-id-users')
          .doc(actorId)
          .update({
            credit_score_actor: dbCmd.inc(-5)
          })
      }

      // 获取演员信息用于返回
      const actorRes = await db.collection('uni-id-users')
        .doc(actorId)
        .field({ nickname: true })
        .get()

      const actor = Array.isArray(actorRes.data) ? actorRes.data[0] : actorRes.data
      const actorName = actor ? actor.nickname : '演员'

      return {
        code: 0,
        message: '已移除演员【' + actorName + '】',
        data: {
          actor_id: actorId,
          actor_name: actorName,
          remaining_receivers: newReceivers.length,
          order_status: newReceivers.length === 0 ? 0 : 1,
          credit_deducted: reason === 'late_cancellation' ? 5 : 0
        }
      }

    } catch (error) {
      console.error('移除演员失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  }
}
