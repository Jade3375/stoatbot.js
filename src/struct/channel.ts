import { Base } from "./base";
import type {
  DMChannel,
  GroupChannel,
  ServerChannel,
  TextChannel,
  VoiceChannel,
} from "./index";
import { ChannelTypes, UUID } from "../utils/index";
import { CreateChannelOptions } from "../managers/serverChannelManager";
import {
  editablePermissions,
  createWebhookResponse,
  editWebhookOptions,
} from "../utils/types";
import { FullPermissions } from "../utils/permissions";
import { MessageOptions } from "../managers/messageManager";
import { Message as APIMessage } from "revolt-api";
import { Readable } from "stream";

/**
 * Represents a generic communication channel in the client.
 * This abstract class provides a base structure and common functionality
 * for all types of channels, such as text, voice, group, and server channels.
 *
 * @abstract
 * @extends Base
 *
 * @property {ChannelTypes | "UNKNOWN"} type - The type of the channel. Defaults to "UNKNOWN".
 * @property {number} createdTimestamp - The timestamp (in milliseconds) when the channel was created.
 * @property {Date} createdAt - The date and time when the channel was created.
 */
export abstract class Channel extends Base {
  type: ChannelTypes | "UNKNOWN" = "UNKNOWN";

  /**
   * Gets the timestamp (in milliseconds) when the channel was created.
   *
   * @returns {number} The timestamp of the channel's creation.
   */
  get createdTimestamp(): number {
    return this.createdAt.getTime();
  }

  /**
   * Gets the date and time when the channel was created.
   *
   * @returns {Date} The creation date of the channel.
   */
  get createdAt(): Date {
    return UUID.timestampOf(this.id);
  }

  /**
   * Deletes the current channel instance from the client's channel collection.
   *
   * This method interacts with the client's channel management system to remove
   * the channel. Once deleted, the channel will no longer be accessible through
   * the client.
   *
   * @returns {Promise<void>} A promise that resolves when the channel has been successfully deleted.
   *
   * @example
   * ```typescript
   * const channel = client.channels.get('1234567890');
   * if (channel) {
   *   await channel.delete();
   *   console.log('Channel deleted successfully.');
   * }
   * ```
   */
  delete(): Promise<void> {
    return this.client.channels.delete(this);
  }

  /**
   * Checks if the channel is a text-based channel.
   *
   * @returns {boolean} True if the channel is a text-based channel, otherwise false.
   */
  isText(): this is TextChannel | GroupChannel | DMChannel {
    return "messages" in this;
  }

  /**
   * Checks if the channel is a voice channel.
   *
   * @returns {boolean} True if the channel is a voice channel, otherwise false.
   */
  isVoice(): this is VoiceChannel {
    return this.type === ChannelTypes.VOICE;
  }

  /**
   * Checks if the channel is a group channel.
   *
   * @returns {boolean} True if the channel is a group channel, otherwise false.
   */
  isGroup(): this is GroupChannel {
    return this.type === ChannelTypes.GROUP;
  }

  /**
   * Checks if the channel is part of a server.
   *
   * @returns {boolean} True if the channel is a server channel, otherwise false.
   */
  inServer(): this is ServerChannel {
    return "serverId" in this;
  }

  /**
   * Converts the channel to a string representation.
   *
   * @returns {string} A string representation of the channel in the format `<#channelId>`.
   */
  toString(): string {
    return `<#${this.id}>`;
  }

  /**
   * Fetches the latest data for the channel from the client's channel collection.
   *
   * @param {boolean} [force=true] - Whether to force a fetch even if the channel is cached.
   * @returns {Promise<Channel>} A promise that resolves with the updated channel instance.
   */
  fetch(force = true): Promise<Channel> {
    return this.client.channels.fetch(this, { force });
  }

