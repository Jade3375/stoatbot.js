import { Event, Events } from "./event";
import { WebhookCreateData } from "../../utils/types";

/**
 * Represents the event handler for webhook creations.
 * @extends Event
 * @private
 */
export class WebhookCreate extends Event {
  /**
   * Handles the webhook create event.
   * @param {id: string, channel_id: string, server_id: string, name: string} data - The data for the event, containing the webhook ID, channel ID, server ID, and name.
   * @returns {void}
   */
  handle(data: {
    id: string;
    channel_id: string;
    server_id: string;
    name: string;
    creator_id: string;
    token: string;
  }): void {
    const webhookData: WebhookCreateData = {
      webhookId: data.id,
      channelId: data.channel_id,
      name: data.name,
      creatorId: data.creator_id,
      token: data.token,
    };

    this.client.emit(Events.WEBHOOKS_CREATE, webhookData);
  }
}
