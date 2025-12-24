import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { BaseClient } from "../client/baseClient";
import { DEFAULT_CLIENT_OPTIONS } from "../utils";
import { version } from "../../package.json";
import FormData from "form-data";
import { RateLimitQueue } from "./restUtils/rateLimitQueue";
export class CDNClient {
  private rateLimitQueue = new RateLimitQueue();
  constructor(private readonly client: BaseClient) {}

  /**
   * Helper function to handle API requests.
   * @param method The HTTP method (GET, POST, PATCH, PUT, DELETE).
   * @param url The URL for the request.
   * @param body The request body (if applicable).
   * @param query Query parameters (if applicable).
   * @returns The API response.
   */
  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    url: string,
    data: FormData,
    query?: Record<string, string | number>,
    retry?: boolean,
  ): Promise<T> {
    try {
      if (!this.client.token) throw new Error("Token is required");

      const authHeader = this.client.bot ? "X-Bot-Token" : "X-Session-Token";
      const config: AxiosRequestConfig & { url: string } = {
        ...{
          method,
          url: `${this.client.options.rest?.instanceCDNURL}${url}`,
          params: query,
          data,
          maxBodyLength: Infinity,
          headers: {
            [authHeader]: this.client.token,
            "Content-Type": "multipart/form-data",
            "User-Agent": `StoatBot.js/${version}`,
            ...data.getHeaders(),
          },
        },
        url: `${this.client.options.rest?.instanceCDNURL}${url}`,
      };

      // Use the rate limit queue for all requests
      const response: AxiosResponse<T> =
        await this.rateLimitQueue.request<T>(config);
      return response.data;
    } catch (error) {
      if (retry) throw typeof error;
      if (error instanceof AxiosError) {
        if (error.status && (error.status === 429 || error.status >= 500)) {
          return this.retryRequest<T>(0, method, url, data, query);
        }
        if (error.status) {
          console.error(`API call failed with status ${error.status}:`, error);
          throw new Error(
            `API call failed with status ${error.status}: ${error.message}`,
          );
        }
      }
      throw new Error(
        `API call failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async retryRequest<T>(
    attempt: number = 0,
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    url: string,
    body?: any,
    query?: Record<string, string | number>,
  ): Promise<T> {
    if (attempt >= (this.client.options.rest?.retries ?? 3)) {
      throw new Error("Max retries reached");
    }

    try {
      return await this.request<T>(method, url, body, query, true);
    } catch (error) {
      console.warn(`Attempt ${attempt + 1} failed:`, error);
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          this.client.options.rest?.timeout ??
            DEFAULT_CLIENT_OPTIONS.rest?.timeout,
        ),
      );
      return this.retryRequest<T>(attempt + 1, method, url, body, query);
    }
  }
  /**
   * POST request.
   * @param url The URL for the request.
   * @param data The request body.
   * @returns The API response.
   */
  async post<T>(url: string, data: FormData): Promise<T> {
    return this.request<T>("POST", url, data);
  }
}
