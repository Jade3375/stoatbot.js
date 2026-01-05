import type { Channel as APIChannel } from "revolt-api";
import { Attachment, Channel, Invite, MessageStruct, User } from "./index";
import type { TextBasedChannel } from "./interfaces/baseChannel";
import type { client } from "../client/client";
import {
  MessageManager,
  MessageOptions,
  MessageResolvable,
  UserResolvable,
} from "../managers/index.js";
import { ChannelPermissions, ChannelTypes } from "../utils/index";
import { AudioPlayer } from "../voice/player";

type APIGroupChannel = Extract<APIChannel, { channel_type: "Group" }>;

/**
 * Represents a group channel, which allows multiple users to communicate.
 *
 * @extends Channel
 */
export class GroupChannel extends Channel implements TextBasedChannel {
  /** The type of the channel, which is always `GROUP` for group channels. */
  readonly type = ChannelTypes.GROUP;

  /** The name of the group channel. */
  name!: string;

  /** The description of the group channel, if any. */
  description: string | null = null;

  /** The ID of the user who owns the group channel. */
  ownerId!: string;

  /** The permissions for the group channel. */
  permissions!: Readonly<ChannelPermissions>;

  /** The icon of the group channel, if any. */
  icon: Attachment | null = null;

  /** Manages the messages in this group channel. */
  messages = new MessageManager(this);

  /** The ID of the last message sent in this group channel, if any. */
  lastMessageId: string | null = null;

  /** A map of user IDs to their corresponding `User` instances in the group channel. */
  users = new Map<string, User>();

  /** Whether the group channel is marked as NSFW (Not Safe For Work). */
  nsfw = false;

  /**
   * Creates a new GroupChannel instance.
   *
   * @param {client} client - The client instance.
   * @param {APIGroupChannel} data - The raw data for the group channel from the API.
   */
  constructor(client: client, data: APIGroupChannel) {
    super(client);
    this._patch(data);
  }

  /**
   * Updates the group channel instance with new data from the API.
   *
   * @param {APIGroupChannel} data - The raw data for the group channel from the API.
   * @returns {this} The updated group channel instance.
   * @protected
   */
  protected _patch(data: APIGroupChannel): this {
    super._patch(data);

    if ("description" in data) {
      this.description = data.description ?? null;
    }

    if (Array.isArray(data.recipients)) {
      this.users.clear();
      for (const userId of data.recipients) {
        const user = this.client.users.cache.get(userId);
        if (user) this.users.set(user.id, user);
      }
    }

    if (typeof data.permissions === "number") {
      this.permissions = new ChannelPermissions(data.permissions).freeze();
    }

    if (data.owner) {
      this.ownerId = data.owner;
    }

    if (data.icon) {
      this.icon = new Attachment(this.client, data.icon);
    }

    if (data.name) {
      this.name = data.name;
    }

    if (data.last_message_id) this.lastMessageId = data.last_message_id;

    if (typeof data.nsfw === "boolean") this.nsfw = data.nsfw;

    return this;
  }

  /**
   * Retrieves the last message sent in this group channel.
   *
   * @returns {Message | null} The last message, or `null` if no message exists.
   */
  get lastMessage(): MessageStruct | null {
    if (!this.lastMessageId) return null;
    return this.messages.cache.get(this.lastMessageId) ?? null;
  }

  /**
   * Retrieves the owner of the group channel.
   *
   * @returns {User | null} The owner of the group channel, or `null` if not found.
   */
  get owner(): User | null {
    return this.client.users.cache.get(this.ownerId) ?? null;
  }

  /**
   * Deletes multiple messages from this group channel.
   *
   * @param {MessageResolvable[] | Map<string, Message> | number} messages - The messages to delete. This can be an array of message resolvables, a map of messages, or a number indicating how many recent messages to delete.
   * @returns {Promise<void>} A promise that resolves when the messages have been successfully deleted.
   *
   * @example
   * ```typescript
   * await groupChannel.bulkDelete(10); // Deletes the last 10 messages.
   * ```
   */
  bulkDelete(
    messages: MessageResolvable[] | Map<string, MessageStruct> | number,
  ): Promise<void> {
    return this.messages.bulkDelete(messages);
  }

