import type { Channel as APIChannel } from "revolt-api";
import { BaseManager } from "./baseManager";
import {
  Channel,
  DMChannel,
  GroupChannel,
  NotesChannel,
  TextChannel,
  VoiceChannel,
} from "../struct/index";

export type ChannelResolvable = Channel | APIChannel | string;

export class ChannelManager extends BaseManager<Channel, APIChannel> {
  /** @private */
  holds = null;

  /** @private */
  _add(data: APIChannel & { voice?: any }): Channel {
    let channel: Channel;

    switch (data.channel_type) {
      case "TextChannel":
        if (data.voice !== undefined) {
          channel = new VoiceChannel(this.client, data as any);
        } else {
          channel = new TextChannel(this.client, data);
        }
        break;
      case "VoiceChannel":
        channel = new VoiceChannel(this.client, data);
        break;
      case "DirectMessage":
        channel = new DMChannel(this.client, data);
        break;
      case "Group":
        channel = new GroupChannel(this.client, data);
        break;
      case "SavedMessages":
        channel = new NotesChannel(this.client, data);
        if (this.client.user) this.client.user.notes = channel as NotesChannel;
        break;
      default:
        throw new Error(`Unknown Channel Type: ${data}`);
    }

    this.cache.set(channel.id, channel);

    return channel;
  }

  _remove(id: string): void {
    const channel = this.cache.get(id);

    if (channel?.inServer()) {
      channel.server?.channels.cache.delete(id);
    }

    super._remove(id);
  }

  /**
   * used to delete a channel
   *
   * @param channel The channel to delete
   * @returns A promise that resolves when the channel is deleted
   */
  async delete(channel: ChannelResolvable): Promise<void> {
    const id = this.resolveId(channel);
    if (!id) {
      throw new TypeError("INVALID_TYPE");
    }
    await this.client.api.delete(`/channels/${id}`);
  }

  /**
   * used to fetch a channel
   *
   * @param channel The channel to fetch
   * @param force Whether to force fetch the channel using the api or return it form cache if able
   * @returns A promise that resolves with the fetched channel
   */
  async fetch(
    channel: ChannelResolvable,
    { force = true } = {},
  ): Promise<Channel> {
    const id = this.resolveId(channel);

    if (!id) {
      throw new TypeError("INVALID_TYPE");
    }

    if (!force) {
      const channel = this.cache.get(id);
      if (channel) return channel;
    }

    const data = (await this.client.api.get(`/channels/${id}`)) as APIChannel;

    return this._add(data);
  }

  /**
   * resolves a channel from a string or a channel object
   * @param channel The channel to resolve
   * @returns the resolved channel or null if not found
   */
  resolve(channel: ChannelResolvable): Channel | null {
    if (channel instanceof Channel) return channel;
    return super.resolve(channel);
  }

  /**
   * resolves a channel id from a string or a channel object
   * @param channel The channel to resolve
   * @returns the resolved channel id or null if not found
   */
  resolveId(channel: ChannelResolvable): string | null {
    if (channel instanceof Channel) return channel.id;
    return super.resolveId(channel);
  }
}
