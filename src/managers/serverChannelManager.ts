import type { Channel } from "revolt-api";
import { BaseManager } from "./baseManager";
import {
  Server,
  ServerChannel,
  TextChannel,
  VoiceChannel,
} from "../struct/index";
import { UUID } from "../utils/index";
import { APIServerChannel } from "../types";

export type ServerChannelResolvable = ServerChannel | APIServerChannel | string;

export interface CreateChannelOptions {
  name: string;
  type?: "Text" | "Voice";
  description?: string;
  nsfw?: boolean;
  voice: {
    max_users?: number;
  };
}

export class ServerChannelManager extends BaseManager<ServerChannel> {
  /** @private */
  holds = ServerChannel;
  constructor(protected readonly server: Server) {
    super(server.client);
  }

  /** @private */
  _add(data: APIServerChannel): ServerChannel {
    let channel: ServerChannel;

    switch (data.channel_type) {
      case "TextChannel":
        channel = new TextChannel(this.client, data);
        break;
      case "VoiceChannel":
        channel = new VoiceChannel(this.client, data);
        break;
      default:
        throw new Error(
          `Unknown channel type: ${(data as APIServerChannel).channel_type}`,
        );
    }

    this.cache.set(channel.id, channel);

    return channel;
  }

  /**
   * Creates a new channel in the server.
   * @param options - Options for creating the channel.
   * @param options.name - The name of the channel to create.
   * @param [options.type="Text"] - The type of the channel to create. Can be "Text" or "Voice". Defaults to "Text".
   * @param [options.description] - The description of the channel to create. Only used for voice channels.
   * @returns A promise that resolves to the created channel.
   */
  async create({
    name,
    type = "Text",
    description,
  }: CreateChannelOptions): Promise<ServerChannel> {
    const data = await this.client.api.post(
      `/servers/${this.server.id}/channels`,
      {
        body: {
          name,
          type,
          description,
          nonce: UUID.generate(),
        },
      },
    );
    return this._add(data as APIServerChannel);
  }

  /**
   * fetch a channel from the server
   * @param channel The channel to fetch. Can be a string, a channel object, or an API channel object.
   * @param force Whether to force fetch the channel from the API. Defaults to true.
   * If set to false, the method will return the channel from the cache if it exists.
   * @returns A promise that resolves to the fetched channel
   */
  async fetch(
    channel: ServerChannelResolvable,
    { force = true } = {},
  ): Promise<ServerChannel> {
    const id = this.resolveId(channel);

    if (!id) {
      throw new TypeError("INVALID_ID");
    }

    if (!force) {
      const channel = this.cache.get(id);
      if (channel) return channel;
    }

    const data = await this.client.api.get(
      `/servers/${this.server.id}/channels/${id}`,
    );

    return this._add(data as APIServerChannel);
  }
}
