import type {
  File,
  Message as APIMessage,
  SystemMessage,
  Masquerade,
} from "revolt-api";
import type { client } from "../client/client";
import type { MessageEditOptions, MessageOptions } from "../managers/index";
import {
  Base,
  DMChannel,
  Embed,
  GroupChannel,
  Mentions,
  Server,
  ServerMember,
  TextChannel,
  User,
  VoiceChannel,
} from "./index";
import { ChannelTypes, UUID } from "../utils/index";

/**
 * Represents a message in a channel.
 *
 * @extends Base
 */
export class MessageStruct extends Base {
  /** The type of the message (e.g., TEXT, SYSTEM). */
  type: Uppercase<SystemMessage["type"]> = "TEXT";

  /** The content of the message. */
  content = "";

  /** The ID of the channel where the message was sent. */
  channelId = "";

  /** The ID of the user who authored the message. */
  authorId = "";

  /** An array of embeds included in the message. */
  embeds: Embed[] = [];

  /** An array of file attachments included in the message. */
  attachments: File[] = [];

  /** Mentions included in the message. */
  mentions = new Mentions(this, []);

  /** The timestamp of when the message was last edited, or `null` if not edited. */
  editedTimestamp: number | null = null;

  /** the reactions and count on a message */
  reactions: Map<string, string[]> = new Map();

  /** Masquerade information for the message, Name and / or avatar override information */
  masquerade?: Masquerade;

  /**
   * Creates a new Message instance.
   *
   * @param {client} client - The client instance.
   * @param {APIMessage} data - The raw data for the message from the API.
   */
  constructor(client: client, data: APIMessage) {
    super(client);
    this._patch(data);
  }

  /**
   * Updates the message instance with new data from the API.
   *
   * @param {APIMessage} data - The raw data for the message from the API.
   * @returns {this} The updated message instance.
   * @protected
   */
  protected _patch(data: APIMessage): this {
    super._patch(data);

    if (Array.isArray(data.embeds)) {
      this.embeds = data.embeds;
    }

    if (Array.isArray(data.attachments)) {
      this.attachments = data.attachments;
    }

    if (Array.isArray(data.mentions)) {
      this.mentions = new Mentions(this, data.mentions);
    }

    if (data.author) {
      this.authorId = data.author;
    }

    if (data.channel) {
      this.channelId = data.channel;
    }

    if (typeof data.content === "string") {
      this.content = data.content;
    }

    if (data.system) {
      this.type = data.system.type.toUpperCase() as Uppercase<
        SystemMessage["type"]
      >;
    }

    if (data.edited) {
      this.editedTimestamp = Date.parse(data.edited);
    }

    return this;
  }

  /**
   * Gets the creation date of the message.
   *
   * @returns {Date} The date when the message was created.
   */
  get createdAt(): Date {
    return UUID.timestampOf(this.id);
  }

  /**
   * Gets the creation timestamp of the message in milliseconds.
   *
   * @returns {number} The timestamp of when the message was created.
   */
  get createdTimestamp(): number {
    return this.createdAt.getTime();
  }

  /**
   * Gets the date when the message was last edited.
   *
   * @returns {Date | null} The date of the last edit, or `null` if not edited.
   */
  get editedAt(): Date | null {
    return this.editedTimestamp ? new Date(this.editedTimestamp) : null;
  }

  /**
   * Checks if the message is a system message.
   *
   * @returns {boolean} `true` if the message is a system message, otherwise `false`.
   */
  get system(): boolean {
    return this.type !== "TEXT";
  }

  /**
   * Retrieves the author of the message.
   *
   * @returns {User | ServerMember | null} The user who authored the message, or `null` if not found.
   */
  get author(): User | ServerMember | null {
    if (this.inServer()) {
      return (
        this.server?.members.cache.get(this.authorId) ??
        this.client.users.cache.get(this.authorId) ??
        null
      );
    }
    return this.client.users.cache.get(this.authorId) ?? null;
  }

  /**
   * Retrieves the channel where the message was sent.
   *
   * @returns {TextChannel | DMChannel | GroupChannel | VoiceChannel} The channel instance.
   */
  get channel(): TextChannel | DMChannel | GroupChannel | VoiceChannel {
    const channel = this.client.channels.cache.get(this.channelId);

    switch (channel?.type) {
      case ChannelTypes.TEXT:
        return channel as TextChannel;
      case ChannelTypes.DM:
        return channel as DMChannel;
      case ChannelTypes.GROUP:
        return channel as GroupChannel;
      case ChannelTypes.VOICE:
        return channel as VoiceChannel;
      default:
        return channel as TextChannel;
    }
  }

