import type { Member, User as APIUser } from "revolt-api";
import { BaseManager } from "./baseManager";
import { Server, ServerMember, User } from "../struct/index";

export type ServerMemberResolvable = ServerMember | User | Member | string;

export interface EditServerMemberOptions {
  nickname?: string;
  avatar?: string;
  roles?: string[];
  timeout?: Date | number;
}

export class ServerMemberManager extends BaseManager<ServerMember, Member> {
  /** @private */
  holds = ServerMember;
  constructor(protected readonly server: Server) {
    super(server.client);
  }

  /**
   * edit selected member in the server
   * @param member The member to edit
   * @param options The options to edit the member with
   * @param options.nickname The nickname of the member to set
   * @param options.avatar The avatar of the member to set
   * @param options.roles The roles of the member to set
   * @returns A promise that resolves when the member is edited
   */
  async edit(
    member: ServerMemberResolvable,
    options: EditServerMemberOptions,
  ): Promise<void> {
    const id = this.resolveId(member);
    if (!id) {
      throw new TypeError("INVALID_TYPE");
    }
    await this.client.api.patch(`/servers/${this.server.id}/members/${id}`, {
      body: { ...options },
    });
  }

  /**
   * ban selected member in the server
   * @param member The member to ban
   * @param reason the reason for the ban
   * @returns A promise that resolves when the member is banned
   */
  async ban(member: ServerMemberResolvable, reason?: string): Promise<void> {
    const id = this.resolveId(member);
    if (!id) {
      throw new TypeError("INVALID_TYPE");
    }
    await this.client.api.put(`/servers/${this.server.id}/bans/${id}`, {
      body: { reason },
    });
  }

  /**
   * kick selected member in the server
   * @param member The member to kick
   * @returns A promise that resolves when the member is kicked
   */
  async kick(member: ServerMemberResolvable): Promise<void> {
    const id = this.resolveId(member);
    if (!id) {
      throw new TypeError("INVALID_TYPE");
    }
    await this.client.api.delete(`/servers/${this.server.id}/members/${id}`);
  }

  /**
   * unban selected member in the server
   * @param member The member to unban
   * @returns A promise that resolves when the member is unbanned
   */
  async unban(member: ServerMemberResolvable): Promise<void> {
    const id = this.resolveId(member);
    if (!id) {
      throw new TypeError("INVALID_TYPE");
    }
    await this.client.api.delete(`/servers/${this.server.id}/bans/${id}`);
  }

  /**
   * set timeout for a member in the server
   * @param member The member to set the timeout for
   * @param duration The duration of the timeout as a Date object
   * @returns A promise that resolves when the timeout is set
   */
  async timeout(member: string, duration: Date): Promise<void> {
    await this.client.api.patch(
      `/servers/${this.server.id}/members/${member}`,
      {
        body: { timeout: duration },
      },
    );
  }

  /**
   * fetch a member from the server
   * @param member The member to fetch
   * @returns A promise that resolves with the fetched member
   */
  async fetch(member: ServerMemberResolvable): Promise<ServerMember>;
  async fetch(): Promise<Map<string, ServerMember>>;
  async fetch(
    member?: ServerMemberResolvable,
  ): Promise<ServerMember | Map<string, ServerMember>> {
    if (typeof member !== "undefined") {
      const id = this.resolveId(member);
      if (!id) {
        throw new TypeError("INVALID_TYPE");
      }
      const data = await this.client.api.get<Member>(
        `/servers/${this.server.id}/members/${id}`,
      );

      // Fetch and cache the user data first
      await this.client.users.fetch(data._id.user);

      // Then cache and return the member
      return this._add(data);
    }

    const { users, members } = await this.client.api.get<{
      users: APIUser[];
      members: Member[];
    }>(`/servers/${this.server.id}/members`);

    users.reduce((coll, cur) => {
      const user = this.client.users._add(cur);
      coll.set(user.id, user);
      return coll;
    }, this.client.users.cache);

    return members.reduce((coll, cur) => {
      const member = this._add(cur);
      coll.set(member.id, member);
      return coll;
    }, new Map<string, ServerMember>());
  }

  /**
   * resolves a member from a string or a member object
   * @param member The member to resolve
   * @returns The id of the member or null if it cannot be resolved
   */
  resolveId(member: ServerMemberResolvable): string | null {
    if (member == null) return null;
    if (member instanceof ServerMember || member instanceof User) {
      return member.id;
    }
    if (typeof member === "string") return member;
    if ("_id" in member) return member._id.user;
    return null;
  }
}
