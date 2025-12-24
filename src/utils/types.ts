import { Role } from "revolt-api";
import { FullPermissions } from "./permissions";
import { Readable } from "stream";

/**
 * Represents a response from the API when uploading an attachment.
 */
export type CDNAttachmentResponse = {
  id: string;
};

/**
 * Represents a webhook avatar attachment.
 */
export interface WebhookAvatar {
  /** The unique identifier of the attachment. */
  _id: string;
  /** The tag associated with the attachment. */
  tag: string;
  /** The filename of the attachment. */
  filename: string;
  /** Additional metadata for the attachment. */
  metadata: any;
  /** The MIME type of the attachment. */
  content_type: string;
  /** The size of the attachment in bytes. */
  size: number;
}

/**
 * Represents data for a webhook creation event.
 */
export interface WebhookCreateData {
  /** The unique identifier of the webhook. */
  webhookId: string;
  /** The ID of the channel the webhook belongs to. */
  channelId: string;
  /** The name of the webhook. */
  name: string;
  /** The ID of the user who created the webhook. */
  creatorId: string;
  /** The webhook's token. */
  token: string;
}

/**
 * Represents data for a webhook deletion event.
 */
export interface WebhookDeleteData {
  /** The unique identifier of the webhook. */
  webhookId: string;
}

/**
 * Represents data for a webhook update event.
 */
export interface WebhookUpdateData {
  /** The unique identifier of the webhook. */
  webhookId: string;
  /** The updated name of the webhook. */
  name: string;
  /** The updated avatar of the webhook, if any. */
  avatar: WebhookAvatar | undefined;
  /** Fields to remove from the webhook. */
  remove: string[];
}

/**
 * Represents the permissions that can be set for a role.
 */
export type editablePermissions = {
  /**
   * Permissions to allow for the role.
   * Each key corresponds to a permission flag in FullPermissions.
   */
  a?: Array<keyof (typeof FullPermissions)["FLAGS"]>;
  /**
   * Permissions to deny for the role.
   * Each key corresponds to a permission flag in FullPermissions.
   */
  d?: Array<keyof (typeof FullPermissions)["FLAGS"]>;
};

/**
 * Represents a role that can be edited in a server.
 */
export type editableRole = {
  /**
   * Name of the role.
   */
  name?: string;
  /**
   * Colour of the role, or `null` if no colour is set.
   */
  colour?: string | null;
  /**
   * Whether the role is displayed separately in the member list.
   */
  hoist?: boolean;
  /**
   * Rank of the role, used for ordering.
   */
  rank?: number;
  /**
   * Permissions to set for the role.
   * Format: { a: allow, d: deny }
   */
  permissions?: editablePermissions;
  /**
   * Fields to remove from the role.
   * Each key corresponds to a field in the Role type.
   */
  remove?: Array<keyof Role & { [key: string]: unknown }>;
};

/**
 * @private
 */
export interface ApiDiscoveryResponse {
  revolt: string;
  features: Features;
  ws: string; // WebSocket URL
  app: string; // App URL
  vapid: string; // VAPID public key
  build: BuildInfo;
}
/**
 * @private
 */
export interface Features {
  captcha: CaptchaFeature;
  email: boolean;
  invite_only: boolean;
  autumn: ServiceWithUrl; // CDN
  january: ServiceWithUrl; // Proxy
  livekit: LivekitFeature;
}
/**
 * @private
 */
export interface CaptchaFeature {
  enabled: boolean;
  key: string;
}
/**
 * @private
 */
export interface ServiceWithUrl {
  enabled: boolean;
  url: string;
}
/**
 * @private
 */
export interface LivekitFeature {
  enabled: boolean;
  nodes: LivekitNode[];
}
/**
 * @private
 */
export interface LivekitNode {
  name: string;
  lat: number;
  lon: number;
  public_url: string;
}
/**
 * @private
 */
export interface BuildInfo {
  commit_sha: string;
  commit_timestamp: string;
  semver: string;
  origin_url: string;
  timestamp: string;
}

export interface createWebhookResponse {
  id: "string";
  name: "string";
  avatar: {
    _id: "string";
    tag: "string";
    filename: "string";
    metadata: {
      type: "File";
    };
    content_type: "string";
    size: 1;
    deleted: null;
    reported: null;
    message_id: null;
    user_id: null;
    server_id: null;
    object_id: null;
  };
  creator_id: "string";
  channel_id: "string";
  permissions: 0;
  token: null;
}

export interface editWebhookOptions {
  name: string;
  avatar?: Readable | string | File;
  remove?: [];
}
