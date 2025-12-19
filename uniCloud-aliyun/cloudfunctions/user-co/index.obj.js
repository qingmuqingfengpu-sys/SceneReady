const db = uniCloud.database()
const dbCmd = db.command
const uniIdCommon = require('uni-id-common')

module.exports = {
  _before: async function () {
    // 跳过不需要登录的方法
    const publicMethods = ['getPublicProfile']
    if (publicMethods.includes(this.getMethodName())) {
      return
    }

    // 创建 uni-id 实例
    const uniID = uniIdCommon.createInstance({
      clientInfo: this.getClientInfo()
    })

    // 获取并验证 token
    const token = this.getUniIdToken()
    console.log('user-co _before: token =', token ? token.substring(0, 20) + '...' : null)

    if (token) {
      try {
        // 使用 uni-id-common 验证 token
        const payload = await uniID.checkToken(token)
        console.log('user-co checkToken result:', JSON.stringify(payload))

        if (payload.errCode === 0) {
          // token 验证成功,存储用户信息供后续方法使用
          this.authInfo = {
            uid: payload.uid,
            role: payload.role,
            permission: payload.permission
          }
        } else {
          console.log('token 验证失败:', payload.errMsg)
          this.authInfo = null
        }
      } catch (error) {
        console.error('token 验证异常:', error)
        this.authInfo = null
      }
    } else {
      this.authInfo = null
    }

    console.log('user-co _before:', {
      method: this.getMethodName(),
      hasToken: !!token,
      uid: this.authInfo ? this.authInfo.uid : null
    })
  },

  /**
   * 获取当前用户资料
   * @returns {Object} 用户资料
   */
  async getProfile() {
    try {
      if (!this.authInfo || !this.authInfo.uid) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      const userId = this.authInfo.uid

      const userRes = await db.collection('uni-id-users')
        .doc(userId)
        .field({
          _id: true,
          username: true,
          nickname: true,
          avatar: true,
          gender: true,
          mobile: true,
          email: true,
          user_role: true,
          auth_status: true,
          credit_score_actor: true,
          credit_score_crew: true,
          video_card_url: true,
          profile_images: true,
          profile_text: true,
          skills: true,
          height: true,
          body_type: true,
          verify_info: true,
          register_date: true,
          last_login_date: true
        })
        .get()

      if (!userRes.data || userRes.data.length === 0) {
        return {
          code: 404,
          message: '用户不存在'
        }
      }

      const user = userRes.data[0]

      return {
        code: 0,
        data: {
          ...user,
          user_role_text: user.user_role === 1 ? '剧组' : (user.user_role === 2 ? '演员' : '未设置'),
          auth_status_text: this._getAuthStatusText(user.auth_status),
          credit_score: user.user_role === 1 ? user.credit_score_crew : user.credit_score_actor
        }
      }

    } catch (error) {
      console.error('获取用户资料失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 获取指定用户的公开资料
   * @param {String} userId 用户ID
   * @returns {Object} 用户公开资料
   */
  async getPublicProfile(userId) {
    try {
      if (!userId) {
        return {
          code: 400,
          message: '用户ID不能为空'
        }
      }

      const userRes = await db.collection('uni-id-users')
        .doc(userId)
        .field({
          _id: true,
          nickname: true,
          avatar: true,
          gender: true,
          user_role: true,
          auth_status: true,
          credit_score_actor: true,
          credit_score_crew: true,
          video_card_url: true,
          profile_text: true,
          skills: true,
          height: true,
          body_type: true
        })
        .get()

      if (!userRes.data || userRes.data.length === 0) {
        return {
          code: 404,
          message: '用户不存在'
        }
      }

      const user = userRes.data[0]

      return {
        code: 0,
        data: {
          _id: user._id,
          nickname: user.nickname || '未知用户',
          avatar: user.avatar || '',
          gender: user.gender,
          gender_text: user.gender === 1 ? '男' : (user.gender === 2 ? '女' : '未设置'),
          user_role: user.user_role,
          user_role_text: user.user_role === 1 ? '剧组' : (user.user_role === 2 ? '演员' : '未设置'),
          auth_status: user.auth_status,
          is_verified: user.auth_status === 2,
          credit_score: user.user_role === 1 ? user.credit_score_crew : user.credit_score_actor,
          video_card_url: user.video_card_url || '',
          profile_text: user.profile_text || '',
          skills: user.skills || [],
          height: user.height,
          body_type: user.body_type
        }
      }

    } catch (error) {
      console.error('获取用户公开资料失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 更新个人资料
   * @param {Object} data 资料数据
   * @returns {Object} 操作结果
   */
  async updateProfile(data) {
    try {
      if (!this.authInfo || !this.authInfo.uid) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      const userId = this.authInfo.uid

      // 允许更新的字段
      const allowedFields = [
        'nickname', 'avatar', 'gender', 'height', 'body_type',
        'skills', 'profile_text', 'profile_images'
      ]

      // 过滤数据
      const updateData = {}
      for (const key of allowedFields) {
        if (data[key] !== undefined) {
          updateData[key] = data[key]
        }
      }

      if (Object.keys(updateData).length === 0) {
        return {
          code: 400,
          message: '没有可更新的数据'
        }
      }

      // 数据校验
      if (updateData.nickname && updateData.nickname.length > 20) {
        return {
          code: 400,
          message: '昵称不能超过20个字符'
        }
      }

      if (updateData.height && (updateData.height < 100 || updateData.height > 250)) {
        return {
          code: 400,
          message: '身高范围应在100-250cm之间'
        }
      }

      if (updateData.body_type && !['slim', 'normal', 'athletic', 'plus'].includes(updateData.body_type)) {
        return {
          code: 400,
          message: '体型参数无效'
        }
      }

      if (updateData.gender && ![1, 2].includes(updateData.gender)) {
        return {
          code: 400,
          message: '性别参数无效'
        }
      }

      updateData.update_time = Date.now()

      await db.collection('uni-id-users')
        .doc(userId)
        .update(updateData)

      return {
        code: 0,
        message: '资料更新成功'
      }

    } catch (error) {
      console.error('更新资料失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 设置用户角色
   * @param {Number} role 角色: 1-剧组, 2-演员
   * @returns {Object} 操作结果
   */
  async setRole(role) {
    try {
      if (!this.authInfo || !this.authInfo.uid) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      const userId = this.authInfo.uid

      if (![1, 2].includes(role)) {
        return {
          code: 400,
          message: '角色参数无效'
        }
      }

      // 检查是否已设置角色
      const userRes = await db.collection('uni-id-users')
        .doc(userId)
        .field({ user_role: true })
        .get()

      if (userRes.data && userRes.data[0] && userRes.data[0].user_role) {
        return {
          code: 400,
          message: '角色已设置,如需更改请联系客服'
        }
      }

      // 设置角色和初始信用分
      const updateData = {
        user_role: role,
        update_time: Date.now()
      }

      if (role === 1) {
        updateData.credit_score_crew = 100
      } else {
        updateData.credit_score_actor = 100
      }

      await db.collection('uni-id-users')
        .doc(userId)
        .update(updateData)

      return {
        code: 0,
        message: '角色设置成功'
      }

    } catch (error) {
      console.error('设置角色失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 获取用户统计数据
   * @returns {Object} 统计数据
   */
  async getStats() {
    try {
      if (!this.authInfo || !this.authInfo.uid) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      const userId = this.authInfo.uid

      // 获取用户角色
      const userRes = await db.collection('uni-id-users')
        .doc(userId)
        .field({ user_role: true, credit_score_actor: true, credit_score_crew: true })
        .get()

      if (!userRes.data || userRes.data.length === 0) {
        return {
          code: 404,
          message: '用户不存在'
        }
      }

      const user = userRes.data[0]
      const isActor = user.user_role === 2

      let stats = {}

      if (isActor) {
        // 演员统计
        const [pendingRes, inProgressRes, completedRes, incomeRes] = await Promise.all([
          // 可接订单数(全部待接单订单)
          db.collection('orders').where({ order_status: 0 }).count(),
          // 进行中订单
          db.collection('orders').where({ receiver_id: userId, order_status: 1 }).count(),
          // 已完成订单
          db.collection('orders').where({ receiver_id: userId, order_status: 3 }).count(),
          // 总收入(已完成订单的金额总和)
          db.collection('orders')
            .aggregate()
            .match({ receiver_id: userId, order_status: 3 })
            .group({
              _id: null,
              total: { $sum: '$price_amount' }
            })
            .end()
        ])

        stats = {
          available_jobs: pendingRes.total || 0,
          in_progress: inProgressRes.total || 0,
          completed: completedRes.total || 0,
          total_income: incomeRes.data[0] ? (incomeRes.data[0].total / 100).toFixed(2) : '0.00',
          credit_score: user.credit_score_actor || 100
        }

      } else {
        // 剧组统计
        const [pendingRes, inProgressRes, completedRes, expenseRes] = await Promise.all([
          // 待接单订单
          db.collection('orders').where({ publisher_id: userId, order_status: 0 }).count(),
          // 进行中订单
          db.collection('orders').where({ publisher_id: userId, order_status: 1 }).count(),
          // 已完成订单
          db.collection('orders').where({ publisher_id: userId, order_status: 3 }).count(),
          // 总支出
          db.collection('orders')
            .aggregate()
            .match({ publisher_id: userId, order_status: 3 })
            .group({
              _id: null,
              total: { $sum: '$price_amount' }
            })
            .end()
        ])

        stats = {
          pending: pendingRes.total || 0,
          in_progress: inProgressRes.total || 0,
          completed: completedRes.total || 0,
          total_expense: expenseRes.data[0] ? (expenseRes.data[0].total / 100).toFixed(2) : '0.00',
          credit_score: user.credit_score_crew || 100
        }
      }

      return {
        code: 0,
        data: {
          ...stats,
          user_role: user.user_role
        }
      }

    } catch (error) {
      console.error('获取统计数据失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 获取信用分历史记录
   * @param {Object} params 查询参数
   * @returns {Object} 信用记录列表
   */
  async getCreditHistory(params = {}) {
    try {
      if (!this.authInfo || !this.authInfo.uid) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      const userId = this.authInfo.uid
      const { page = 1, pageSize = 20 } = params

      // 从已完成和已取消的订单中构建信用记录
      const userRes = await db.collection('uni-id-users')
        .doc(userId)
        .field({ user_role: true, credit_score_actor: true, credit_score_crew: true })
        .get()

      if (!userRes.data || userRes.data.length === 0) {
        return {
          code: 404,
          message: '用户不存在'
        }
      }

      const user = userRes.data[0]
      const isActor = user.user_role === 2

      // 查询相关订单
      let whereCondition = {}
      if (isActor) {
        whereCondition.receiver_id = userId
      } else {
        whereCondition.publisher_id = userId
      }
      whereCondition.order_status = dbCmd.in([3, 4]) // 已完成或已取消

      const ordersRes = await db.collection('orders')
        .where(whereCondition)
        .orderBy('update_time', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()

      // 构建信用记录
      const records = ordersRes.data.map(order => {
        let change = 0
        let reason = ''

        if (order.order_status === 3) {
          // 完成订单
          change = isActor ? 5 : 2
          reason = '完成订单'

          // 检查评价
          const rating = isActor ? order.publisher_rating : order.receiver_rating
          if (rating && rating.score) {
            if (rating.score >= 4) {
              change += 2
              reason += ',获得好评'
            } else if (rating.score <= 2) {
              change -= 2
              reason += ',获得差评'
            }
          }

          // 检查迟到(演员)
          if (isActor && order.arrive_time && order.meeting_time) {
            if (order.arrive_time > order.meeting_time) {
              const lateMinutes = Math.floor((order.arrive_time - order.meeting_time) / 60000)
              if (lateMinutes > 5) {
                const deduct = Math.min(Math.floor(lateMinutes / 5), 10)
                change -= deduct
                reason += `,迟到${lateMinutes}分钟`
              }
            }
          }

        } else if (order.order_status === 4) {
          // 取消订单
          if (order.cancel_by === userId) {
            if (order.receiver_id && !isActor) {
              change = -5
              reason = '取消已接单订单'
            } else {
              change = 0
              reason = '取消待接单订单'
            }
          } else {
            change = 0
            reason = '订单被对方取消'
          }
        }

        return {
          order_id: order._id,
          change: change,
          reason: reason,
          create_time: order.update_time || order.finish_time || order.cancel_time
        }
      })

      const countRes = await db.collection('orders')
        .where(whereCondition)
        .count()

      return {
        code: 0,
        data: {
          list: records,
          total: countRes.total,
          page,
          pageSize,
          current_score: isActor ? user.credit_score_actor : user.credit_score_crew
        }
      }

    } catch (error) {
      console.error('获取信用记录失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 上传视频模卡URL
   * @param {String} videoUrl 视频URL
   * @returns {Object} 操作结果
   */
  async setVideoCard(videoUrl) {
    try {
      if (!this.authInfo || !this.authInfo.uid) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      const userId = this.authInfo.uid

      if (!videoUrl) {
        return {
          code: 400,
          message: '视频URL不能为空'
        }
      }

      // 检查用户角色(必须是演员)
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

      if (userRes.data[0].user_role !== 2) {
        return {
          code: 403,
          message: '仅演员可以上传视频模卡'
        }
      }

      await db.collection('uni-id-users')
        .doc(userId)
        .update({
          video_card_url: videoUrl,
          update_time: Date.now()
        })

      return {
        code: 0,
        message: '视频模卡设置成功'
      }

    } catch (error) {
      console.error('设置视频模卡失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 提交认证申请
   * @param {String} type 认证类型: student/enterprise
   * @param {Object} data 认证数据
   * @returns {Object} 操作结果
   */
  async submitVerification(type, data) {
    try {
      if (!this.authInfo || !this.authInfo.uid) {
        return {
          code: 401,
          message: '请先登录'
        }
      }

      const userId = this.authInfo.uid

      if (!['student', 'enterprise'].includes(type)) {
        return {
          code: 400,
          message: '认证类型无效'
        }
      }

      // 检查当前认证状态
      const userRes = await db.collection('uni-id-users')
        .doc(userId)
        .field({ auth_status: true, user_role: true })
        .get()

      if (!userRes.data || userRes.data.length === 0) {
        return {
          code: 404,
          message: '用户不存在'
        }
      }

      const user = userRes.data[0]

      if (user.auth_status === 2) {
        return {
          code: 400,
          message: '您已完成认证'
        }
      }

      if (user.auth_status === 1) {
        return {
          code: 400,
          message: '认证审核中,请耐心等待'
        }
      }

      // 校验认证数据
      if (type === 'student') {
        if (!data.real_name || !data.id_number || !data.school_name) {
          return {
            code: 400,
            message: '请填写完整的学生认证信息'
          }
        }
      } else if (type === 'enterprise') {
        if (!data.company_name || !data.license_number || !data.license_image) {
          return {
            code: 400,
            message: '请填写完整的企业认证信息'
          }
        }
      }

      // 更新认证状态
      await db.collection('uni-id-users')
        .doc(userId)
        .update({
          auth_status: 1, // 审核中
          verify_info: {
            type: type,
            data: data,
            submit_time: Date.now()
          },
          update_time: Date.now()
        })

      return {
        code: 0,
        message: '认证申请已提交,请等待审核'
      }

    } catch (error) {
      console.error('提交认证失败:', error)
      return {
        code: 500,
        message: error.message || '系统错误'
      }
    }
  },

  /**
   * 获取认证状态文本
   * @param {Number} status 认证状态
   * @returns {String} 状态文本
   */
  _getAuthStatusText(status) {
    const statusMap = {
      0: '未认证',
      1: '审核中',
      2: '已认证',
      3: '认证失败'
    }
    return statusMap[status] || '未知'
  }
}
