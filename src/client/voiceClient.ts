import { client } from "./client";
import { AudioPlayer } from "../voice/player";

/**
 * VoiceClient acts as a factory for creating AudioPlayer instances.
 * Users manage the AudioPlayer instances themselves rather than the VoiceClient managing them internally.
 * This design gives users full control over their voice connections and audio playback.
 */
export class VoiceClient {
  private readonly client: client;
  /** Map of active audio players by server ID */
  private readonly players: Map<string, AudioPlayer>;

  constructor(client: client) {
    this.client = client;
    this.players = new Map();
  }

  /**
   * Creates a new AudioPlayer instance for the specified voice channel.
   *
   * @param channelId - The ID of the voice channel to connect to
   * @param serverId - The ID of the server containing the voice channel
   * @returns A new AudioPlayer instance that the user can manage
   *
   * @example
   * ```typescript
   * // Create a player for a specific voice channel
   * const player = client.voice.createPlayer('voice-channel-id', 'server-id');
   *
   * // Set up event listeners
   * player.on('connected', () => {
   *   console.log('Connected to voice channel!');
   * });
   *
   * player.on('audioStart', (source, type) => {
   *   console.log(`Started playing ${type}: ${source}`);
   * });
   *
   * // Connect and play audio
   * await player.connect();
   * await player.playFromFile('./music.mp3');
   *
   * // The user is responsible for managing the player lifecycle
   * await player.disconnect();
   * ```
   */
  createPlayer(channelId: string, serverId: string): AudioPlayer {
    return new AudioPlayer(channelId, serverId, this.client);
  }

  /**
   * Creates a new AudioPlayer instance and immediately connects it to the voice channel.
   * This is a convenience method that combines createPlayer() and connect().
   *
   * @param channelId - The ID of the voice channel to connect to
   * @param serverId - The ID of the server containing the voice channel
   * @returns A new connected AudioPlayer instance
   *
   * @example
   * ```typescript
   * // Create and connect in one step
   * const player = await client.voice.connectToChannel('voice-channel-id', 'server-id');
   *
   * // Player is already connected and ready to use
   * await player.playFromUrl('https://example.com/music.mp3');
   * ```
   */
  async connectToChannel(
    channelId: string,
    serverId: string,
  ): Promise<AudioPlayer> {
    const player =
      this.players.get(serverId) ?? this.createPlayer(channelId, serverId);
    this.players.set(serverId, player);
    await player.connect(channelId);
    return player;
  }

  /**
   * Disconnects the AudioPlayer from the specified server.
   *
   * @param serverId - The ID of the server to disconnect from
   */
  async disconnectFromChannel(serverId: string): Promise<void> {
    const player = this.players.get(serverId);
    if (player) {
      await player.disconnect();
      this.players.delete(serverId);
    }
  }

  /**
   * Stops the AudioPlayer in the specified server.
   *
   * @param serverId - The ID of the server whose player should be stopped
   */
  async stopPlayerInChannel(serverId: string): Promise<void> {
    const player = this.players.get(serverId);
    if (player) {
      await player.stop();
    }
  }
}
