import BaseAdapter from './BaseAdapter.js'
import cheerio from 'cheerio'

class TastyBlacks extends BaseAdapter {
  static DISPLAY_NAME = 'TastyBlacks'
  static ITEMS_PER_PAGE = 24
  static VIDEO_ID_PARAMETER = 'id'

  _makeMethodUrl(method) {
    const base = 'https://www.tastyblacks.com'

    if (method === 'searchVideos') return `${base}/search?search_query=`
    if (method === 'getVideoById') return `${base}/video/`

    throw new Error(`Unsupported method: ${method}`)
  }

  _makeEmbedUrl(id) {
    return `https://www.tastyblacks.com/embed/${id}`
  }

  _extractStreamsFromEmbed(body) {
    const match = body.match(/"video_url"\s*:\s*"([^"]+)"/)
    if (!match) throw new Error('Could not extract stream URL')
    return [{ url: match[1] }]
  }

  async searchVideos(query, page = 1) {
    const url = `${this._makeMethodUrl('searchVideos')}${encodeURIComponent(query)}&page=${page}`
    const res = await this._fetch(url)
    const $ = cheerio.load(res.body)

    const items = []
    $('.video-item').each((_, el) => {
      const anchor = $(el).find('a').attr('href')
      const title = $(el).find('.title').text().trim()
      const img = $(el).find('img').attr('src')
      const id = anchor?.split('/video/')[1]?.split('/')[0]

      if (id) {
        items.push({
          id,
          name: title,
          poster: img,
          type: 'movie'
        })
      }
    })

    return items
  }

  async getVideoById(id) {
    const url = `${this._makeMethodUrl('getVideoById')}${id}`
    const res = await this._fetch(url)
    const streams = this._extractStreamsFromEmbed(res.body)

    return {
      id,
      streams
    }
  }
}

export default TastyBlacks
