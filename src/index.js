import http from 'http'
import Stremio from 'stremio-addons'
import serveStatic from 'serve-static'
import chalk from 'chalk'
import PornClient from './PornClient.js'


const SUPPORTED_METHODS = [
  'stream.find', 'meta.find', 'meta.search', 'meta.get',
]
const STATIC_DIR = 'static'
const DEFAULT_ID = 'stremio_porn'

const ID = 'giftedpotentials-addon'
const ENDPOINT = 'https://stremio-porn-jrm3.onrender.com'
const PORT = process.env.STREMIO_PORN_PORT || process.env.PORT || '80'
const PROXY = process.env.STREMIO_PORN_PROXY || process.env.HTTPS_PROXY
const CACHE = process.env.STREMIO_PORN_CACHE || process.env.REDIS_URL || '1'
const EMAIL = process.env.STREMIO_PORN_EMAIL || process.env.EMAIL
const IS_PROD = process.env.NODE_ENV === 'production'


let availableSites = PornClient.ADAPTERS.map((a) => a.DISPLAY_NAME).join(', ')

const MANIFEST = {
  name: 'Porn',
  id: ID,
  version: "0.0.4", // ← hardcoded manually
  description: `\
Time to unsheathe your sword! \
Watch porn videos and webcam streams from ${availableSites}\
`,
  types: ['movie', 'tv'],
  idProperty: PornClient.ID,
  dontAnnounce: !IS_PROD,
  sorts: PornClient.SORTS,
  // The docs mention `contactEmail`, but the template uses `email`
  email: EMAIL,
  contactEmail: EMAIL,
  endpoint: `${ENDPOINT}/stremioget/stremio/v1`,
  logo: `${ENDPOINT}/logo.png`,
  icon: `${ENDPOINT}/logo.png`,
  background: `${ENDPOINT}/bg.jpg`,
  // OBSOLETE: used in pre-4.0 stremio instead of idProperty/types
  filter: {
    [`query.${PornClient.ID}`]: { $exists: true },
    'query.type': { $in: ['movie', 'tv'] },
  },
}


function makeMethod(client, methodName) {
  return async (request, cb) => {
    let response
    let error

    try {
      response = await client.invokeMethod(methodName, request)
    } catch (err) {
      error = err

      /* eslint-disable no-console */
      console.error(
        // eslint-disable-next-line prefer-template
        chalk.gray(new Date().toLocaleString()) +
        ' An error has occurred while processing ' +
        `the following request to ${methodName}:`
      )
      console.error(request)
      console.error(err)
      /* eslint-enable no-console */
    }

    cb(error, response)
  }
}

function makeMethods(client, methodNames) {
  return methodNames.reduce((methods, methodName) => {
    methods[methodName] = makeMethod(client, methodName)
    return methods
  }, {})
}


let client = new PornClient({ proxy: PROXY, cache: CACHE })
let methods = makeMethods(client, SUPPORTED_METHODS)
let addon = new Stremio.Server(methods, MANIFEST)
let server = http.createServer((req, res) => {
  serveStatic(STATIC_DIR)(req, res, () => {
    addon.middleware(req, res, () => res.end())
  })
})

server
  .on('listening', () => {
    let values = {
      endpoint: chalk.green(MANIFEST.endpoint),
      id: ID === DEFAULT_ID ? chalk.red(ID) : chalk.green(ID),
      email: EMAIL ? chalk.green(EMAIL) : chalk.red('undefined'),
      env: IS_PROD ? chalk.green('production') : chalk.green('development'),
      proxy: PROXY ? chalk.green(PROXY) : chalk.red('off'),
      cache: (CACHE === '0') ?
        chalk.red('off') :
        chalk.green(CACHE === '1' ? 'on' : CACHE),
    }

    // eslint-disable-next-line no-console
    console.log(`
    ${MANIFEST.name} Addon is listening on port ${PORT}

    Endpoint:    ${values.endpoint}
    Addon Id:    ${values.id}
    Email:       ${values.email}
    Environment: ${values.env}
    Proxy:       ${values.proxy}
    Cache:       ${values.cache}
    `)
  })
  .listen(PORT)


export default server

