import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { URL } from "node:url";
import {
  AudioFrame,
  AudioSource,
  LocalAudioTrack,
  LocalTrackPublication,
  Room,
  RoomEvent,
  TrackPublishOptions,
  TrackSource,
} from "@livekit/rtc-node";

import { client } from "../client/client";
import { nodeAVProcessor, isNodeAVAvailable } from "./node-av";

/**
 * Events emitted by the AudioPlayer
 */
export interface AudioPlayerEvents {
  connected: [channelId: string, serverId: string, roomName?: string];
  disconnected: [channelId: string, serverId: string, reason?: string];
  audioStart: [source: string, type: string];
  audioEnd: [source: string, type: string];
  audioError: [source: string, type: string, error: Error];
  volumeChanged: [oldVolume: number, newVolume: number];
  muted: [previousVolume: number];
  unmuted: [newVolume: number];
  trackPublished: [trackId: string];
  trackStopped: [trackId: string];
  conversionStart: [source: string, sampleRate: number, channels: number];
  conversionEnd: [source: string, samplesProcessed: number];
  conversionError: [source: string, error: Error];
  debug: [message: string, data?: any];
  error: [error: Error, context?: string];
}

export declare interface AudioPlayer {
  on<K extends keyof AudioPlayerEvents>(
    event: K,
    listener: (...args: AudioPlayerEvents[K]) => void,
  ): this;

  off<K extends keyof AudioPlayerEvents>(
    event: K,
    listener: (...args: AudioPlayerEvents[K]) => void,
  ): this;

  removeAllListeners<K extends keyof AudioPlayerEvents>(event?: K): this;
}

export class AudioPlayer extends EventEmitter {
  private readonly channelId: string;
  private readonly serverId: string;
  private readonly client: client;
  private _volume: number = 1.0; // Volume from 0.0 to 2.0 (100% = 1.0, 200% = 2.0)
  private room?: Room;
  private publications: Map<string, LocalTrackPublication> = new Map();
  private audioSources: Map<string, AudioSource> = new Map();
  private isConnected: boolean = false;
  private shouldStop: boolean = false; // Flag to control audio playback cancellation
  private isStreaming: boolean = false; // Flag to control streaming audio playback

  constructor(channelId: string, serverId: string, client: client) {
    super();
    this.channelId = channelId;
    this.serverId = serverId;
    this.client = client;
  }

  /**
   * Get the channel ID this player is associated with
   */
  get channel(): string {
    return this.channelId;
  }

  /**
   * Get the server ID this player is associated with
   */
  get server(): string {
    return this.serverId;
  }

  /**
   * Get current volume level (0.0 to 2.0)
   */
  get volume(): number {
    return this._volume;
  }

  /**
   * Check if the player is connected to a voice channel
   */
  get connected(): boolean {
    return this.isConnected && !!this.room;
  }

  /**
   * Set volume level
   * @param level - Volume level from 0.0 (mute) to 2.0 (200%)
   */
  setVolume(level: number): void {
    const oldVolume = this._volume;
    this._volume = Math.max(0.0, Math.min(2.0, level));

    this.emit("debug", `Volume set to ${(this._volume * 100).toFixed(0)}%`, {
      oldVolume,
      newVolume: this._volume,
    });

    this.emit("volumeChanged", oldVolume, this._volume);
  }

  /**
   * Increase volume by specified amount
   * @param amount - Amount to increase (default: 0.1)
   */
  increaseVolume(amount: number = 0.1): void {
    this.setVolume(this._volume + amount);
  }

  /**
   * Decrease volume by specified amount
   * @param amount - Amount to decrease (default: 0.1)
   */
  decreaseVolume(amount: number = 0.1): void {
    this.setVolume(this._volume - amount);
  }

  /**
   * Mute audio (set volume to 0)
   */
  mute(): void {
    const oldVolume = this._volume;
    this.setVolume(0);
    this.emit("muted", oldVolume);
  }

  /**
   * Unmute audio (restore to 100% if currently muted)
   */
  unmute(): void {
    if (this._volume === 0) {
      this.setVolume(1.0);
      this.emit("unmuted", 1.0);
    }
  }

