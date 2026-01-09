import type { Member as APIMember, FieldsMember } from "revolt-api";
import { Base } from "./base";
import { Attachment, Server, User, Role, Presence } from "./index";
import { client } from "../client/client";
import { FullPermissions, Badges } from "../utils";

/**
 * Represents a member of a server.
 *
 * @extends Base
 */
export class ServerMember extends Base {
  /** The ID of the server this member belongs to. */
  serverId!: string;

  /** The nickname of the member, or `null` if none is set. */
  nickname: string | null = null;

  /** The avatar of the member, or `null` if none is set. */
  avatar: Attachment | null = null;

  /** roles assigned to the member */
  roles: Role[] = [];

  /**
   * Creates a new ServerMember instance.
   *
   * @param {client} client - The client instance.
   * @param {APIMember} data - The raw data for the server member from the API.
   */
  constructor(client: client, data: APIMember) {
    super(client);
    this._patch(data);
  }

  /**
   * Updates the server member instance with new data from the API.
   *
   * @param {APIMember} data - The raw data for the server member from the API.
   * @param {FieldsMember[]} [clear=[]] - Fields to clear in the server member.
   * @returns {this} The updated server member instance.
   * @protected
   */
  protected _patch(data: APIMember, clear: FieldsMember[] = []): this {
    super._patch(data);

    if ("nickname" in data) {
      this.nickname = data.nickname ?? null;
    }

    if (data.avatar) {
      this.avatar = new Attachment(this.client, data.avatar);
    }

    if (data._id) {
      this.serverId = data._id.server;
      this.id = data._id.user;
    }

    if (Array.isArray(data.roles)) {
      if (!data.roles.length) this.roles = [];
      else {
        this.roles = data.roles.map((roleId) => {
          const role = this.server.roles.cache.get(roleId);
          if (!role) {
            throw new Error(
              `Role with ID ${roleId} not found in server ${this.serverId}`,
            );
          }
          return role;
        });
      }
    }

    for (const field of clear) {
      if (field === "Avatar") this.avatar = null;
      if (field === "Nickname") this.nickname = null;
    }

    return this;
  }

  /**
   * Sets the nickname of the server member.
   *
   * @param {string} [nickname] - The new nickname to set, or `undefined` to clear the nickname.
   * @returns {Promise<this>} A promise that resolves with the updated server member instance.
   *
   * @example
   * ```typescript
   * await member.setNickname("NewNickname");
   * ```
   */
  async setNickname(nickname?: string): Promise<this> {
    await this.server.members.edit(this, { nickname });
    return this;
  }

  /**
   * adds a role to the server member.
   * @param roleId - The ID of the role to add to the member.
   * @returns
   */
  async addRole(roleId: string): Promise<this> {
    const currentRoles = this.roles.map((role) => role.id);
    if (currentRoles.includes(roleId)) {
      return this; // Role already exists, no need to add it again
    }
    await this.server.members.edit(this, {
      roles: [...currentRoles, roleId],
    });
    return this;
  }

  /**
   * Removes a role from the server member.
   *
   * @param {string} roleId - The ID of the role to remove from the member.
   * @returns {Promise<this>} A promise that resolves with the updated server member instance.
   *
   * @example
   * ```typescript
   * await member.removeRole("roleId");
   * ```
   */
  async removeRole(roleId: string): Promise<this> {
    const currentRoles = this.roles.map((role) => role.id);
    if (!currentRoles.includes(roleId)) {
      return this; // Role does not exist, no need to remove it
    }
    await this.server.members.edit(this, {
      roles: currentRoles.filter((id) => id !== roleId),
    });
    return this;
  }

  /**
   * Bans the server member.
   *
   * @param {string} [reason] - The reason for the ban.
   * @returns {Promise<void>} A promise that resolves when the member is banned.
   *
   * @example
   * ```typescript
   * await member.ban("Violation of rules");
   * ```
   */
  ban(reason?: string): Promise<void> {
    return this.server.members.ban(this, reason);
  }

  /**
   * Kicks the server member.
   *
   * @returns {Promise<void>} A promise that resolves when the member is kicked.
   *
   * @example
   * ```typescript
   * await member.kick();
   * ```
   */
  kick(): Promise<void> {
    return this.server.members.kick(this);
  }

  /**
   * Leaves the server.
   *
   * @returns {Promise<void>} A promise that resolves when the member leaves the server.
   *
   * @example
   * ```typescript
   * await member.leave();
   * ```
   */
  leave(): Promise<void> {
    return this.client.servers.delete(this.serverId);
  }

  /**
   * Gets the effective permissions for this server member based on their roles.
   *
   * The permissions are calculated by:
   * 1. Starting with a base FullPermissions with no permissions
   * 2. For each role the member has, applying the role's allow permissions
   * 3. For each role the member has, removing the role's deny permissions
   *
   * @returns {FullPermissions} The effective permissions for this member
   *
   * @example
   * ```typescript
   * const permissions = member.getPermissions();
   * console.log(permissions.has('MANAGE_MESSAGES')); // true or false
   * ```
   */
  permissions(): FullPermissions {
    // Start with no permissions
    let permissions = new FullPermissions();

    // Apply allow permissions from all roles
    for (const role of this.roles) {
      if (role.overwrite?.allow) {
        permissions = permissions.add(role.overwrite.allow);
      }
    }

    // Remove deny permissions from all roles
    for (const role of this.roles) {
      if (role.overwrite?.deny) {
        permissions = permissions.remove(role.overwrite.deny);
      }
    }

    return permissions;
  }

  /**
   * Checks if this server member has a specific permission.
   *
   * @param {string | number | FullPermissions} permission - The permission to check for
   * @returns {boolean} Whether the member has the permission
   *
   * @example
   * ```typescript
   * if (member.hasPermission('MANAGE_MESSAGES')) {
   *   // Member can manage messages
   * }
   * ```
   *
   * note this works on the same basis as stoats permissions checking
   */
  hasPermission(permission: string | number | FullPermissions): boolean {
    if (this.client.servers.cache.get(this.serverId)?.ownerId === this.id)
      return true;
    return this.permissions().has(permission);
  }

  //   async displayAvatarURL(options?: { size: number }): Promise<string> {
  //     return await this.user.displayAvatarURL(options);
  //   }

  /**
   * Retrieves the user associated with this server member.
   *
   * @returns {User} The user instance.
   */
  get user(): User {
    return this.client.users.cache.get(this.id)!;
  }

  /**
   * Gets the username of the user.
   *
   * @returns {string} The username of the user.
   */
  get username(): string {
    return this.user.username;
  }

  /**
   * Gets whether the user is a bot.
   *
   * @returns {boolean} Whether the user is a bot.
   */
  get bot(): boolean {
    return this.user.bot ?? false;
  }

  /**
   * Retrieves the server this member belongs to.
   *
   * @returns {Server} The server instance.
   */
  get server(): Server {
    return this.client.servers.cache.get(this.serverId)!;
  }

  /**
   * Converts the server member to a string representation.
   *
   * @returns {string} A string representation of the server member in the format `<@userId>`.
   */
  toString(): string {
    return `<@${this.id}>`;
  }

  /**
   * Sets a timeout for the server member.
   * @param duration - The duration of the timeout as a Date object.
   * @returns A promise that resolves when the timeout is set.
   */
  timeout(duration: Date): Promise<void> {
    return this.server.members.edit(this, { timeout: duration });
  }
}
