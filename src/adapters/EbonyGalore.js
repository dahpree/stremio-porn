import BaseAdapter from './BaseAdapter.js'
import cheerio from 'cheerio'

class EbonyGalore extends BaseAdapter {
  static DISPLAY_NAME = 'EbonyGalore'
  static SUPPORTED_TYPES = ['movie']

  async find({ query }) {
    const search = query.search || ''
    const url = `https://www.ebonygalore.com/search/${encodeURIComponent(search)}/`

    const html = await this._getHtml(url)
    const $ = cheerio.load(html)
    const items = []

    $('.item').each((i, el) => {
      const anchor = $(el).find('a')
      const href = anchor.attr('href')
      const title = anchor.attr('title') || $(el).find('.video-title').text().trim()
      const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src')
      const id = href?.split('/video/')[1]?.split('/')[0]

      if (id) {
        items.push({
          id,
          type: 'movie',
          name: title,
          poster: img,
        })
      }
    })

    return items
  }

  async getItem({ id }) {
    const url = `https://www.ebonygalore.com/video/${id}/`
    const html = await this._getHtml(url)
    const $ = cheerio.load(html)

    const title = $('h1').text().trim()
    const poster = $('video').attr('poster') || $('meta[property="og:image"]').attr('content')
    const videoUrl = $('video source').attr('src')

    return {
      id,
      type: 'movie',
      name: title,
      poster,
      background: poster,
      videos: videoUrl ? [{ url: videoUrl }] : [],
    }
  }

  async getStreams({ id }) {
    const url = `https://www.ebonygalore.com/video/${id}/`
    const html = await this._getHtml(url)
    const $ = cheerio.load(html)

    const videoUrl = $('video source').attr('src')
    return videoUrl ? [{ url: videoUrl }] : []
  }
}

export default EbonyGalore