  async edit(
    data: Partial<CreateChannelOptions>,
  ): Promise<{ channel_type: string; _id: string; user: string }> {
    const id = this.id;
    if (!id) {
      throw new TypeError("INVALID_ID");
    }

    const response = await this.client.api.patch(`/channels/${id}`, {
      body: data,
    });

    return response as { channel_type: string; _id: string; user: string };
  }

  /**
   * Sets role permissions for this channel.
   *
   * @param roleId - The ID of the role to set permissions for.
   * @param allow - Array of permissions to allow for the role.
   * @returns A promise that resolves when the permissions have been updated.
   *
   * @throws {TypeError} If the channel ID is invalid.
   *
   * @example
   * ```typescript
   * // Allow specific permissions
   * await channel.setRolePermissions(roleId, ["ViewChannel", "SendMessage"]);
   * ```
   */
  async setRolePermissions(
    roleId: string,
    allow: editablePermissions["a"],
  ): Promise<void>;

  /**
   * Sets role permissions for this channel.
   *
   * @param roleId - The ID of the role to set permissions for.
   * @param allow - Array of permissions to allow for the role.
   * @param deny - Array of permissions to deny for the role.
   * @returns A promise that resolves when the permissions have been updated.
   *
   * @throws {TypeError} If the channel ID is invalid.
   *
   * @example
   * ```typescript
   * // Set both allow and deny permissions
   * await channel.setRolePermissions(roleId, ["ViewChannel"], ["ManageMessages"]);
   * ```
   */
  async setRolePermissions(
    roleId: string,
    allow: editablePermissions["a"],
    deny: editablePermissions["d"],
  ): Promise<void>;

  /**
   * Sets role permissions for this channel.
   *
   * @param roleId - The ID of the role to set permissions for.
   * @param options - Object containing allow and/or deny permissions.
   * @returns A promise that resolves when the permissions have been updated.
   *
   * @throws {TypeError} If the channel ID is invalid or if both allow and deny are undefined.
   *
   * @example
   * ```typescript
   * // Allow specific permissions only
   * await channel.setRolePermissions(roleId, { allow: ["ViewChannel", "SendMessage"] });
   *
   * // Deny specific permissions only
   * await channel.setRolePermissions(roleId, { deny: ["ManageMessages"] });
   *
   * // Set both allow and deny permissions
   * await channel.setRolePermissions(roleId, {
   *   allow: ["ViewChannel"],
   *   deny: ["ManageMessages"]
   * });
   * ```
   */
  async setRolePermissions(
    roleId: string,
    options: {
      allow?: editablePermissions["a"];
      deny?: editablePermissions["d"];
    },
  ): Promise<void>;

  // Implementation
  async setRolePermissions(
    roleId: string,
    allowOrOptions?:
      | editablePermissions["a"]
      | {
          allow?: editablePermissions["a"];
          deny?: editablePermissions["d"];
        },
    deny?: editablePermissions["d"],
  ): Promise<void> {
    const id = this.id;
    if (!id) {
      throw new TypeError("INVALID_ID");
    }

    let allow: editablePermissions["a"] | undefined;
    let denyPermissions: editablePermissions["d"] | undefined;

    // Handle different overload patterns
    if (Array.isArray(allowOrOptions)) {
      // First two overloads: setRolePermissions(roleId, allow) or setRolePermissions(roleId, allow, deny)
      allow = allowOrOptions;
      denyPermissions = deny;
    } else if (allowOrOptions && typeof allowOrOptions === "object") {
      // Third overload: setRolePermissions(roleId, { allow?, deny? })
      allow = allowOrOptions.allow;
      denyPermissions = allowOrOptions.deny;

      if (allow === undefined && denyPermissions === undefined) {
        throw new TypeError(
          "At least one of 'allow' or 'deny' must be provided in options",
        );
      }
    } else {
      throw new TypeError("Invalid arguments provided");
    }

    const requestBody: {
      allow?: number;
      deny?: number;
    } = {
      allow: 0,
      deny: 0,
    };

    if (allow !== undefined) {
      requestBody.allow = new FullPermissions(allow).bitfield;
    }
    if (denyPermissions !== undefined) {
      requestBody.deny = new FullPermissions(denyPermissions).bitfield;
    }

    await this.client.api.put(`/channels/${id}/permissions/${roleId}`, {
      body: { permissions: requestBody },
    });
  }

