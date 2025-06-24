import BaseAdapter from './BaseAdapter.js'
import cheerio from 'cheerio'

class TastyBlacks extends BaseAdapter {
  static DISPLAY_NAME = 'TastyBlacks'
  static SUPPORTED_TYPES = ['movie']
  static ITEMS_PER_PAGE = 24

  async find({ query }) {
    const search = (query.search || '').toLowerCase().replace(/\s+/g, '-')
    const category = query.category || 'ebony'
    const sort = query.sort || 'new'
    const length = query.length || '' // use 'long' or leave blank

    const url = `https://tastyblacks.com/en/13/${category}/${length}/${sort}/`

    const html = await this._getHtml(url)
    const $ = cheerio.load(html)
    const items = []

    $('.video').each((i, el) => {
      const title = $(el).find('.video-title').text().trim()
      const href = $(el).find('a').attr('href')
      const id = href?.split('/video/')[1]?.split('/')[0]
      const poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src')

      if (id) {
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
    const url = `https://www.tastyblacks.com/video/${id}/`
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
    const url = `https://www.tastyblacks.com/video/${id}/`
    const html = await this._getHtml(url)
    const $ = cheerio.load(html)

    const videoUrl = $('video source').attr('src')

    return videoUrl ? [{ url: videoUrl }] : []
  }
}

export default TastyBlacks
