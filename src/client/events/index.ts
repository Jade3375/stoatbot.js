// Static event map for robust registration
import { BulkMessageDelete } from "./bulkMessageDelete";
import { ChannelCreate } from "./channelCreate";
import { ChannelDelete } from "./channelDelete";
import { ChannelGroupJoin } from "./channelGroupJoin";
import { ChannelGroupLeave } from "./channelGroupLeave";
import { ChannelStartTyping } from "./channelStarttyping";
import { ChannelStopTyping } from "./channelStopTyping";
import { ChannelUpdate } from "./channelUpdate";
import { Message as MessageReceved } from "./message";
import { MessageDelete } from "./messageDelete";
import { MessageUpdate } from "./messageUpdate";
import { ServerCreate } from "./serverCreate";
import { ServerDelete } from "./serverDelete";
import { ServerMemberJoin } from "./serverMemberJoin";
import { ServerMemberLeave } from "./serverMemberLeave";
import { ServerMemberUpdate } from "./serverMemberUpdate";
import { ServerRoleDelete } from "./serverRoleDelete";
import { ServerRoleUpdate } from "./serverRoleUpdate";
import { ServerUpdate } from "./serverupdate";
import { UserUpdate } from "./userUpdate";
import { MessageReact } from "./messageReact";
import { MessageUnreact } from "./messageUnreact";
import { WebhookCreate } from "./webhookCreate";
import { WebhookDelete } from "./webhookDelete";
import { WebhookUpdate } from "./webhookUpdate";

export const EventMap = {
  bulkMessageDelete: BulkMessageDelete,
  channelCreate: ChannelCreate,
  channelDelete: ChannelDelete,
  channelGroupJoin: ChannelGroupJoin,
  channelGroupLeave: ChannelGroupLeave,
  channelStartTyping: ChannelStartTyping,
  channelStopTyping: ChannelStopTyping,
  channelUpdate: ChannelUpdate,
  message: MessageReceved,
  messageDelete: MessageDelete,
  messageUpdate: MessageUpdate,
  serverCreate: ServerCreate,
  serverDelete: ServerDelete,
  serverMemberJoin: ServerMemberJoin,
  serverMemberLeave: ServerMemberLeave,
  serverMemberUpdate: ServerMemberUpdate,
  serverRoleDelete: ServerRoleDelete,
  serverRoleUpdate: ServerRoleUpdate,
  serverUpdate: ServerUpdate,
  userUpdate: UserUpdate,
  messageReact: MessageReact,
  messageUnreact: MessageUnreact,
  webhookCreate: WebhookCreate,
  webhookDelete: WebhookDelete,
  webhookUpdate: WebhookUpdate,
};
