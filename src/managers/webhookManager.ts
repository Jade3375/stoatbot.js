import { Readable } from "stream";
import type { client } from "../client/client";
import {
  CDNAttachmentResponse,
  createWebhookResponse,
  editWebhookOptions,
} from "../utils/types";
import axios from "axios";
import FormData from "form-data";
import { UUID } from "../utils";
import { SendableEmbed, Message as APIMessage } from "revolt-api";
import { MessageOptions } from "./messageManager";

/**
 * Manages webhooks for the client.
 * Provides methods for creating, managing, and sending messages through webhooks.
 */
export class WebhookManager {
  /**
   * Creates a new WebhookManager instance.
   *
   * @param client - The client instance this manager belongs to
   */
  constructor(protected readonly client: client) {}

  /**
   * Creates a new webhook in the specified channel.
   *
   * @param channelId - The ID of the channel where the webhook will be created
   * @param name - The name of the webhook
   * @param avatar - Optional avatar for the webhook. Can be a URL string, Readable stream, or File object
   * @returns Promise resolving to the created webhook response
   *
   * @example
   * ```typescript
   * const webhook = await client.webhooks.create("channelId", "My Webhook", "https://example.com/avatar.png");
   * ```
   */
  async create(
    channelId: string,
    name: string,
    avatar?: Readable | string | File,
  ): Promise<createWebhookResponse> {
    const data = new FormData();
    let avatarID: string | undefined = undefined;
    if (typeof avatar === "string") {
      const readableStream = (await axios.get(avatar, {
        responseType: "stream",
      })) as { data: Readable };
      data.append("file", readableStream.data, {
        filename: avatar.split("/").pop(),
      });
    }

    if (avatar instanceof Readable) {
      data.append("file", avatar, { filename: "avatar.png" });
    }

    if (avatar instanceof File) {
      const buffer = Buffer.from(await avatar.arrayBuffer());
      data.append("file", buffer, { filename: avatar.name });
    }

    if (avatar) {
      await this.client.cdn.post("/avatars", data).then((attachment) => {
        const { id } = attachment as CDNAttachmentResponse;
        avatarID = id;
      });
    }

    const response = (await this.client.api.post(
      `/channels/${channelId}/webhooks`,
      {
        body: {
          name,
          avatar: avatarID,
        },
      },
    )) as createWebhookResponse;

    return response;
  }

  /**
   * Retrieves all webhooks for the specified channel.
   *
   * @param channelId - The ID of the channel to get webhooks from
   * @returns Promise resolving to an array of webhook responses
   *
   * @example
   * ```typescript
   * const webhooks = await client.webhooks.getAll("channelId");
   * console.log(`Found ${webhooks.length} webhooks`);
   * ```
   */
  async getAll(channelId: string): Promise<createWebhookResponse[]> {
    const response = (await this.client.api.get(
      `/channels/${channelId}/webhooks`,
    )) as createWebhookResponse[];
    return response;
  }

  /**
   * Retrieves a specific webhook by ID and token.
   *
   * @param webhookId - The ID of the webhook to retrieve
   * @param token - The token of the webhook
   * @returns Promise resolving to the webhook response
   *
   * @example
   * ```typescript
   * const webhook = await client.webhooks.get("webhookId", "webhookToken");
   * console.log(`Webhook name: ${webhook.name}`);
   * ```
   */
  async get(webhookId: string, token: string): Promise<createWebhookResponse> {
    const response = (await this.client.api.get(
      `/webhooks/${webhookId}/${token}`,
    )) as createWebhookResponse;
    return response;
  }

