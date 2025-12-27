import type { Channel } from "revolt-api";
import { ServerChannel } from "./index";
import { client } from "../client/client";
import { ChannelTypes } from "../utils/index";
import { AudioPlayer } from "../client/player";

type APIVoiceChannel = Extract<Channel, { channel_type: "VoiceChannel" }>;

/**
 * Represents a voice channel in a server.
 *
 * @extends ServerChannel
 */
export class VoiceChannel extends ServerChannel {
  /** The type of the channel, which is always `VOICE` for voice channels. */
  readonly type = ChannelTypes.VOICE;

  /**
   * Creates a new VoiceChannel instance.
   *
   * @param {client} client - The client instance.
   * @param {APIVoiceChannel} data - The raw data for the voice channel from the API.
   */
  constructor(client: client, data: APIVoiceChannel) {
    super(client, data);
    this._patch(data);
  }

  /**
   * Updates the voice channel instance with new data from the API.
   *
   * @param {APIVoiceChannel} data - The raw data for the voice channel from the API.
   * @returns {this} The updated voice channel instance.
   * @protected
   */
  protected _patch(data: APIVoiceChannel): this {
    super._patch(data);
    return this;
  }

  /**
   * Acknowledges the voice channel.
   *
   * @throws {TypeError} Throws an error because voice channels cannot be acknowledged.
   *
   * @example
   * ```typescript
   * try {
   *   await voiceChannel.ack();
   * } catch (error) {
   *   console.error(error.message); // "Cannot ack voice channel"
   * }
   * ```
   */
  ack(): Promise<void> {
    throw new TypeError("Cannot ack voice channel");
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
    return this.client.voice.connectToChannel(this.id, this.serverId);
  }

  /** Disconnects the AudioPlayer from this voice channel's server. */
  async disconnect(): Promise<void> {
    return this.client.voice.disconnectFromChannel(this.serverId);
  }
  /** Stops the AudioPlayer in this voice channel's server. */
  async stop(): Promise<void> {
    return this.client.voice.stopPlayerInChannel(this.serverId);
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
    const player = this.client.voice["players"].get(this.serverId);
    return player ?? null;
  }
}
