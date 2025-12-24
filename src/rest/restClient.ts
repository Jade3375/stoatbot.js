import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { BaseClient } from "../client/baseClient";
import { apiUrl, DEFAULT_CLIENT_OPTIONS } from "../utils";
import { version } from "../../package.json";
import { RateLimitQueue } from "./restUtils/rateLimitQueue";
import { ApiDiscoveryResponse } from "../utils/types";

export class RestClient {
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
    body?: any,
    query?: Record<string, string | number>,
    retry?: boolean,
  ): Promise<T> {
    try {
      if (!this.client.token) throw new Error("Token is required");

      const authHeader = this.client.bot ? "X-Bot-Token" : "X-Session-Token";
      const config: AxiosRequestConfig & { url: string } = {
        ...{
          method,
          url: `${this.client.options.rest?.instanceURL ? this.client.options.rest?.instanceURL : apiUrl}${url}`,
          params: query,
          data: body?.body,
          headers: {
            [authHeader]: this.client.token,
            "User-Agent": `RevBot.js/${version}`,
          },
        },
        url: `${this.client.options.rest?.instanceURL ? this.client.options.rest?.instanceURL : apiUrl}${url}`,
      };

      // Use the rate limit queue for all requests
      const response: AxiosResponse<T> =
        await this.rateLimitQueue.request<T>(config);
      return response.data;
    } catch (error) {
      if (retry) throw typeof error;
      if (error instanceof AxiosError) {
        if (error.status && (error.status === 429 || error.status >= 500)) {
          return this.retryRequest<T>(0, method, url, body, query);
        }
        if (error.status) {
          if (process.env.NODE_ENV === "test") {
            console.error("Error details:", error);
            console.error("Error response data:", error.response?.data);
            console.error("Error request config:", error.config);
            console.error("Error message:", error.message);
            console.error("Error URL:", url);
          }
          throw new Error(
            `API call failed with status ${error.status}: ${error.response?.statusText}`,
          );
        }
      }
      throw new Error(
        `API call failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async getConfig(): Promise<void> {
    try {
      const response: AxiosResponse<ApiDiscoveryResponse> = await axios.get(
        `${this.client.options.rest?.instanceURL ? this.client.options.rest?.instanceURL : apiUrl}/`,
      );
      const config = response.data;

      this.client.options.rest = {
        ...this.client.options.rest,
        instanceCDNURL: config.features.autumn.url,
      };
      this.client.options.ws = {
        ...this.client.options.ws,
        instanceURL: config.ws,
      };
    } catch (error) {
      console.error("Failed to fetch configuration:", error);
      process.exit(1);
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
   * GET request.
   * @param url The URL for the request.
   * @param query Query parameters (if applicable).
   * @returns The API response.
   */
  async get<T>(
    url: string,
    query?: Record<string, string | number>,
  ): Promise<T> {
    return this.request<T>("GET", url, undefined, query);
  }

  /**
   * POST request.
   * @param url The URL for the request.
   * @param body The request body.
   * @param query Query parameters (if applicable).
   * @returns The API response.
   */
  async post<T>(
    url: string,
    body: any,
    query?: Record<string, string | number>,
  ): Promise<T> {
    return this.request<T>("POST", url, body, query);
  }

  /**
   * PATCH request.
   * @param url The URL for the request.
   * @param body The request body.
   * @param query Query parameters (if applicable).
   * @returns The API response.
   */
  async patch<T>(
    url: string,
    body: any,
    query?: Record<string, string | number>,
  ): Promise<T> {
    return this.request<T>("PATCH", url, body, query);
  }

  /**
   * PUT request.
   * @param url The URL for the request.
   * @param body The request body.
   * @param query Query parameters (if applicable).
   * @returns The API response.
   */
  async put<T>(
    url: string,
    body?: any,
    query?: Record<string, string | number>,
  ): Promise<T> {
    return this.request<T>("PUT", url, body, query);
  }

  /**
   * DELETE request.
   * @param url The URL for the request.
   * @param query Query parameters (if applicable).
   * @returns The API response.
   */
  async delete<T>(
    url: string,
    body?: any,
    query?: Record<string, string | number>,
  ): Promise<T> {
    return this.request<T>("DELETE", url, body, query);
  }
}