  /**
   * Sets default permissions for this channel.
   *
   * @param allow - Array of permissions to allow by default.
   * @returns A promise that resolves when the permissions have been updated.
   *
   * @throws {TypeError} If the channel ID is invalid.
   *
   * @example
   * ```typescript
   * // Allow specific permissions
   * await channel.setDefaultPermissions(["ViewChannel", "SendMessage"]);
   * ```
   */
  async setDefaultPermissions(allow: editablePermissions["a"]): Promise<void>;

  /**
   * Sets default permissions for this channel.
   *
   * @param options - Object containing allow and/or deny permissions.
   * @returns A promise that resolves when the permissions have been updated.
   *
   * @throws {TypeError} If the channel ID is invalid or if both allow and deny are undefined.
   *
   * @example
   * ```typescript
   * // Allow specific permissions only
   * await channel.setDefaultPermissions({ allow: ["ViewChannel", "SendMessage"] });
   *
   * // Deny specific permissions only
   * await channel.setDefaultPermissions({ deny: ["ManageMessages"] });
   *
   * // Set both allow and deny permissions
   * await channel.setDefaultPermissions({
   *   allow: ["ViewChannel"],
   *   deny: ["ManageMessages"]
   * });
   * ```
   */
  async setDefaultPermissions(options: {
    allow?: editablePermissions["a"];
    deny?: editablePermissions["d"];
  }): Promise<void>;

  /**
   * Sets default permissions for this channel (legacy format).
   *
   * @param permissions - Object containing allow and deny permissions.
   * @returns A promise that resolves when the permissions have been updated.
   *
   * @throws {TypeError} If the channel ID is invalid.
   *
   * @example
   * ```typescript
   * // Legacy format
   * await channel.setDefaultPermissions({
   *   a: ["ViewChannel"],
   *   d: ["ManageMessages"]
   * });
   * ```
   */
  async setDefaultPermissions(permissions: editablePermissions): Promise<void>;

  // Implementation
  async setDefaultPermissions(
    allowOrOptionsOrPermissions?:
      | editablePermissions["a"]
      | {
          allow?: editablePermissions["a"];
          deny?: editablePermissions["d"];
        }
      | editablePermissions,
  ): Promise<void> {
    const id = this.id;
    if (!id) {
      throw new TypeError("INVALID_ID");
    }

    let allow: editablePermissions["a"] | undefined;
    let deny: editablePermissions["d"] | undefined;

    // Handle different overload patterns
    if (Array.isArray(allowOrOptionsOrPermissions)) {
      // First overload: setDefaultPermissions(allow)
      allow = allowOrOptionsOrPermissions;
    } else if (
      allowOrOptionsOrPermissions &&
      typeof allowOrOptionsOrPermissions === "object"
    ) {
      // Check if it's the legacy format (has 'a' or 'd' properties)
      if (
        "a" in allowOrOptionsOrPermissions ||
        "d" in allowOrOptionsOrPermissions
      ) {
        // Third overload: setDefaultPermissions({ a, d }) - legacy format
        const legacyPerms = allowOrOptionsOrPermissions as editablePermissions;
        allow = legacyPerms.a;
        deny = legacyPerms.d;
      } else {
        // Second overload: setDefaultPermissions({ allow?, deny? })
        const options = allowOrOptionsOrPermissions as {
          allow?: editablePermissions["a"];
          deny?: editablePermissions["d"];
        };
        allow = options.allow;
        deny = options.deny;

        if (allow === undefined && deny === undefined) {
          throw new TypeError(
            "At least one of 'allow' or 'deny' must be provided in options",
          );
        }
      }
    } else {
      throw new TypeError("Invalid arguments provided");
    }

    const requestBody: {
      allow?: number;
      deny?: number;
    } = {};

    if (allow !== undefined) {
      requestBody.allow = new FullPermissions(allow).bitfield;
    }
    if (deny !== undefined) {
      requestBody.deny = new FullPermissions(deny).bitfield;
    }

    // Set defaults for undefined permissions
    if (requestBody.allow === undefined) {
      requestBody.allow = 0;
    }
    if (requestBody.deny === undefined) {
      requestBody.deny = 0;
    }

    await this.client.api.put(`/channels/${id}/permissions/default`, {
      body: { permissions: requestBody },
    });
  }

