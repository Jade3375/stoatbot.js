import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAfter: number; // epoch ms
  bucket: string;
  resetIn: number; // ms until reset
}

interface BucketState extends RateLimitInfo {
  queue: Array<() => void>;
  resetTimeout?: NodeJS.Timeout;
  lastPath: string;
}

export class RateLimitQueue {
  private bucketMap: Map<string, BucketState> = new Map();
  private pathToBucket: Map<string, string> = new Map();

  async request<T = any>(
    config: AxiosRequestConfig & { url: string },
  ): Promise<AxiosResponse<T>> {
    const path = config.url!;
    const bucketId = this.pathToBucket.get(path);
    let bucket = bucketId ? this.bucketMap.get(bucketId) : undefined;

    if (bucket && bucket.remaining <= 0 && Date.now() < bucket.resetAfter) {
      // Rate limited, queue the request
      return new Promise<AxiosResponse<T>>((resolve, reject) => {
        bucket!.queue.push(async () => {
          try {
            const res = await this._doRequest<T>(config, path);
            resolve(res);
          } catch (e) {
            console.error(e);
          }
        });
      });
    } else {
      // Not rate limited, do the request
      return this._doRequest<T>(config, path);
    }
  }

  private async _doRequest<T>(
    config: AxiosRequestConfig,
    path: string,
  ): Promise<AxiosResponse<T>> {
    const response = await axios(config);
    this._updateRateLimit(path, response);
    return response;
  }

  private _updateRateLimit(path: string, response: AxiosResponse) {
    const headers = response.headers;
    const limit = parseInt(headers["x-ratelimit-limit"]);
    const remaining = parseInt(headers["x-ratelimit-remaining"]);
    const resetAfter =
      parseFloat(headers["x-ratelimit-reset-after"]) * 1000 + Date.now();
    const bucket = headers["x-ratelimit-bucket"];
    const resetIn = parseInt(headers["x-ratelimit-reset-after"]);

    if (!bucket) return;
    this.pathToBucket.set(path, bucket);
    let state = this.bucketMap.get(bucket);
    if (!state) {
      state = {
        limit,
        remaining,
        resetAfter,
        bucket,
        resetIn,
        queue: [],
        lastPath: path,
      };
      this.bucketMap.set(bucket, state);
    } else {
      state.limit = limit;
      state.remaining = remaining;
      state.resetAfter = resetAfter;
      state.lastPath = path;
    }

    if (remaining <= 0) {
      if (state.resetTimeout) clearTimeout(state.resetTimeout);
      const delay = resetIn;
      state.resetTimeout = setTimeout(() => {
        state.remaining = state.limit;
        state.resetTimeout = undefined;
        // Process queued requests
        while (state.queue.length > 0 && state.remaining > 0) {
          const fn = state.queue.shift();
          if (fn) {
            state.remaining--;
            fn();
          }
        }
      }, delay);
    }
  }
}
