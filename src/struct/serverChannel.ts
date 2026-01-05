import type { FieldsChannel } from "revolt-api";
import {
  Attachment,
  Category,
  Channel,
  Invite,
  MessageStruct,
  Server,
} from "./index";
import { client } from "../client/client";
import { FullPermissions } from "../utils/index";
import { APIServerChannel } from "../types";
import { MessageManager, MessageOptions } from "../managers";

export interface Overwrite {
  allow: FullPermissions;
  deny: FullPermissions;
}

/**
 * Represents a server channel, which can be a text or voice channel.
 *
 * @extends Channel
 */
export class ServerChannel extends Channel {
  /** The name of the channel. */
  name!: string;

  /** The ID of the server this channel belongs to. */
  serverId!: string;

  /** The description of the channel, or `null` if none is set. */
  description: string | null = null;

  /** The icon of the channel, or `null` if none is set. */
  icon: Attachment | null = null;

  /** Manages the messages in this Server channel. */
  messages = new MessageManager(this);

  /** The permission overwrites for the channel. */
  overwrites = new Map<string, Overwrite>();

  /** Whether the channel is marked as NSFW (Not Safe For Work). */
  nsfw = false;

  /**
   * Creates a new ServerChannel instance.
   *
   * @param {client} client - The client instance.
   * @param {APIServerChannel} data - The raw data for the server channel from the API.
   */
  constructor(client: client, data: APIServerChannel) {
    super(client);
    this._patch(data);
  }

  /**
   * Updates the server channel instance with new data from the API.
   *
   * @param {APIServerChannel} data - The raw data for the server channel from the API.
   * @param {FieldsChannel[]} [clear=[]] - Fields to clear in the channel.
   * @returns {this} The updated server channel instance.
   * @protected
   */
  protected _patch(data: APIServerChannel, clear: FieldsChannel[] = []): this {
    super._patch(data);

    if (data.name) this.name = data.name;

    if (data.server) this.serverId = data.server;

    if ("description" in data) this.description = data.description ?? null;

    if (data.icon) this.icon = new Attachment(this.client, data.icon);

    if (typeof data.nsfw === "boolean") this.nsfw = data.nsfw;

    if (data.role_permissions) {
      this.overwrites.clear();
      for (const [id, { a, d }] of Object.entries(data.role_permissions)) {
        this.overwrites.set(id, {
          allow: new FullPermissions(a),
          deny: new FullPermissions(d),
        });
      }
    }

    for (const field of clear) {
      if (field === "Icon") this.icon = null;
      if (field === "Description") this.description = null;
    }

    return this;
  }

  /**
   * Creates an invite for the server channel.
   *
   * @returns {Promise<Invite>} A promise that resolves with the created invite.
   *
   * @example
   * ```typescript
   * const invite = await serverChannel.createInvite();
   * console.log(`Invite created: ${invite}`);
   * ```
   */
  async createInvite(): Promise<Invite> {
    const data = await this.client.api.post(`/channels/${this.id}/invites`, {});
    return new Invite(
      this.client,
      data as
        | {
            type: "Server";
            _id: string;
            server: string;
            creator: string;
            channel: string;
          }
        | { type: "Group"; _id: string; creator: string; channel: string },
    );
  }

  //   iconURL(options?: { size: number }): string | null {
  //     return this.icon
  //       ? this.client.api.cdn.icon(this.icon.id, options?.size)
  //       : null;
  //   }

  /**
   * Retrieves the server this channel belongs to.
   *
   * @returns {Server} The server instance.
   */
  get server(): Server {
    return this.client.servers.cache.get(this.serverId)!;
  }

  /**
   * Sends a message to this Server channel.
   *
   * @param {MessageOptions | string} options - The message content or options for the message.
   * @returns {Promise<Message>} A promise that resolves with the sent message.
   *
   * @example
   * ```typescript
   * await serverChannel.send("Hello, world!");
   * ```
   */
  send(options: MessageOptions | string): Promise<MessageStruct> {
    return this.messages.send(options);
  }

  /**
   * Retrieves the category this channel belongs to, if any.
   *
   * @returns {Category | null} The category instance, or `null` if the channel is not in a category.
   */
  get category(): Category | null {
    return (
      Array.from(this.server.categories.values()).find((cat) =>
        cat.children.has(this.id),
      ) ?? null
    );
  }
}
