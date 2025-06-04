/**
 * Request queue to prevent rate limiting by controlling concurrent requests
 */
class RequestQueue {
  private queue: Array<() => Promise<any>> = []
  private processing = false
  private lastRequestTime = 0
  private readonly minInterval = 50 // Reduced from 100ms to 50ms for better performance
  private readonly maxConcurrent = 5 // Maximum concurrent requests
  private activeRequests = 0

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          this.activeRequests++
          const result = await request()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.activeRequests--
        }
      })
      
      this.processQueue()
    })
  }

  /**
   * Add multiple requests to be processed in batch
   * @param requests Array of request functions
   * @returns Promise that resolves to array of results
   */
  async addBatch<T>(requests: Array<() => Promise<T>>): Promise<T[]> {
    const promises = requests.map(request => this.add(request))
    return Promise.all(promises)
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0) {
      // Wait if we've hit the concurrent request limit
      if (this.activeRequests >= this.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 10))
        continue
      }

      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime
      
      if (timeSinceLastRequest < this.minInterval) {
        await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastRequest))
      }

      const request = this.queue.shift()
      if (request) {
        this.lastRequestTime = Date.now()
        // Don't await here to allow concurrent processing
        request().catch(error => {
          console.error('Request queue error:', error)
        })
      }
    }

    this.processing = false
  }
}

export const requestQueue = new RequestQueue()