import cacheManager from 'cache-manager'
import redisStore from 'cache-manager-redis-store'
import HttpClient from './HttpClient.js'
import TastyBlacks from './adapters/TastyBlacks.js'
import PornHub from './adapters/PornHub.js'
import RedTube from './adapters/RedTube.js'
import YouPorn from './adapters/YouPorn.js'
import SpankWire from './adapters/SpankWire.js'
import PornCom from './adapters/PornCom.js'
import Chaturbate from './adapters/Chaturbate.js'

// const EPorner = ... (disabled to avoid limits)

const ID = 'porn_id'
const SORT_PROP_PREFIX = 'popularities.porn.'
const CACHE_PREFIX = 'stremio-porn|'
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
  const [adapter, type, id] = pornId.split(':').pop().split('-')
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
  } else {
    query = { ...query }
  }

  if (query.porn_id) {
    const { adapter, type, id } = parsePornId(query.porn_id)

    if (type && query.type && type !== query.type) {
      throw new Error(`Type mismatch: ${type} ≠ ${query.type}`)
    }

    if (adapters.length && !adapters.includes(adapter)) {
      throw new Error(`Sort/adapter mismatch: ${adapter}`)
    }

    adapters = [adapter]
    query.type = type
    query.id = id
  }

  return { query, adapters, skip, limit }
}

function normalizeResult(adapter, item, idProp = 'id') {
  const newItem = { ...item }
  newItem[idProp] = makePornId(adapter.constructor.name, item.type, item.id)
  return newItem
}

function mergeResults(results) {
  return results.reduce((acc, r) => {
    acc.push(...r)
    return acc
  }, [])
}

class PornClient {
  static ID = ID
  static ADAPTERS = ADAPTERS
  static SORTS = SORTS

  constructor(options) {
    const httpClient = new HttpClient(options)
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
    const { query, adapters } = request
    const { type } = query
    let matching = this.adapters

    if (adapters.length) {
      matching = matching.filter(a => adapters.includes(a.constructor.name))
    }

    if (type) {
      matching = matching.filter(a => a.constructor.SUPPORTED_TYPES.includes(type))
    }

    return matching.slice(0, MAX_ADAPTERS_PER_REQUEST)
  }

  async _invokeAdapterMethod(adapter, method, request, idProp) {
    const results = await adapter[method](request)
    return results.map(item => normalizeResult(adapter, item, idProp))
  }

  async _invokeMethod(methodName, rawRequest, idProp) {
    const request = normalizeRequest(rawRequest)
    const adapters = this._getAdaptersForRequest(request)

    if (!adapters.length) throw new Error("Couldn't find suitable adapters for a request")

    const results = []
    for (const adapter of adapters) {
      const res = await this._invokeAdapterMethod(adapter, methodName, request, idProp)
      results.push(res)
    }

    return mergeResults(results)
  }

  async invokeMethod(methodName, rawRequest) {
    const { adapterMethod, cacheTtl, idProp, expectsArray } = METHODS[methodName]
    const execute = async () => {
      let result = await this._invokeMethod(adapterMethod, rawRequest, idProp)
      return expectsArray ? result : result[0]
    }

    if (this.cache) {
      const key = CACHE_PREFIX + JSON.stringify(rawRequest)
      return this.cache.wrap(key, execute, { ttl: cacheTtl })
    }

    return execute()
  }
}

export default PornClient
