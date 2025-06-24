import EbonyGalore from './adapters/EbonyGalore.js'
import HttpClient from './HttpClient.js'

const test = async () => {
  try {
    const httpClient = new HttpClient({})
    const adapter = new EbonyGalore(httpClient)
    const result = await adapter.find({ query: { search: 'ebony' } })
    console.log('EbonyGalore result:', result)
  } catch (err) {
    console.error('Error testing EbonyGalore adapter:', err)
  }
}

test()
