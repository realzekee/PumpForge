// Persistent client-side and cross-session storage for user metadata, sanctions, custom titles, and roles

export interface UserSanction {
  isSuspended: boolean;
  isBanned: boolean;
  suspendedUntil: number | null;
  reason?: string;
}

export interface UserMetaData {
  title?: string;
  isAdmin?: boolean;
  sanction?: UserSanction;
}

const SANCTIONS_KEY = "pf_global_user_sanctions";
const TITLES_KEY = "pf_global_user_titles";
const ROLES_KEY = "pf_global_user_roles";

export const getStoredSanctions = (): Record<string, UserSanction> => {
  try {
    const raw = localStorage.getItem(SANCTIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

export const saveStoredSanction = (key: string, sanction: UserSanction) => {
  try {
    const sanctions = getStoredSanctions();
    const cleanKey = key.toLowerCase().trim();
    sanctions[cleanKey] = sanction;
    localStorage.setItem(SANCTIONS_KEY, JSON.stringify(sanctions));
    // Trigger custom event for multi-tab sync
    window.dispatchEvent(new CustomEvent("pf_user_meta_updated", { detail: { type: "sanction", key: cleanKey, sanction } }));
  } catch (e) {
    console.warn("Failed to save sanction:", e);
  }
};

export const getStoredTitles = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(TITLES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

export const saveStoredTitle = (key: string, title: string) => {
  try {
    const titles = getStoredTitles();
    const cleanKey = key.toLowerCase().trim();
    titles[cleanKey] = title;
    localStorage.setItem(TITLES_KEY, JSON.stringify(titles));
    window.dispatchEvent(new CustomEvent("pf_user_meta_updated", { detail: { type: "title", key: cleanKey, title } }));
  } catch (e) {
    console.warn("Failed to save title:", e);
  }
};

export const getStoredRoles = (): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(ROLES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

export const saveStoredRole = (key: string, isAdmin: boolean) => {
  try {
    const roles = getStoredRoles();
    const cleanKey = key.toLowerCase().trim();
    roles[cleanKey] = isAdmin;
    localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
    window.dispatchEvent(new CustomEvent("pf_user_meta_updated", { detail: { type: "role", key: cleanKey, isAdmin } }));
  } catch (e) {
    console.warn("Failed to save role:", e);
  }
};

export const clearStoredUserMeta = (key: string) => {
  try {
    const cleanKey = key.toLowerCase().trim();
    const sanctions = getStoredSanctions();
    delete sanctions[cleanKey];
    localStorage.setItem(SANCTIONS_KEY, JSON.stringify(sanctions));

    const titles = getStoredTitles();
    delete titles[cleanKey];
    localStorage.setItem(TITLES_KEY, JSON.stringify(titles));

    const roles = getStoredRoles();
    delete roles[cleanKey];
    localStorage.setItem(ROLES_KEY, JSON.stringify(roles));

    window.dispatchEvent(new CustomEvent("pf_user_meta_updated", { detail: { type: "clear", key: cleanKey } }));
  } catch (e) {
    console.warn("Failed to clear user meta:", e);
  }
};