  /**
   * Creates a new webhook in this channel.
   *
   * @param name - The name of the webhook
   * @param avatar - Optional avatar for the webhook. Can be a URL string, Readable stream, or File object
   * @returns Promise resolving to the created webhook response
   *
   * @example
   * ```typescript
   * const webhook = await channel.createWebhook("My Webhook", "https://example.com/avatar.png");
   * ```
   */
  async createWebhook(
    name: string,
    avatar?: Readable | string | File,
  ): Promise<createWebhookResponse> {
    return this.client.webhooks.create(this.id, name, avatar);
  }

  /**
   * Retrieves all webhooks for this channel.
   *
   * @returns Promise resolving to an array of webhook responses
   *
   * @example
   * ```typescript
   * const webhooks = await channel.getWebhooks();
   * console.log(`Found ${webhooks.length} webhooks`);
   * ```
   */
  async getWebhooks(): Promise<createWebhookResponse[]> {
    return this.client.webhooks.getAll(this.id);
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
   * const webhook = await channel.getWebhook("webhookId", "webhookToken");
   * console.log(`Webhook name: ${webhook.name}`);
   * ```
   */
  async getWebhook(
    webhookId: string,
    token: string,
  ): Promise<createWebhookResponse> {
    return this.client.webhooks.get(webhookId, token);
  }

  /**
   * Sends a message through a webhook in this channel.
   *
   * @param webhookId - The ID of the webhook to send the message through
   * @param token - The token of the webhook
   * @param content - The message content. Can be a string or MessageOptions object with attachments and embeds
   * @returns Promise resolving to the sent message
   *
   * @example
   * ```typescript
   * // Send a simple text message
   * await channel.sendWebhookMessage("webhookId", "token", "Hello, world!");
   *
   * // Send a message with embeds and attachments
   * await channel.sendWebhookMessage("webhookId", "token", {
   *   content: "Check out this image!",
   *   attachments: ["https://example.com/image.png"],
   *   embeds: [myEmbed]
   * });
   * ```
   */
  async sendWebhookMessage(
    webhookId: string,
    token: string,
    content: MessageOptions | string,
  ): Promise<APIMessage> {
    return this.client.webhooks.send(webhookId, token, content);
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
   * await channel.deleteWebhook("webhookId", "webhookToken");
   * console.log("Webhook deleted successfully");
   * ```
   */
  async deleteWebhook(webhookId: string, token: string): Promise<void> {
    return this.client.webhooks.delete(webhookId, token);
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
   * const updatedWebhook = await channel.editWebhook("webhookId", "token", {
   *   name: "New Webhook Name",
   *   avatar: "https://example.com/new-avatar.png"
   * });
   * ```
   */
  async editWebhook(
    webhookId: string,
    token: string,
    options: editWebhookOptions,
  ): Promise<createWebhookResponse> {
    return this.client.webhooks.edit(webhookId, token, options);
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
   * const partialWebhook = await channel.getPartialWebhook("webhookId");
   * console.log(`Webhook name: ${partialWebhook.name}`);
   * ```
   */
  async getPartialWebhook(webhookId: string): Promise<createWebhookResponse> {
    return this.client.webhooks.getPartial(webhookId);
  }
}