  /**
   * Apply volume to PCM audio data
   * @param pcmData - Int16Array audio data
   * @returns Modified PCM data with volume applied
   * @private
   */
  private applyVolume(pcmData: Int16Array): Int16Array {
    if (this._volume === 1.0) return pcmData; // No change needed

    const result = new Int16Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      // Apply volume and clamp to prevent overflow
      const sample = pcmData[i] * this._volume;
      result[i] = Math.max(-32768, Math.min(32767, Math.round(sample)));
    }
    return result;
  }

  /**
   * Check if a string is a valid URL
   * @param input - The string to check
   * @returns True if the input is a valid URL
   */
  private isUrl(input: string): boolean {
    try {
      const url = new URL(input);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Check if a string is a valid file path that exists
   * @param input - The string to check
   * @returns True if the input is an existing file path
   * @private
   */
  private isFilePath(input: string): boolean {
    try {
      return existsSync(input);
    } catch {
      return false;
    }
  }

  /**
   * Check if input is a Readable stream
   * @param input - The input to check
   * @returns True if the input is a Readable stream
   * @private
   */
  private isStream(input: any): input is Readable {
    return input instanceof Readable;
  }

  /**
   * Connect to the voice channel
   */
  async connect(targetChannelId?: string): Promise<void> {
    const channelToConnect = targetChannelId || this.channelId;

    // If we're already connected and trying to connect to a different channel, disconnect first
    if (this.isConnected && channelToConnect !== this.channelId) {
      await this.disconnect();
      // Update the player's channel ID for the new connection
      (this as any).channelId = channelToConnect;
    } else if (this.isConnected && channelToConnect === this.channelId) {
      return;
    }

    this.emit("debug", "Starting connection", {
      channelId: channelToConnect,
      serverId: this.serverId,
    });

    try {
      const selectedNode =
        this.client.voiceOptions.nodes?.[0].name || "worldwide";
      // First attempt: Try normal join_call
      let response: { token: string; url: string };

      try {
        response = (await this.client.api.post(
          `/channels/${channelToConnect}/join_call`,
          { body: { node: selectedNode } },
        )) as { token: string; url: string };
      } catch (joinError: any) {
        // Check if this is the AlreadyConnected error
        if (
          joinError.message?.includes("AlreadyConnected") ||
          joinError.response?.data?.type === "AlreadyConnected"
        ) {
          // Strategy 1: Try to DELETE on the same channel to clear connection
          try {
            await this.client.api.delete(
              `/channels/${channelToConnect}/join_call`,
            );

            // Retry the join after clearing
            response = (await this.client.api.post(
              `/channels/${channelToConnect}/join_call`,
              { body: { node: selectedNode } },
            )) as { token: string; url: string };
          } catch (deleteError) {
            // Strategy 2: Try with force parameter
            try {
              response = (await this.client.api.post(
                `/channels/${channelToConnect}/join_call`,
                { body: { node: selectedNode, force: true } },
              )) as { token: string; url: string };
            } catch (forceError) {
              // Final strategy: Provide clear error with solutions
              throw new Error(
                `Unable to join voice channel: Bot is already connected to another voice channel.\n\n` +
                  `This typically happens when:\n` +
                  `• The bot didn't disconnect properly from a previous session\n` +
                  `• Another instance of the bot is running\n` +
                  `• The bot crashed without proper cleanup\n\n` +
                  `Solutions to try:\n` +
                  `1. Restart the bot application completely\n` +
                  `2. Wait 30-60 seconds for the connection to timeout\n` +
                  `3. Check if another bot instance is running\n` +
                  `4. Check server permissions for voice channels\n\n` +
                  `If this persists, the API may need manual intervention to clear the connection state.`,
              );
            }
          }
        } else {
          // Different error, re-throw it
          throw joinError;
        }
      }

      const room = new Room();
      this.room = room;

      // Set up room event handlers
      room.on(RoomEvent.Disconnected, this.handleDisconnected.bind(this));

      // Connect to the voice room
      await room.connect(response.url, response.token, {
        dynacast: true,
        autoSubscribe: true,
      });

      this.isConnected = true;
      this.emit("connected", channelToConnect, this.serverId, room.name);
      this.emit("debug", "Connection established", { roomName: room.name });
    } catch (error) {
      this.emit(
        "error",
        error instanceof Error ? error : new Error(String(error)),
        "connection",
      );
      console.error(`❌ [${channelToConnect}] Failed to connect:`, error);
      throw error;
    }
  }

  /**
   * Generic play method that automatically detects the input type and uses the appropriate play method
   * @param input - Can be a URL string, file path string, or Readable stream
   * @returns Promise that resolves when playback starts
   *
   * @example
   * ```typescript
   * // Play from URL
   * await player.play("https://example.com/audio.mp3");
   *
   * // Play from file path
   * await player.play("/path/to/audio.mp3");
   *
   * // Play from stream
   * await player.play(readableStream);
   * ```
   */
  async play(input: string | Readable): Promise<void> {
    if (this.isStream(input)) {
      this.emit("debug", "Auto-detected stream input", { type: "stream" });
      this.emit("audioStart", "stream", "stream");
      await this.playFromStream(input, "stream", "stream");
    } else if (typeof input === "string") {
      if (this.isUrl(input)) {
        this.emit("debug", "Auto-detected URL input", { url: input });
        await this.playFromUrl(input);
      } else if (this.isFilePath(input)) {
        this.emit("debug", "Auto-detected file path input", {
          filePath: input,
        });
        await this.playFromFile(input);
      } else {
        throw new Error(
          `Invalid input: '${input}' is neither a valid URL nor an existing file path`,
        );
      }
    } else {
      throw new Error(
        `Unsupported input type: expected string or Readable stream, got ${typeof input}`,
      );
    }
  }

  /**
   * Play audio from a URL (supports both files and streaming URLs like radio stations)
   * @private
   */
  private async playFromUrl(url: string): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    this.emit("audioStart", url, "url");
    this.emit("debug", "Starting URL playback", { url });

    try {
      const https = await import("node:https");
      const http = await import("node:http");

      return new Promise<void>((resolve, reject) => {
        const client = url.startsWith("https:") ? https : http;

        const request = client.get(url, (response) => {
          if (response.statusCode !== 200) {
            const error = new Error(`HTTP Error: ${response.statusCode}`);
            console.error("HTTP Error:", error.message);
            this.emit("audioError", url, "url", error);
            return;
          }

          // Check if this is likely a continuous stream (radio, live stream)
          const contentType = response.headers["content-type"] || "";
          const contentLength = response.headers["content-length"];
          const isLiveStream =
            !contentLength ||
            (contentType.includes("audio/mpeg") && url.includes("stream")) ||
            contentType.includes("application/ogg") ||
            url.toLowerCase().includes("radio") ||
            url.toLowerCase().includes("stream");

          if (isLiveStream) {
            // Use streaming method for continuous audio
            this.playStreamingAudio(response, url, "url")
              .then(() => {
                this.emit("audioEnd", "URL playback completed", { url });
                resolve();
              })
              .catch((error) => {
                console.error("Error streaming audio from URL:", error);
                this.emit("audioError", url, "url", error);
                this.emit("error", error, "url-streaming");
              });
          } else {
            // Use standard conversion for finite files
            this.playFromStream(response, url, "url")
              .then(() => {
                this.emit("debug", "URL playback completed", { url });
                resolve();
              })
              .catch((error) => {
                console.error("Error playing audio from URL:", error);
                this.emit("audioError", url, "url", error);
                this.emit("error", error, "url-standard");
              });
          }
        });

        request.on("error", (error) => {
          console.error("Request error:", error.message);
          this.emit("audioError", url, "url", error);
        });

        request.setTimeout(30000, () => {
          const timeoutError = new Error("Request timeout");
          request.destroy();
          this.emit("audioError", url, "url", timeoutError);
        });
      });
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      this.emit("audioError", url, "url", errorObj);
      this.emit("error", errorObj, "url-playback");
      console.error(`❌ [${this.channelId}] URL playback failed:`, error);
      throw error;
    }
  }

  /**
   * Play audio from a stream in real-time (for radio stations, live streams)
   */
  private async playStreamingAudio(
    audioStream: Readable,
    source?: string,
    type?: string,
  ): Promise<void> {
    // Reset stop flags when starting new streaming
    this.shouldStop = false;
    this.isStreaming = true;

    if (!this.room) {
      throw new Error(
        `Not connected to voice channel ${this.channelId}. Call connect() first.`,
      );
    }

    // Check if localParticipant is available
    if (!this.room.localParticipant) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (!this.room.localParticipant) {
        throw new Error("Local participant not available after waiting");
      }
    }

    try {
      const sampleRate = 48000;
      const channels = 1;

      const source = new AudioSource(sampleRate, channels);
      const sourceId = `stream_${Date.now()}`;
      this.audioSources.set(sourceId, source);
      const track = LocalAudioTrack.createAudioTrack("audio", source);
      const options = new TrackPublishOptions();
      options.source = TrackSource.SOURCE_MICROPHONE;

      const publication = await this.room.localParticipant.publishTrack(
        track,
        options,
      );

      if (publication) {
        this.publications.set(publication.sid!, publication);
        this.emit("trackPublished", publication.sid!);

        // Try different methods to unmute the track
        try {
          if (typeof (publication as any).setMuted === "function") {
            await (publication as any).setMuted(false);
          } else if (typeof (track as any).setMuted === "function") {
            await (track as any).setMuted(false);
          }
        } catch (error) {
          this.emit("error", error, "track-unmute");
        }

        // Check if node-av is available for streaming
        if (isNodeAVAvailable()) {
          this.emit("debug", "Using node-av for streaming audio", {
            source,
            type,
            sampleRate,
            channels,
          });

          // Use node-av for streaming - no fallback to FFmpeg since node-av is installed
          await nodeAVProcessor.createAudioStream(
            audioStream,
            sampleRate,
            channels,
            async (pcmChunk: Int16Array) => {
              if (!this.isStreaming || this.shouldStop) return;

              try {
                // Apply volume control to the audio data
                const volumeAdjustedPcmData = this.applyVolume(pcmChunk);

                // Create AudioFrame and send to track
                const frame = new AudioFrame(
                  volumeAdjustedPcmData,
                  sampleRate,
                  channels,
                  volumeAdjustedPcmData.length,
                );

                await source.captureFrame(frame);
              } catch (frameError) {
                if (!this.isStreaming || this.shouldStop) {
                  return;
                }
                // For InvalidState errors during active streaming, continue without the frame
                if (
                  frameError instanceof Error &&
                  frameError.message?.includes("InvalidState")
                ) {
                  return;
                }
                console.error("Error processing audio chunk:", frameError);
              }
            },
            () => {
              // onEnd
              this.isStreaming = false;
              if (source && type) {
                this.emit("audioEnd", source, type);
              }
            },
            (error: Error) => {
              // onError
              this.isStreaming = false;
              this.emit("audioError", "stream", "streaming", error);
            },
          );

          // Set up a way to stop streaming
          this.once("disconnected", () => {
            this.isStreaming = false;
          });

          // Use node-av for streaming - no fallback to FFmpeg since node-av is installed
          await nodeAVProcessor.createAudioStream(
            audioStream,
            sampleRate,
            channels,
            async (pcmChunk: Int16Array) => {
              if (!this.isStreaming || this.shouldStop) return;

              try {
                // Apply volume control to the audio data
                const volumeAdjustedPcmData = this.applyVolume(pcmChunk);

                // Create AudioFrame and send to track
                const frame = new AudioFrame(
                  volumeAdjustedPcmData,
                  sampleRate,
                  channels,
                  volumeAdjustedPcmData.length,
                );

                await source.captureFrame(frame);
              } catch (frameError) {
                if (!this.isStreaming || this.shouldStop) {
                  return;
                }
                // For InvalidState errors during active streaming, continue without the frame
                if (
                  frameError instanceof Error &&
                  frameError.message?.includes("InvalidState")
                ) {
                  return;
                }
                console.error("Error processing audio chunk:", frameError);
              }
            },
            () => {
              // onEnd
              this.isStreaming = false;
              if (source && type) {
                this.emit("audioEnd", source, type);
              }
            },
            (error: Error) => {
              // onError
              this.isStreaming = false;
              this.emit("audioError", "stream", "streaming", error);
            },
          );

          // Set up a way to stop streaming
          this.once("disconnected", () => {
            this.isStreaming = false;
          });

          return;
        }

        // Only use FFmpeg if node-av is not available
        this.emit(
          "debug",
          "node-av not available, using FFmpeg for streaming audio",
          {
            source,
            type,
            sampleRate,
            channels,
          },
        );

        const args = [
          "-i",
          "pipe:0", // Read from stdin
          "-f",
          "s16le", // 16-bit little-endian PCM
          "-ar",
          sampleRate.toString(), // Sample rate
          "-ac",
          channels.toString(), // Number of channels
          "-", // Output to stdout
        ];

        const ffmpeg = spawn("ffmpeg", args);

        // Enhanced error handling for stdin
        ffmpeg.stdin.on("error", (error) => {
          // Don't stop streaming for stdin errors, they're often recoverable
        });

        // Pipe the audio stream to ffmpeg with error handling
        audioStream.pipe(ffmpeg.stdin);

        audioStream.on("error", (error) => {
          this.emit("audioError", "stream", "streaming", error);
        });

        audioStream.on("close", () => {
          console.warn("⚠️ Audio stream closed unexpectedly");
          if (this.isStreaming) {
          }
        });

        audioStream.on("end", () => {
          if (this.isStreaming) {
            this.isStreaming = false;
            ffmpeg.kill();
          }
        });

        // Process audio in real-time chunks
        const chunkDurationMs = 100; // 100ms chunks
        const samplesPerChunk =
          Math.floor((sampleRate * chunkDurationMs) / 1000) * channels;
        const bytesPerChunk = samplesPerChunk * 2; // 2 bytes per 16-bit sample

        let buffer = Buffer.alloc(0);
        let chunkCount = 0;

        ffmpeg.stdout.on("data", async (chunk: Buffer) => {
          try {
            if (!this.isStreaming || this.shouldStop) return;

            buffer = Buffer.concat([buffer, chunk]);
            chunkCount++;

            // Process complete chunks
            while (
              buffer.length >= bytesPerChunk &&
              this.isStreaming &&
              !this.shouldStop
            ) {
              const audioChunk = buffer.slice(0, bytesPerChunk);
              buffer = buffer.slice(bytesPerChunk);

              // Convert to Int16Array with proper alignment
              const alignedBuffer = Buffer.from(audioChunk);
              const originalPcmData = new Int16Array(
                alignedBuffer.buffer,
                alignedBuffer.byteOffset,
                alignedBuffer.byteLength / 2,
              );

              // Apply volume control to the audio data
              const volumeAdjustedPcmData = this.applyVolume(originalPcmData);

              // Create AudioFrame and send to track (using actual data length)
              const frame = new AudioFrame(
                volumeAdjustedPcmData,
                sampleRate,
                channels,
                volumeAdjustedPcmData.length,
              );

              // Use async captureFrame and handle errors gracefully
              try {
                await source.captureFrame(frame);
              } catch (frameError) {
                console.error("Error processing audio chunk:", frameError);
                if (!this.isStreaming || this.shouldStop) {
                  // If we're no longer streaming or should stop, stop processing
                  return;
                }
                // For InvalidState errors during active streaming, continue without the frame
                if (
                  frameError instanceof Error &&
                  frameError.message?.includes("InvalidState")
                ) {
                  continue;
                }
              }
            }
          } catch (error) {}
        });

        ffmpeg.on("close", (code) => {
          this.isStreaming = false;

          // For streaming audio, null or non-zero exit codes are often normal
          // when stopping streams or when streams end naturally
          if (code !== 0 && code !== null) {
            const error = new Error(`FFmpeg exited with code ${code}`);
            this.emit("audioError", "stream", "streaming", error);
          }
        });

        // Set up a way to stop streaming
        this.once("disconnected", () => {
          this.isStreaming = false;
          ffmpeg.kill();
        });

        // Return a promise that resolves when streaming ends
        return new Promise<void>((resolve, reject) => {
          ffmpeg.on("close", (code) => {
            this.emit("debug", "FFmpeg streaming ended", {
              code,
              source,
              type,
            });

            // Emit audioEnd event if source information is provided
            if (source && type) {
              this.emit("debug", "Emitting audioEnd for streaming", {
                source,
                type,
              });
              this.emit("audioEnd", source, type);
            } else {
              this.emit("debug", "No source/type for streaming audioEnd", {
                source,
                type,
              });
            }

            // For streaming audio, null or non-zero exit codes are often normal
            // when stopping streams or when streams end naturally
            if (code === 0 || code === null) {
              resolve();
            } else {
              console.warn(
                `⚠️ FFmpeg exited with code ${code} - this may be normal for streaming`,
              );
              resolve(); // Resolve anyway since streaming termination is often expected
            }
          });
        });
      } else {
        throw new Error("Failed to publish audio track");
      }
    } catch (error) {
      console.error(
        `❌ [${this.channelId}] Failed to set up streaming:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Play audio from a finite stream (for regular audio files)
   * @private
   */
  private async playFromStream(
    stream: Readable,
    source?: string,
    type?: string,
  ): Promise<void> {
    // Reset stop flags when starting new playback
    this.shouldStop = false;
    this.isStreaming = false; // This is not streaming audio, it's converted PCM

    const pcmData = await this.convertAudioToPCM(stream, 48000, 1);
    this.emit("debug", "PCM conversion completed", { source, type });

    await this.publishPCMAudio(pcmData);
    this.emit("debug", "Audio publishing completed", { source, type });

    // Emit audioEnd event if source information is provided
    if (source && type) {
      this.emit("debug", "Emitting audioEnd event", { source, type });
      this.emit("audioEnd", source, type);
    } else {
      this.emit("debug", "No source/type provided, skipping audioEnd", {
        source,
        type,
      });
    }
  }

  /**
   * Convert audio to PCM format using node-av if available, fallback to FFmpeg
   * @private
   */
  private async convertAudioToPCM(
    input: string | Readable,
    sampleRate: number = 48000,
    channels: number = 1,
  ): Promise<Int16Array> {
    const sourceDesc = typeof input === "string" ? input : "stream";

    this.emit("conversionStart", sourceDesc, sampleRate, channels);

    // Check if node-av is available and use it first
    if (isNodeAVAvailable()) {
      this.emit("debug", "Using node-av for audio conversion", {
        source: sourceDesc,
        sampleRate,
        channels,
      });

      // Use node-av processor - no fallback to FFmpeg since node-av is installed
      return await nodeAVProcessor.convertAudioToPCM(
        input,
        sampleRate,
        channels,
      );
    }

    // Only use FFmpeg if node-av is not available
    this.emit(
      "debug",
      "node-av not available, using FFmpeg for audio conversion",
      {
        source: sourceDesc,
        sampleRate,
        channels,
      },
    );

    return new Promise((resolve, reject) => {
      const args = [];

      if (typeof input === "string") {
        // File path input
        args.push("-i", input);
      } else {
        // Stream input
        args.push("-i", "pipe:0"); // Read from stdin
      }

      args.push(
        "-f",
        "s16le", // 16-bit little-endian PCM
        "-ar",
        sampleRate.toString(), // Sample rate
        "-ac",
        channels.toString(), // Number of channels
        "-", // Output to stdout
      );

      const ffmpeg = spawn("ffmpeg", args);
      const chunks: Buffer[] = [];
      let errorOutput = "";

      // Handle FFmpeg output
      ffmpeg.stdout.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      // Capture error messages
      ffmpeg.stderr.on("data", (data: Buffer) => {
        errorOutput += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          const pcmBuffer = Buffer.concat(chunks);
          const int16Array = new Int16Array(
            pcmBuffer.buffer,
            pcmBuffer.byteOffset,
            pcmBuffer.length / 2,
          );

          this.emit("conversionEnd", sourceDesc, int16Array.length);
          this.emit("debug", "FFmpeg conversion completed", {
            pcmDataSize: int16Array.length,
            bufferSize: pcmBuffer.length,
          });

          resolve(int16Array);
        } else {
          const error = new Error(
            `FFmpeg failed with code ${code}: ${errorOutput}`,
          );
          this.emit("conversionError", sourceDesc, error);
          console.error(error);
        }
      });

      ffmpeg.on("error", (err) => {
        const error = new Error(`FFmpeg spawn error: ${err.message}`);
        this.emit("conversionError", sourceDesc, error);
        console.error(error);
      });

      // Send audio data to FFmpeg
      if (typeof input === "string") {
        ffmpeg.stdin.end();
      } else {
        input.pipe(ffmpeg.stdin);
        input.on("end", () => {
          ffmpeg.stdin.end();
        });
        input.on("error", (err) => {
          ffmpeg.kill("SIGTERM");
          console.error(err);
        });
      }
    });
  }

  /**
   * Publish PCM audio to the voice channel
   */
  private async publishPCMAudio(pcmData: Int16Array): Promise<void> {
    if (!this.room) {
      throw new Error(
        `Not connected to voice channel ${this.channelId}. Call connect() first.`,
      );
    }

    // Apply volume control to the PCM data
    const volumeAdjustedPCM = this.applyVolume(pcmData);

    return new Promise<void>((resolve, reject) => {
      const processAudio = async () => {
        try {
          // Create audio source with 48kHz, mono, 16-bit
          const source = new AudioSource(48000, 1);
          const sourceId = `file_${Date.now()}`;
          this.audioSources.set(sourceId, source);
          const track = LocalAudioTrack.createAudioTrack("audio", source);
          const options = new TrackPublishOptions();
          options.source = TrackSource.SOURCE_MICROPHONE;

          // Publish the track
          if (!this.room!.localParticipant) {
            throw new Error("Room local participant not available");
          }
          const publication = await this.room!.localParticipant.publishTrack(
            track,
            options,
          );

          if (publication) {
            // Store the publication for later cleanup
            this.publications.set(publication.sid!, publication);

            this.emit("trackPublished", publication.sid!);
            this.emit("debug", "Audio track published successfully", {
              trackId: publication.sid,
              publicationCount: this.publications.size,
            });

            // Try different methods to unmute the track
            try {
              // Try multiple unmute approaches
              if (typeof (publication as any).setMuted === "function") {
                await (publication as any).setMuted(false);
              } else if (typeof (track as any).setMuted === "function") {
                await (track as any).setMuted(false);
              }

              // Try to ensure the track is enabled and active
              if (typeof (track as any).setEnabled === "function") {
                await (track as any).setEnabled(true);
              }
            } catch (error) {
              this.emit("error", error, "track-unmute");
            }

            // Stream PCM audio in real-time chunks (matching working implementation)
            const chunkDurationMs = 100; // 100ms chunks (like working implementation)
            const samplesPerChunk =
              Math.floor((48000 * chunkDurationMs) / 1000) * 1; // sampleRate * duration * channels
            let offset = 0;
            let chunksSent = 0;

            while (offset < volumeAdjustedPCM.length && !this.shouldStop) {
              const chunkEnd = Math.min(
                offset + samplesPerChunk,
                volumeAdjustedPCM.length,
              );
              const chunk = volumeAdjustedPCM.slice(offset, chunkEnd);

              // Create AudioFrame with proper format (using total samples, not per-channel)
              const frame = new AudioFrame(
                chunk,
                48000, // sampleRate
                1, // channels (mono)
                chunk.length, // total samples in chunk
              );

              // Capture the audio frame with better error handling
              try {
                await source.captureFrame(frame);
                chunksSent++;
              } catch (error) {
                this.emit("error", error, "frame-capture");
                // Don't reject on individual frame errors, continue playback
              }

              offset = chunkEnd;

              // Wait for real-time playback (like the working implementation)
              await new Promise((resolve) =>
                setTimeout(resolve, chunkDurationMs),
              );
            }

            if (this.shouldStop) {
              this.emit("debug", "Audio playback stopped by user", {
                channelId: this.channelId,
                chunksSent,
              });
            } else {
              this.emit("debug", "Audio playback completed successfully", {
                channelId: this.channelId,
                chunksSent,
                totalSamples: volumeAdjustedPCM.length,
              });
            }
            this.emit("debug", "publishPCMAudio resolving");
            resolve();
          } else {
            console.error(new Error("Failed to publish audio track"));
          }
        } catch (error) {
          console.error(
            `❌ [${this.channelId}] Failed to publish audio:`,
            error,
          );
          console.error(error);
        }
      };

      processAudio();
    });
  }

  /**
   * Play audio from a file
   * @private
   */
  private async playFromFile(filePath: string): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    // Reset stop flags when starting new playback
    this.shouldStop = false;
    this.isStreaming = false; // Ensure streaming is disabled for file playback

    this.emit("audioStart", filePath, "file");
    this.emit("debug", "Starting file playback", { filePath });

    try {
      const pcmData = await this.convertAudioToPCM(filePath, 48000, 1);
      await this.publishPCMAudio(pcmData);

      this.emit("audioEnd", filePath, "file");
      this.emit("debug", "File playback completed", { filePath });
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));

      this.emit("audioError", filePath, "file", errorObj);
      this.emit("error", errorObj, "file-playback");

      console.error(`❌ [${this.channelId}] File playback failed:`, error);
      throw error;
    }
  }

  /**
   * Stop current audio playback
   */
  async stop(trackName?: string): Promise<void> {
    // Set the stop flags to halt any ongoing playback loops
    this.shouldStop = true;
    this.isStreaming = false;

    if (!this.room) {
      return;
    }

    if (trackName) {
      // Stop specific track
      const publication = this.publications.get(trackName);
      if (publication) {
        try {
          await this.room.localParticipant?.unpublishTrack(publication.sid!);
          this.publications.delete(trackName);
          this.emit("trackStopped", trackName);
        } catch (error) {
          console.error(
            `❌ [${this.channelId}] Failed to stop track ${trackName}:`,
            error,
          );
        }
      }
    } else {
      // Stop all tracks
      for (const [sid, publication] of this.publications) {
        try {
          await this.room.localParticipant?.unpublishTrack(publication.sid!);
          this.emit("trackStopped", sid);
        } catch (error) {
          console.error(
            `❌ [${this.channelId}] Failed to stop track ${sid}:`,
            error,
          );
        }
      }
      this.publications.clear();
    }
  }

  /**
   * Disconnect from the voice channel
   */
  async disconnect(): Promise<void> {
    if (!this.room) {
      return;
    }

    try {
      // Stop all audio tracks first
      await this.stop();

      // Clean up audio sources tracking
      this.audioSources.clear();

      // Disconnect from the room
      await this.room.disconnect();

      // Clean up
      this.isConnected = false;
      this.publications.clear();
      this.room = undefined;

      this.emit("disconnected", this.channelId, this.serverId, "manual");
      this.emit("debug", "Disconnected manually");
    } catch (error) {
      console.error(`❌ [${this.channelId}] Error during disconnect:`, error);
      // Still clean up even if there was an error
      this.isConnected = false;
      this.publications.clear();
      this.audioSources.clear();
      this.room = undefined;
      throw error;
    }
  }

  /**
   * Handle unexpected disconnection
   * @private
   */
  private async handleDisconnected(): Promise<void> {
    // Clean up audio sources tracking
    this.audioSources.clear();

    this.isConnected = false;
    this.publications.clear();
    this.room = undefined;

    this.emit("disconnected", this.channelId, this.serverId, "unexpected");
    this.emit("debug", "Voice disconnected unexpectedly");
  }

  /**
   * Get player status information
   */
  getStatus(): {
    connected: boolean;
    volume: number;
    activeTracksCount: number;
    channelId: string;
    serverId: string;
  } {
    return {
      connected: this.connected,
      volume: this._volume,
      activeTracksCount: this.publications.size,
      channelId: this.channelId,
      serverId: this.serverId,
    };
  }
}
