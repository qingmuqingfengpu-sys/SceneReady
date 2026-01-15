'use strict';

// 高德地图Web服务API密钥
const AMAP_KEY = '82a78366e16299466ec46f919fde5506'

exports.main = async (event, context) => {
  const { action, latitude, longitude, address, city } = event

  try {
    switch (action) {
      // 逆地理编码 (坐标转地址)
      case 'regeo':
        return await regeoCode(longitude, latitude)

      // 地理编码 (地址转坐标)
      case 'geo':
        return await geoCode(address, city)

      // 地址搜索
      case 'search':
        return await searchPlace(event.keywords, event.city)

      default:
        return {
          code: 400,
          message: '不支持的操作类型'
        }
    }
  } catch (error) {
    console.error('地理服务错误:', error)
    return {
      code: 500,
      message: error.message || '服务异常'
    }
  }
}

/**
 * 逆地理编码 - 坐标转地址
 * @param {Number} longitude 经度
 * @param {Number} latitude 纬度
 */
async function regeoCode(longitude, latitude) {
  try {
    const url = `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${longitude},${latitude}&extensions=all`

    const res = await uniCloud.httpclient.request(url, {
      method: 'GET',
      dataType: 'json'
    })

    if (res.status !== 200) {
      throw new Error('请求失败')
    }

    const data = res.data

    if (data.status === '1' && data.regeocode) {
      const regeocode = data.regeocode
      const addressComponent = regeocode.addressComponent

      return {
        code: 0,
        data: {
          name: regeocode.formatted_address || '',
          address: regeocode.formatted_address || '',
          province: addressComponent.province || '',
          city: addressComponent.city || addressComponent.province || '',
          district: addressComponent.district || '',
          township: addressComponent.township || '',
          street: addressComponent.streetNumber ?
            `${addressComponent.streetNumber.street}${addressComponent.streetNumber.number}` : '',
          latitude: latitude,
          longitude: longitude,
          // 附加POI信息
          pois: regeocode.pois ? regeocode.pois.slice(0, 5).map(poi => ({
            name: poi.name,
            type: poi.type,
            distance: poi.distance
          })) : []
        }
      }
    } else {
      throw new Error(data.info || '逆地理编码失败')
    }
  } catch (error) {
    console.error('逆地理编码失败:', error)
    return {
      code: 500,
      message: error.message || '逆地理编码失败',
      data: {
        name: `位置 (${longitude}, ${latitude})`,
        address: `经度: ${longitude}, 纬度: ${latitude}`,
        latitude: latitude,
        longitude: longitude
      }
    }
  }
}

/**
 * 地理编码 - 地址转坐标
 * @param {String} address 地址
 * @param {String} city 城市
 */
async function geoCode(address, city = '') {
  try {
    let url = `https://restapi.amap.com/v3/geocode/geo?key=${AMAP_KEY}&address=${encodeURIComponent(address)}`
    if (city) {
      url += `&city=${encodeURIComponent(city)}`
    }

    const res = await uniCloud.httpclient.request(url, {
      method: 'GET',
      dataType: 'json'
    })

    if (res.status !== 200) {
      throw new Error('请求失败')
    }

    const data = res.data

    if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
      const geocode = data.geocodes[0]
      const location = geocode.location.split(',')

      return {
        code: 0,
        data: {
          name: geocode.formatted_address || address,
          address: geocode.formatted_address || address,
          province: geocode.province || '',
          city: geocode.city || '',
          district: geocode.district || '',
          longitude: parseFloat(location[0]),
          latitude: parseFloat(location[1]),
          level: geocode.level || ''
        }
      }
    } else {
      throw new Error(data.info || '地理编码失败')
    }
  } catch (error) {
    console.error('地理编码失败:', error)
    return {
      code: 500,
      message: error.message || '地理编码失败'
    }
  }
}

/**
 * 地址搜索
 * @param {String} keywords 关键词
 * @param {String} city 城市
 */
async function searchPlace(keywords, city = '') {
  try {
    let url = `https://restapi.amap.com/v3/place/text?key=${AMAP_KEY}&keywords=${encodeURIComponent(keywords)}&offset=20`
    if (city) {
      url += `&city=${encodeURIComponent(city)}`
    }

    const res = await uniCloud.httpclient.request(url, {
      method: 'GET',
      dataType: 'json'
    })

    if (res.status !== 200) {
      throw new Error('请求失败')
    }

    const data = res.data

    if (data.status === '1' && data.pois) {
      const places = data.pois.map(poi => {
        const location = poi.location.split(',')
        return {
          name: poi.name || '',
          address: poi.address || '',
          type: poi.type || '',
          longitude: parseFloat(location[0]),
          latitude: parseFloat(location[1]),
          district: poi.adname || '',
          city: poi.cityname || ''
        }
      })

      return {
        code: 0,
        data: places
      }
    } else {
      throw new Error(data.info || '搜索失败')
    }
  } catch (error) {
    console.error('地址搜索失败:', error)
    return {
      code: 500,
      message: error.message || '搜索失败'
    }
  }
}
