import { clientOptions } from "../client/baseClient";
import { UUID } from "./UUID";

/**
 * Enum representing the client events that can be emitted.
 * @private
 */
export enum Events {
  CHANNEL_CREATE = "channelCreate",
  CHANNEL_DELETE = "channelDelete",
  CHANNEL_UPDATE = "channelUpdate",
  DEBUG = "debug",
  ERROR = "error",
  GROUP_JOIN = "groupJoin",
  GROUP_LEAVE = "groupLeave",
  MESSAGE = "message",
  MESSAGE_DELETE = "messageDelete",
  MESSAGE_DELETE_BULK = "messageDeleteBulk",
  MESSAGE_UPDATE = "messageUpdate",
  MESSAGE_REACT = "messageReact",
  MESSAGE_REACT_REMOVE = "messageUnreact",
  RAW = "raw",
  READY = "ready",
  ROLE_CREATE = "roleCreate",
  ROLE_DELETE = "roleDelete",
  ROLE_UPDATE = "roleUpdate",
  SERVER_CREATE = "serverCreate",
  SERVER_DELETE = "serverDelete",
  SERVER_MEMBER_JOIN = "serverMemberJoin",
  SERVER_MEMBER_LEAVE = "serverMemberLeave",
  SERVER_MEMBER_UPDATE = "serverMemberUpdate",
  SERVER_UPDATE = "serverUpdate",
  TYPING_START = "typingStart",
  TYPING_STOP = "typingStop",
  USER_UPDATE = "userUpdate",
  WEBHOOKS_CREATE = "webhookCreate",
  WEBHOOKS_DELETE = "webhookDelete",
  WEBHOOKS_UPDATE = "webhookUpdate",
}

/**
 * Enum representing the WebSocket events used for communication.
 * @private
 */
export enum WSEvents {
  AUTHENTICATE = "Authenticate",
  AUTHENTICATED = "Authenticated",
  BEGIN_TYPING = "BeginTyping",
  BULK = "Bulk",
  CHANNEL_ACK = "ChannelAck",
  CHANNEL_CREATE = "ChannelCreate",
  CHANNEL_DELETE = "ChannelDelete",
  CHANNEL_GROUP_JOIN = "ChannelGroupJoin",
  CHANNEL_GROUP_LEAVE = "ChannelGroupLeave",
  CHANNEL_START_TYPING = "ChannelStartTyping",
  CHANNEL_STOP_TYPING = "ChannelStopTyping",
  CHANNEL_UPDATE = "ChannelUpdate",
  END_TYPING = "EndTyping",
  ERROR = "Error",
  MESSAGE = "Message",
  MESSAGE_BULK_DELETE = "BulkMessageDelete",
  MESSAGE_DELETE = "MessageDelete",
  MESSAGE_UPDATE = "MessageUpdate",
  PING = "Ping",
  PONG = "Pong",
  READY = "Ready",
  SERVER_DELETE = "ServerDelete",
  SERVER_MEMBER_JOIN = "ServerMemberJoin",
  SERVER_MEMBER_LEAVE = "ServerMemberLeave",
  SERVER_MEMBER_UPDATE = "ServerMemberUpdate",
  SERVER_ROLE_DELETE = "ServerRoleDelete",
  SERVER_ROLE_UPDATE = "ServerRoleUpdate",
  SERVER_UPDATE = "ServerUpdate",
  USER_RELATIONSHIP = "UserRelationship",
  USER_UPDATE = "UserUpdate",
  WEBHOOKS_CREATE = "WebhooksCreate",
  WEBHOOKS_DELETE = "WebhooksDelete",
  WEBHOOKS_UPDATE = "WebhooksUpdate",
}

/**
 * Enum representing the types of channels supported by the client.
 */
export enum ChannelTypes {
  DM = "DM",
  GROUP = "GROUP",
  TEXT = "TEXT",
  VOICE = "VOICE",
  NOTES = "NOTES",
}

/**
 * The default options for configuring the client.
 */
export const DEFAULT_CLIENT_OPTIONS: clientOptions = {
  fetchMembers: true,
  rest: {
    timeout: 15000,
    retries: 3,
  },
  MessageCache: {
    maxSize: 1000,
  },
  ws: {
    heartbeatInterval: 30000,
    reconnect: true,
  },
};

/** The base API URL for interacting with the Stoat API. */
export const apiUrl = "https://api.stoat.chat";

/** The system user ID used for identifying system messages. */
export const SYSTEM_USER_ID = "0".repeat(UUID.TIME_LENGTH + UUID.RANDOM_LENGTH);