  /**
   * Creates an invite for the group channel.
   *
   * @returns {Promise<Invite>} A promise that resolves with the created invite.
   *
   * @example
   * ```typescript
   * const invite = await groupChannel.createInvite();
   * console.log(`Invite created: ${invite}`);
   * ```
   */
  async createInvite(): Promise<Invite> {
    const data = await this.client.api.post(`/channels/${this.id}/invites`, {});
    return new Invite(
      this.client,
      data as { type: "Group"; _id: string; creator: string; channel: string },
    );
  }

  /**
   * Adds a user to the group channel.
   *
   * @param {UserResolvable} user - The user to add to the group channel.
   * @returns {Promise<void>} A promise that resolves when the user has been successfully added.
   *
   * @example
   * ```typescript
   * await groupChannel.add(user);
   * ```
   */
  async add(user: UserResolvable): Promise<void> {
    const id = this.client.users.resolveId(user);
    if (!id) throw new TypeError("INVALID_TYPE");
    await this.client.api.put(`/channels/${this.id}/recipients/${id}`);
  }

  /**
   * Removes a user from the group channel.
   *
   * @param {UserResolvable} user - The user to remove from the group channel.
   * @returns {Promise<void>} A promise that resolves when the user has been successfully removed.
   *
   * @example
   * ```typescript
   * await groupChannel.remove(user);
   * ```
   */
  async remove(user: UserResolvable): Promise<void> {
    const id = this.client.users.resolveId(user);
    if (!id) throw new TypeError("INVALID_TYPE");
    await this.client.api.delete(`/channels/${this.id}/recipients/${id}`);
  }

  /**
   * Leaves the group channel.
   *
   * @returns {Promise<void>} A promise that resolves when the group channel has been successfully left.
   *
   * @example
   * ```typescript
   * await groupChannel.leave();
   * ```
   */
  leave(): Promise<void> {
    return super.delete();
  }

  /**
   * Sends a message to this group channel.
   *
   * @param {MessageOptions | string} options - The message content or options for the message.
   * @returns {Promise<Message>} A promise that resolves with the sent message.
   *
   * @example
   * ```typescript
   * await groupChannel.send("Hello, group!");
   * ```
   */
  send(options: MessageOptions | string): Promise<MessageStruct> {
    return this.messages.send(options);
  }

  /**
   * Creates and connects an AudioPlayer to this voice channel in one step.
   * This is a convenience method that combines createPlayer() and connect().
   *
   * @returns {Promise<AudioPlayer>} A promise that resolves to a connected AudioPlayer
   *
   * @example
   * ```typescript
   * const voiceChannel = await client.channels.fetch('voice-channel-id') as VoiceChannel;
   * const player = await voiceChannel.connect();
   *
   * // Already connected, ready to play
   * await player.playFromUrl('https://example.com/music.mp3');
   * ```
   */
  async connect(): Promise<AudioPlayer> {
    return this.client.voice.connectToChannel(this.id, this.id);
  }

  /** Disconnects the AudioPlayer from this voice channel's server. */
  async disconnect(): Promise<void> {
    return this.client.voice.disconnectFromChannel(this.id);
  }
  /** Stops the AudioPlayer in this voice channel's server. */
  async stop(): Promise<void> {
    return this.client.voice.stopPlayerInChannel(this.id);
  }
  /** Plays audio through the AudioPlayer connected to this voice channel.
   * @param source - The audio source (URL, file path, or stream)
   */
  async play(source: string): Promise<void> {
    const player = await this.getPlayer();
    if (!player) throw new Error("No active player found for this channel");
    return player.play(source);
  }
  /** Retrieves the AudioPlayer associated with this voice channel, if any.
   * @returns {Promise<AudioPlayer | null>} A promise that resolves to the AudioPlayer or null if not found
   */
  async getPlayer(): Promise<AudioPlayer | null> {
    const player = this.client.voice["players"].get(this.id);
    return player ?? null;
  }

  //   iconURL(options?: { size: number }): string | null {
  //     if (!this.icon) return null;
  //     return this.client.api.cdn.icon(this.icon.id, options?.size);
  //   }
}
