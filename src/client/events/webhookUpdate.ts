import { Event, Events } from "./event";
import { WebhookUpdateData } from "../../utils/types";

/**
 * Represents the event handler for webhook updates.
 * @extends Event
 * @private
 */
export class WebhookUpdate extends Event {
  /**
   * Handles the webhook update event.
   * @param {id: string, data: { name: string; avatar?: { _id: string; tag: string; filename: string; metadata: any; content_type: string; size: number; }; remove: string[]; }} data- The data for the event, containing the webhook ID and updated webhook data.
   * @returns {void}
   */
  handle(data: {
    id: string;
    data: {
      name: string;
      avatar?: {
        _id: string;
        tag: string;
        filename: string;
        metadata: any;
        content_type: string;
        size: number;
      };
      remove: string[];
    };
  }): void {
    const webhookData: WebhookUpdateData = {
      webhookId: data.id,
      name: data.data.name,
      avatar: data.data.avatar,
      remove: data.data.remove,
    };

    this.client.emit(Events.WEBHOOKS_UPDATE, webhookData);
  }
}
