/**
 * Simplified ACL types for local storage.
 * GCS metadata-backed ACL is no longer used; profile/object serving is public-read.
 */

export enum ObjectAccessGroupType {}

export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  id: string;
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<ObjectAclRule>;
}

export async function setObjectAclPolicy(
  _objectPath: string,
  _aclPolicy: ObjectAclPolicy,
): Promise<void> {
  // No-op for local filesystem storage
}

export async function getObjectAclPolicy(
  _objectPath: string,
): Promise<ObjectAclPolicy | null> {
  // Local objects served via /storage/objects are treated as public-read
  return { owner: "", visibility: "public" };
}

export async function canAccessObject({
  requestedPermission,
}: {
  userId?: string;
  objectPath: string;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  return requestedPermission === ObjectPermission.READ;
}
