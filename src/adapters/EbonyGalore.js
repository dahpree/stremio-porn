import BaseAdapter from './BaseAdapter.js'
import cheerio from 'cheerio'

class EbonyGalore extends BaseAdapter {
  static DISPLAY_NAME = 'EbonyGalore'
  static SUPPORTED_TYPES = ['movie']
  static ITEMS_PER_PAGE = 24

  async find({ query }) {
    const search = query.search || ''
    const url = `https://www.ebonygalore.com/search/${encodeURIComponent(search)}/latest/`

    const html = await this._getHtml(url)
    const $ = cheerio.load(html)
    const items = []

    $('.thumb').each((i, el) => {
      const aTag = $(el).find('a')
      const href = aTag.attr('href')
      const id = href?.split('/video/')[1]?.split('/')[0]
      const title = aTag.attr('title')?.trim()
      const poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src')

      if (id && title) {
        items.push({
          id,
          type: 'movie',
          name: title,
          poster,
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
    const poster = $('video').attr('poster')
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
