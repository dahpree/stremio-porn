import cacheManager from 'cache-manager'
import redisStore from 'cache-manager-redis-store'
import HttpClient from './HttpClient.js'
import TastyBlacks from './adapters/TastyBlacks.js'
import PornHub from './adapters/PornHub.js'
import PornHub from './adapters/PornHub.js'
import RedTube from './adapters/RedTube.js'
import YouPorn from './adapters/YouPorn.js'
import SpankWire from './adapters/SpankWire.js'
import PornCom from './adapters/PornCom.js'
import Chaturbate from './adapters/Chaturbate.js'

// EPorner has restricted video downloads to 30 per day per guest
// import EPorner from './adapters/EPorner'


const ID = 'porn_id'
const SORT_PROP_PREFIX = 'popularities.porn.'
const CACHE_PREFIX = 'stremio-porn|'
// Making multiple requests to multiple adapters for different types
// and then aggregating them is a lot of work,
// so we only support 1 adapter per request for now.
const MAX_ADAPTERS_PER_REQUEST = 1
const ADAPTERS = [TastyBlacks, PornHub, RedTube, YouPorn, SpankWire, PornCom, Chaturbate]
const SORTS = ADAPTERS.map(({ name, DISPLAY_NAME, SUPPORTED_TYPES }) => ({
  name: `Porn: ${DISPLAY_NAME}`,
  prop: `${SORT_PROP_PREFIX}${name}`,
  types: SUPPORTED_TYPES,
}))
const METHODS = {
  'stream.find': {
    adapterMethod: 'getStreams',
    cacheTtl: 300,
    idProp: ID,
    expectsArray: true,
  },
  'meta.find': {
    adapterMethod: 'find',
    cacheTtl: 300,
    idProp: 'id',
    expectsArray: true,
  },
  'meta.search': {
    adapterMethod: 'find',
    cacheTtl: 3600,
    idProp: 'id',
    expectsArray: true,
  },
  'meta.get': {
    adapterMethod: 'getItem',
    cacheTtl: 300,
    idProp: 'id',
    expectsArray: false,
  },
}


function makePornId(adapter, type, id) {
  return `${ID}:${adapter}-${type}-${id}`
}

function parsePornId(pornId) {
  let [adapter, type, id] = pornId.split(':').pop().split('-')
  return { adapter, type, id }
}

function normalizeRequest(request) {
  let { query, sort, limit, skip } = request
  let adapters = []

  if (sort) {
    adapters = Object.keys(sort)
      .filter((p) => p.startsWith(SORT_PROP_PREFIX))
      .map((p) => p.slice(SORT_PROP_PREFIX.length))
  }

  if (typeof query === 'string') {
    query = { search: query }
  } else if (query) {
    query = { ...query }
  } else {
    query = {}
  }

  if (query.porn_id) {
    let { adapter, type, id } = parsePornId(query.porn_id)

    if (type && query.type && type !== query.type) {
      throw new Error(
        `Request query and porn_id types do not match (${type}, ${query.type})`
      )
    }

    if (adapters.length && !adapters.includes(adapter)) {
      throw new Error(
        `Request sort and porn_id adapters do not match (${adapter})`
      )
    }

    adapters = [adapter]
    query.type = type
    query.id = id
  }

  return { query, adapters, skip, limit }
}

function normalizeResult(adapter, item, idProp = 'id') {
  let newItem = { ...item }
  newItem[idProp] = makePornId(adapter.constructor.name, item.type, item.id)
  return newItem
}

function mergeResults(results) {
  // TODO: limit
  return results.reduce((results, adapterResults) => {
    results.push(...adapterResults)
    return results
  }, [])
}


class PornClient {
  static ID = ID
  static ADAPTERS = ADAPTERS
  static SORTS = SORTS

  constructor(options) {
    let httpClient = new HttpClient(options)
    this.adapters = ADAPTERS.map((Adapter) => new Adapter(httpClient))

    if (options.cache === '1') {
      this.cache = cacheManager.caching({ store: 'memory' })
    } else if (options.cache && options.cache !== '0') {
      this.cache = cacheManager.caching({
        store: redisStore,
        url: options.cache,
      })
    }
  }

  _getAdaptersForRequest(request) {
    let { query, adapters } = request
    let { type } = query
    let matchingAdapters = this.adapters

    if (adapters.length) {
      matchingAdapters = matchingAdapters.filter((adapter) => {
        return adapters.includes(adapter.constructor.name)
      })
    }

    if (type) {
      matchingAdapters = matchingAdapters.filter((adapter) => {
        return adapter.constructor.SUPPORTED_TYPES.includes(type)
      })
    }

    return matchingAdapters.slice(0, MAX_ADAPTERS_PER_REQUEST)
  }

  async _invokeAdapterMethod(adapter, method, request, idProp) {
    let results = await adapter[method](request)
    return results.map((result) => {
      return normalizeResult(adapter, result, idProp)
    })
  }

  // Aggregate method that dispatches requests to matching adapters
  async _invokeMethod(methodName, rawRequest, idProp) {
    let request = normalizeRequest(rawRequest)
    let adapters = this._getAdaptersForRequest(request)

    if (!adapters.length) {
      throw new Error('Couldn\'t find suitable adapters for a request')
    }

    let results = []

    for (let adapter of adapters) {
      let adapterResults = await this._invokeAdapterMethod(
        adapter, methodName, request, idProp
      )
      results.push(adapterResults)
    }

    return mergeResults(results, request.limit)
  }

  // This is a public wrapper around the private method
  // that implements caching and result normalization
  async invokeMethod(methodName, rawRequest) {
    let { adapterMethod, cacheTtl, idProp, expectsArray } = METHODS[methodName]
    let invokeMethod = async () => {
      let result = await this._invokeMethod(adapterMethod, rawRequest, idProp)
      result = expectsArray ? result : result[0]
      return result
    }

    if (this.cache) {
      let cacheKey = CACHE_PREFIX + JSON.stringify(rawRequest)
      let cacheOptions = {
        ttl: cacheTtl,
      }
      return this.cache.wrap(cacheKey, invokeMethod, cacheOptions)
    } else {
      return invokeMethod()
    }
  }
}


export default PornClient
