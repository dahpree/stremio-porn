import Bottleneck from 'bottleneck'


// Contains some common methods as well as public wrappers
// that prepare requests, redirect them to private methods
// and normalize results
class BaseAdapter {
  static SUPPORTED_TYPES = []
  static MAX_RESULTS_PER_REQUEST = 100
  static MAX_CONCURRENT_REQUESTS = 3

  constructor(httpClient) {
    this.httpClient = httpClient
    this.scheduler = new Bottleneck({
      maxConcurrent: this.constructor.MAX_CONCURRENT_REQUESTS,
    })
  }

  _normalizeItem(item) {
    return item
  }

  _normalizeStream(stream) {
    if (stream.name) {
      return stream
    } else {
      return { ...stream, name: this.constructor.name }
    }
  }

  _paginate(request) {
    let itemsPerPage = this.constructor.ITEMS_PER_PAGE || Infinity
    let { skip = 0, limit = itemsPerPage } = request
    limit = Math.min(limit, this.constructor.MAX_RESULTS_PER_REQUEST)
    itemsPerPage = Math.min(itemsPerPage, limit)

    let firstPage = Math.ceil((skip + 0.1) / itemsPerPage) || 1
    let pageCount = Math.ceil(limit / itemsPerPage)
    let pages = []

    for (let i = firstPage; pages.length < pageCount; i++) {
      pages.push(i)
    }

    return {
      pages, skip, limit,
      skipOnFirstPage: skip % itemsPerPage,
    }
  }

  _validateRequest(request, typeRequired) {
    let { SUPPORTED_TYPES } = this.constructor

    if (typeof request !== 'object') {
      throw new Error(`A request must be an object, ${typeof request} given`)
    }

    if (!request.query) {
      throw new Error('Request query must not be empty')
    }

    if (typeRequired && !request.query.type) {
      throw new Error('Content type must be specified')
    }

    if (request.query.type && !SUPPORTED_TYPES.includes(request.query.type)) {
      throw new Error(`Content type ${request.query.type} is not supported`)
    }
  }

  async _find(query, pagination) {
    let { pages, limit, skipOnFirstPage } = pagination
    let requests = pages.map((page) => {
      return this._findByPage(query, page)
    })

    let results = await Promise.all(requests)
    results = [].concat(...results).filter((item) => item)
    return results.slice(skipOnFirstPage, skipOnFirstPage + limit)
  }

  async find(request) {
    this._validateRequest(request)

    let pagination = this._paginate(request)
    let { query } = request

    if (!query.type) {
      query = {
        ...query,
        type: this.constructor.SUPPORTED_TYPES[0],
      }
    }

    let results = await this.scheduler.schedule(() => {
      return this._find(query, pagination)
    })

    if (results) {
      return results.map((item) => this._normalizeItem(item))
    } else {
      return []
    }
  }

  async getItem(request) {
    this._validateRequest(request, true)

    let { type, id } = request.query
    let result = await this.scheduler.schedule(() => {
      return this._getItem(type, id)
    })
    return result ? [this._normalizeItem(result)] : []
  }

  async getStreams(request) {
    this._validateRequest(request, true)

    let { type, id } = request.query
    let results = await this.scheduler.schedule(() => {
      return this._getStreams(type, id)
    })

    if (results) {
      return results.map((stream) => this._normalizeStream(stream))
    } else {
      return []
    }
  }
}


export default BaseAdapter