  /**
   * Retrieves the server ID associated with the message, if any.
   *
   * @returns {string | null} The server ID, or `null` if the message is not in a server.
   */
  get serverId(): string | null {
    const channel = this.channel;
    return channel.inServer() ? channel.serverId : null;
  }

  /**
   * Retrieves the server associated with the message, if any.
   *
   * @returns {Server | null} The server instance, or `null` if not found.
   */
  get server(): Server | null {
    return this.client.servers.cache.get(this.serverId as string) ?? null;
  }

  /**
   * Retrieves the server member who authored the message, if any.
   *
   * @returns {ServerMember | null} The server member instance, or `null` if not found.
   */
  get member(): ServerMember | null {
    return this.server?.members.cache.get(this.authorId) ?? null;
  }

  /**
   * Gets the URL of the message.
   *
   * @returns {string} The URL of the message.
   */
  get url(): string {
    return `https://app.stoat.chat/${
      this.serverId ? `server/${this.serverId}` : ""
    }/channel/${this.channelId}/${this.id}`;
  }

  /**
   * Acknowledges the message.
   *
   * @returns {Promise<void>} A promise that resolves when the message is acknowledged.
   */
  ack(): Promise<void> {
    return this.channel.messages.ack(this);
  }

  /**
   * Deletes the message.
   *
   * @returns {Promise<void>} A promise that resolves when the message is deleted.
   */
  delete(): Promise<void> {
    return this.channel.messages.delete(this);
  }

  /**
   * Replies to the message.
   *
   * @param {string} content - The content of the reply.
   * @param {boolean} [mention=true] - Whether to mention the original message author.
   * @returns {Promise<Message>} A promise that resolves with the sent reply message.
   */
  reply(
    content: MessageOptions | string,
    mention: boolean = true,
  ): Promise<MessageStruct> {
    return this.channel.messages.send({
      ...(typeof content === "object" ? content : { content }),
      replies: [{ id: this.id, mention }],
    });
  }

  /**
   * Edits the message.
   *
   * @param {MessageEditOptions | string} options - The new content or edit options.
   * @returns {Promise<void>} A promise that resolves when the message is edited.
   */
  edit(options: MessageEditOptions | string): Promise<void> {
    return this.channel.messages.edit(this, options);
  }

  /**
   * Fetches the latest data for the message.
   *
   * @returns {Promise<Message>} A promise that resolves with the updated message instance.
   */
  fetch(): Promise<MessageStruct> {
    return this.channel.messages.fetch(this.id);
  }

  /**
   * Adds a reaction to the message.
   *
   * @param {string} emoji - The emoji to react with.
   * @returns {Promise<void>} A promise that resolves when the reaction is added.
   */
  addReaction(emoji: string): Promise<void> {
    return this.channel.messages.addReaction(this, emoji);
  }

  /**
   * Removes a reaction from the message.
   *
   * @param {string} emoji - The emoji to remove the reaction for.
   * @param {object} [options] - Options for removing the reaction.
   * @param {string} [options.user_id] - The user ID to remove the reaction for. If not provided, removes the reaction for the current user.
   * @param {boolean} [options.remove_all=false] - Whether to remove all of the specified reaction for the message.
   * @returns {Promise<void>} A promise that resolves when the reaction is removed.
   */
  removeReaction(
    emoji: string,
    options?: { user_id?: string; remove_all?: boolean },
  ): Promise<void> {
    return this.channel.messages.removeReaction(
      this,
      emoji,
      options?.user_id ?? undefined,
      options?.remove_all ?? false,
    );
  }

  /**
   * Removes all reactions from the message.
   *
   * @returns {Promise<void>} A promise that resolves when all reactions are removed.
   */
  removeAllReactions(): Promise<void> {
    return this.channel.messages.removeAllReactions(this);
  }

  /**
   * Checks if the message is in a server.
   *
   * @returns {boolean} `true` if the message is in a server, otherwise `false`.
   */
  inServer(): this is this & {
    serverId: string;
    server: Server;
    channel: TextChannel;
  } {
    return this.channel.inServer();
  }

  /**
   * Converts the message to a string representation.
   *
   * @returns {string} The content of the message.
   */
  toString(): string {
    return this.content;
  }
}
