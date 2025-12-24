import { ChannelManager, ServerManager } from "../managers";
import { UserManager } from "../managers/userManager";
import { WebhookManager } from "../managers/webhookManager";
import { ClientUser } from "../struct/clientUser";
import { BaseClient } from "./baseClient";
import { EventManager } from "./events/eventManager";
import { WebSocketClient } from "./webSocket";

/**
 * Represents the main client for interacting with the API.
 *
 * @extends BaseClient
 */
export class client extends BaseClient {
  /** The WebSocket client used for real-time communication. */
  protected readonly ws = new WebSocketClient(this);

  /** Manages the channels in the client. */
  readonly channels = new ChannelManager(this);

  /** Manages the servers in the client. */
  readonly servers = new ServerManager(this);

  /** Manages the users in the client. */
  readonly users = new UserManager(this);

  /** Manages the events in the client. */
  readonly events = new EventManager(this);

  /** Manages the webhooks in the client. */
  readonly webhooks = new WebhookManager(this);

  /** The authenticated user, or `null` if not logged in. */
  user: ClientUser | null = null;

  /** The timestamp when the client became ready, or `null` if not ready. */
  readyAt: Date | null = null;

  /**
   * Initializes the client.
   * @private
   */
  async init(): Promise<void> {
    await this.api.getConfig();
  }

  /**
   * Gets the timestamp when the client became ready.
   *
   * @returns {number | null} The ready timestamp in milliseconds, or `null` if not ready.
   */
  get readyTimestamp(): number | null {
    return this.readyAt ? this.readyAt.getTime() : null;
  }

  /**
   * Gets the uptime of the client in milliseconds.
   *
   * @returns {number | null} The uptime in milliseconds, or `null` if the client is not ready.
   */
  get upTime(): number | null {
    return this.readyAt ? Date.now() - this.readyAt.getTime() : null;
  }

  /**
   * Logs the client into the API using the provided token.
   *
   * @param {string} token - The authentication token.
   * @returns {Promise<void>} A promise that resolves when the client is logged in.
   * @throws {Error} Throws an error if the token is not provided or if the WebSocket connection fails.
   *
   * @example
   * ```typescript
   * await client.login("your-token-here");
   * ```
   */
  async login(token: string): Promise<void> {
    if (!token) throw new Error("Token is required");

    this.token = token;

    this.debug("Logging in...");
    try {
      await this.ws.connect();
    } catch (error) {
      this.debug(`Error connecting to WebSocket: ${error}`);
      throw error;
    }

    this.readyAt = new Date();
  }

  /**
   * Destroys the client, disconnecting it from the API and clearing its state.
   *
   * @returns {Promise<void>} A promise that resolves when the client is destroyed.
   *
   * @example
   * ```typescript
   * await client.destroy();
   * ```
   */
  async destroy(): Promise<void> {
    this.token = null;
    this.user = null;
    this.readyAt = null;
    await this.ws.destroy(true);
  }

  /**
   * Checks if the client is ready.
   *
   * @returns {boolean} `true` if the client is ready, otherwise `false`.
   *
   * @example
   * ```typescript
   * if (client.isReady()) {
   *   console.log("Client is ready!");
   * }
   * ```
   */
  isReady(): boolean {
    return this.readyAt !== null;
  }
}