  /**
   * Sends a message through a webhook.
   *
   * @param webhookId - The ID of the webhook to send the message through
   * @param token - The token of the webhook
   * @param content - The message content. Can be a string or MessageOptions object with attachments and embeds
   * @returns Promise resolving to the sent message
   *
   * @example
   * ```typescript
   * // Send a simple text message
   * await client.webhooks.send("webhookId", "token", "Hello, world!");
   *
   * // Send a message with embeds and attachments
   * await client.webhooks.send("webhookId", "token", {
   *   content: "Check out this image!",
   *   attachments: ["https://example.com/image.png"],
   *   embeds: [myEmbed]
   * });
   * ```
   */
  async send(
    webhookId: string,
    token: string,
    content: MessageOptions | string,
  ): Promise<APIMessage> {
    if (typeof content === "string") content = { content };
    let attachments: string[] = [];
    let embeds: SendableEmbed[] = [];

    if (Array.isArray(content.attachments)) {
      const promises = content.attachments.map(async (att) => {
        const data = new FormData();
        if (typeof att === "string") {
          const readableStream = (await axios.get(att, {
            responseType: "stream",
          })) as { data: Readable };
          data.append("file", readableStream.data, {
            filename: att.split("/").pop(),
          });
        }

        if (att instanceof Readable) {
          data.append("file", att);
        }

        if (att instanceof File) {
          const buffer = Buffer.from(await att.arrayBuffer());
          data.append("file", buffer, { filename: att.name });
        }

        await this.client.cdn.post("/attachments", data).then((attachment) => {
          const { id } = attachment as CDNAttachmentResponse;
          attachments.push(id);
        });
      });
      await Promise.all(promises);
    }

    if (Array.isArray(content.embeds)) {
      const promises = content.embeds.map(async (embed) => {
        const json = await embed.toJSONWithMedia(this.client);
        embeds.push(json);
      });
      await Promise.all(promises);
    }

    const resp = (await this.client.api.post(
      `/webhooks/${webhookId}/${token}`,
      {
        body: { ...content, attachments, embeds, nonce: UUID.generate() },
      },
    )) as APIMessage;

    return resp;
  }

  /**
   * Deletes a webhook.
   *
   * @param webhookId - The ID of the webhook to delete
   * @param token - The token of the webhook
   * @returns Promise that resolves when the webhook is deleted
   *
   * @example
   * ```typescript
   * await client.webhooks.delete("webhookId", "webhookToken");
   * console.log("Webhook deleted successfully");
   * ```
   */
  async delete(webhookId: string, token: string): Promise<void> {
    await this.client.api.delete(`/webhooks/${webhookId}/${token}`);
  }

  /**
   * Edits a webhook's properties.
   *
   * @param webhookId - The ID of the webhook to edit
   * @param token - The token of the webhook
   * @param options - The options to edit on the webhook
   * @returns Promise resolving to the updated webhook response
   *
   * @example
   * ```typescript
   * const updatedWebhook = await client.webhooks.edit("webhookId", "token", {
   *   name: "New Webhook Name",
   *   avatar: "https://example.com/new-avatar.png"
   * });
   * ```
   */
  async edit(
    webhookId: string,
    token: string,
    options: editWebhookOptions,
  ): Promise<createWebhookResponse> {
    const data = new FormData();
    let avatarID: string | undefined = undefined;
    if (typeof options.avatar === "string") {
      const readableStream = (await axios.get(options.avatar, {
        responseType: "stream",
      })) as { data: Readable };
      data.append("file", readableStream.data, {
        filename: options.avatar.split("/").pop(),
      });
    }

    if (options.avatar instanceof Readable) {
      data.append("file", options.avatar, { filename: "avatar.png" });
    }

    if (options.avatar instanceof File) {
      const buffer = Buffer.from(await options.avatar.arrayBuffer());
      data.append("file", buffer, { filename: options.avatar.name });
    }

    if (options.avatar) {
      await this.client.cdn.post("/avatars", data).then((attachment) => {
        const { id } = attachment as CDNAttachmentResponse;
        avatarID = id;
      });
    }

    const response = (await this.client.api.patch(
      `/webhooks/${webhookId}/${token}`,
      {
        body: {
          ...options,
          avatar: avatarID,
          remove: options.remove ?? [],
        },
      },
    )) as createWebhookResponse;
    return response;
  }

  /**
   * Retrieves partial information about a webhook using only its ID.
   * This method provides limited webhook information without requiring a token.
   *
   * @param webhookId - The ID of the webhook to retrieve partial information for
   * @returns Promise resolving to the webhook response with partial information
   *
   * @example
   * ```typescript
   * const partialWebhook = await client.webhooks.getPartial("webhookId");
   * console.log(`Webhook name: ${partialWebhook.name}`);
   * ```
   */
  async getPartial(webhookId: string): Promise<createWebhookResponse> {
    const response = (await this.client.api.get(
      `/webhooks/${webhookId}`,
    )) as createWebhookResponse;
    return response;
  }
}
