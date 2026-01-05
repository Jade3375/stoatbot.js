import { Readable } from "node:stream";
import { EventEmitter } from "node:events";

/**
 * NodeAV-based audio processor for converting audio to PCM format
 * This serves as a replacement for FFmpeg functionality when node-av is available
 */
export class NodeAVProcessor extends EventEmitter {
  private nodeAV: any = null;
  private isAvailable: boolean = false;

  constructor() {
    super();
    this.checkAvailability();
  }

  /**
   * Check if node-av package is available
   */
  private async checkAvailability(): Promise<void> {
    try {
      // Dynamically import node-av to avoid dependency issues
      this.nodeAV = await import("node-av");
      this.isAvailable = true;
      this.emit("debug", "node-av package is available and loaded");
    } catch (error) {
      this.isAvailable = false;
      this.emit("debug", "node-av package is not available", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Check if node-av is available for use
   */
  get available(): boolean {
    return this.isAvailable && this.nodeAV !== null;
  }

  /**
   * Convert audio to PCM format using node-av
   * Equivalent to convertAudioToPCM method in the original implementation
   */
  async convertAudioToPCM(
    input: string | Readable,
    sampleRate: number = 48000,
    channels: number = 1,
  ): Promise<Int16Array> {
    if (!this.available || !this.nodeAV) {
      throw new Error("node-av is not available");
    }

    const sourceDesc = typeof input === "string" ? input : "stream";
    this.emit("conversionStart", sourceDesc, sampleRate, channels);

    return new Promise((resolve, reject) => {
      try {
        // Use node-av to read the audio file/stream
        const formatContext = new this.nodeAV.FormatContext(input);
        const pcmChunks: number[] = [];

        formatContext.on("stream", (stream: any) => {
          if (stream.type === "audio") {
            this.emit("debug", "Processing audio stream", {
              codec: stream.codec?.name,
              sampleRate: stream.sampleRate,
              channels: stream.channels,
            });

            // Set up decoder for the stream
            const decoder = new this.nodeAV.Decoder(stream);

            decoder.on("frame", (frame: any) => {
              try {
                // Convert frame data to the target format
                const convertedData = this.convertFrameToTargetFormat(
                  frame,
                  sampleRate,
                  channels,
                );

                if (convertedData) {
                  pcmChunks.push(...convertedData);
                }
              } catch (error) {
                this.emit("debug", "Error converting frame", error);
              }
            });

            decoder.on("end", () => {
              // Convert accumulated data to Int16Array
              const int16Array = new Int16Array(pcmChunks);
              this.emit("conversionEnd", sourceDesc, int16Array.length);
              resolve(int16Array);
            });

            decoder.on("error", (error: Error) => {
              const err = new Error(`node-av decoder error: ${error.message}`);
              this.emit("conversionError", sourceDesc, err);
              reject(err);
            });
          }
        });

        formatContext.on("error", (error: Error) => {
          const err = new Error(
            `node-av format context error: ${error.message}`,
          );
          this.emit("conversionError", sourceDesc, err);
          reject(err);
        });

        // Start reading the input
        formatContext.read();
      } catch (error) {
        const err = new Error(
          `node-av initialization error: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        this.emit("conversionError", sourceDesc, err);
        reject(err);
      }
    });
  }

  /**
   * Create a real-time audio processing stream using node-av
   * Equivalent to the streaming functionality in the original implementation
   */
  async createAudioStream(
    inputStream: Readable,
    sampleRate: number = 48000,
    channels: number = 1,
    onData: (pcmChunk: Int16Array) => Promise<void>,
    onEnd?: () => void,
    onError?: (error: Error) => void,
  ): Promise<void> {
    if (!this.available || !this.nodeAV) {
      throw new Error("node-av is not available");
    }

    return new Promise((resolve, reject) => {
      try {
        const formatContext = new this.nodeAV.FormatContext(inputStream);
        let isProcessing = true;

        formatContext.on("stream", (stream: any) => {
          if (stream.type === "audio") {
            const decoder = new this.nodeAV.Decoder(stream);

            decoder.on("frame", async (frame: any) => {
              try {
                if (!isProcessing) return;

                const convertedData = this.convertFrameToTargetFormat(
                  frame,
                  sampleRate,
                  channels,
                );

                if (convertedData && convertedData.length > 0) {
                  const pcmChunk = new Int16Array(convertedData);
                  await onData(pcmChunk);
                }
              } catch (error) {
                if (onError) {
                  onError(
                    new Error(
                      `Frame processing error: ${error instanceof Error ? error.message : "Unknown error"}`,
                    ),
                  );
                }
              }
            });

            decoder.on("end", () => {
              isProcessing = false;
              if (onEnd) onEnd();
              resolve();
            });

            decoder.on("error", (error: Error) => {
              isProcessing = false;
              const err = new Error(`node-av decoder error: ${error.message}`);
              if (onError) onError(err);
              reject(err);
            });
          }
        });

        // Handle input stream events
        inputStream.on("error", (error) => {
          isProcessing = false;
          if (onError) onError(error);
          reject(error);
        });

        inputStream.on("end", () => {
          isProcessing = false;
          if (onEnd) onEnd();
          resolve();
        });

        // Start processing
        formatContext.read();
      } catch (error) {
        const err = new Error(
          `node-av stream setup error: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        if (onError) onError(err);
        reject(err);
      }
    });
  }

  /**
   * Convert a frame to the target PCM format
   * @private
   */
  private convertFrameToTargetFormat(
    frame: any,
    targetSampleRate: number,
    targetChannels: number,
  ): number[] | null {
    try {
      if (!frame.data || !Array.isArray(frame.data)) {
        return null;
      }

      // Basic format conversion - this is a simplified implementation
      // In a real implementation, you might need more sophisticated resampling
      let samples = frame.data;

      // Simple channel conversion (mono/stereo)
      if (frame.channels !== targetChannels) {
        if (frame.channels === 2 && targetChannels === 1) {
          // Stereo to mono: average channels
          const monoSamples = [];
          for (let i = 0; i < samples.length; i += 2) {
            monoSamples.push((samples[i] + samples[i + 1]) / 2);
          }
          samples = monoSamples;
        } else if (frame.channels === 1 && targetChannels === 2) {
          // Mono to stereo: duplicate channel
          const stereoSamples = [];
          for (let i = 0; i < samples.length; i++) {
            stereoSamples.push(samples[i], samples[i]);
          }
          samples = stereoSamples;
        }
      }

      // Simple sample rate conversion (basic interpolation)
      if (frame.sampleRate !== targetSampleRate) {
        const ratio = targetSampleRate / frame.sampleRate;
        const resampledSamples = [];

        for (let i = 0; i < samples.length * ratio; i++) {
          const originalIndex = i / ratio;
          const floorIndex = Math.floor(originalIndex);
          const ceilIndex = Math.min(
            Math.ceil(originalIndex),
            samples.length - 1,
          );

          if (floorIndex === ceilIndex) {
            resampledSamples.push(samples[floorIndex] || 0);
          } else {
            const fraction = originalIndex - floorIndex;
            const interpolated =
              samples[floorIndex] * (1 - fraction) +
              samples[ceilIndex] * fraction;
            resampledSamples.push(interpolated || 0);
          }
        }
        samples = resampledSamples;
      }

      // Convert to 16-bit integers
      return samples.map((sample: number) => {
        const clampedSample = Math.max(-1, Math.min(1, sample));
        return Math.round(clampedSample * 32767);
      });
    } catch (error) {
      this.emit("debug", "Error in frame conversion", error);
      return null;
    }
  }

  /**
   * Apply volume adjustment to PCM data
   * This is a utility function that matches the original implementation
   */
  static applyVolume(pcmData: Int16Array, volume: number): Int16Array {
    if (volume === 1.0) {
      return pcmData; // No change needed
    }

    const result = new Int16Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      // Apply volume and clamp to prevent overflow
      const sample = Math.round(pcmData[i] * volume);
      result[i] = Math.max(-32768, Math.min(32767, sample));
    }
    return result;
  }
}

/**
 * Singleton instance for global use
 */
export const nodeAVProcessor = new NodeAVProcessor();

/**
 * Check if node-av package is available
 */
export function isNodeAVAvailable(): boolean {
  return nodeAVProcessor.available;
}

/**
 * Get the node-av processor instance
 */
export function getNodeAVProcessor(): NodeAVProcessor {
  return nodeAVProcessor;
}
