/* =====================================================================


   Fakebook — back-end file (AUTH + mock social features)


   ===================================================================== */

import store from "../app/store";

import {
  signIn,
  signOut,
  errorOccured,
  loadingStarted,
  loadingFinished,
} from "../features/user/userSlice";

import { currentUserUpdated } from "../features/currentUser/currentUserSlice";

import { usersUpdated } from "../features/users/usersSlice";

import { postsUpdated } from "../features/posts/postsSlice";

import { incomingMessagesUpdated } from "../features/incomingMessages/incomingMessagesSlice";

import { outgoingMessagesUpdated } from "../features/outgoingMessages/outgoingMessagesSlice";

/* --------------------------- CONSTANTS -------------------------------- */

const API_BASE = "https://alexerdei-team.us.ainiro.io/magic/modules/fakebook";

const REGISTER_URL = `${API_BASE}/register`;

const LOGIN_URL = `${API_BASE}/login`;

const USERS_URL = `${API_BASE}/users`;

const LS_TOKEN = "fakebook.jwt";

const LS_USER_ID = "fakebook.user_id";

/* --------------------------- SESSION (NEW) ----------------------------- */

/*  In-memory copy – null while logged-out  */

let authToken = null;

let authUser = null;

/*  Header helper – import this anywhere you need the bearer token        */

const authHeader = () =>
  authToken ? { Authorization: `Bearer ${authToken}` } : {};

/*  Initialise / clear session                                            */

function setAuth(token, user_id) {
  authToken = token;

  authUser = user_id;

  localStorage.setItem(LS_TOKEN, token);

  localStorage.setItem(LS_USER_ID, user_id);
}

function clearAuth() {
  authToken = authUser = null;

  localStorage.removeItem(LS_TOKEN);

  localStorage.removeItem(LS_USER_ID);
}

/* --------------------------- Utilities -------------------------------- */

const genId = () => Math.random().toString(36).slice(2, 11);

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

async function $fetch(url, opts = {}) {
  /* inject bearer automatically */

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",

      ...authHeader(),

      ...(opts.headers || {}),
    },

    ...opts,
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.message || res.statusText);

  return data;
}

/* ---------------------- REST → UI mapper ------------------------------- */

function addPath(u, fileName) {
  if (typeof fileName !== "string" || !fileName.length) return fileName;

  if (fileName.includes("/")) return fileName; /* already has folder */

  return `${u.user_id}/${fileName}`; /* prepend owner id   */
}

function mapRestUser(u) {
  const photosRaw = JSON.parse(u.photos || "[]");

  const photos = photosRaw.map((item) => {
    if (typeof item === "string") {
      /* legacy: array of strings */

      return { filename: addPath(u, item) };
    }

    if (item && typeof item.filename === "string") {
      return { ...item, filename: addPath(u, item.filename) };
    }

    return item;
  });

  return {
    userID: u.user_id,

    firstname: u.firstname,

    lastname: u.lastname,

    /* already stored as folder/filename → leave untouched */

    profilePictureURL: u.profilePictureURL,

    backgroundPictureURL: u.backgroundPictureURL,

    photos,

    posts: JSON.parse(u.posts || "[]"),

    isOnline: !!u.isOnline,

    isEmailVerified: !!u.isEmailVerified,

    index: u.index ?? 0,
  };
}

/* ===================================================================== *
   
   
         SECTION A — REAL AUTH WORKFLOW
   
   
      ===================================================================== */

/* ---------------------- subscribeAuth -------------------------------- */

export function subscribeAuth() {
  store.dispatch(loadingStarted());

  (async () => {
    const token = localStorage.getItem(LS_TOKEN);

    const user_id = localStorage.getItem(LS_USER_ID);

    if (!token || !user_id) {
      clearAuth(); /* make sure RAM copy is empty */

      store.dispatch(signOut());

      store.dispatch(loadingFinished());

      return;
    }

    /* restore session into RAM */

    setAuth(token, user_id);

    try {
      /* users endpoint lacks ?user_id, so fetch all */

      const users = await $fetch(`${USERS_URL}?limit=-1`);

      const u = users.find((x) => x.user_id === user_id);

      if (!u) throw new Error("User not found");

      store.dispatch(
        signIn({
          id: user_id,

          displayName: `${u.firstname} ${u.lastname}`,

          isEmailVerified: !!u.isEmailVerified,
        })
      );
    } catch (err) {
      console.warn("[Auth] subscribeAuth failed:", err.message);

      clearAuth();

      store.dispatch(signOut());
    } finally {
      store.dispatch(loadingFinished());
    }
  })();

  return () => {};
}

/* ---------------------- createUserAccount ---------------------------- */

export async function createUserAccount(user) {
  store.dispatch(loadingStarted());

  try {
    await $fetch(REGISTER_URL, {
      method: "POST",

      body: JSON.stringify({
        firstname: user.firstname,

        lastname: user.lastname,

        email: user.email,

        password: user.password,
      }),
    });

    store.dispatch(errorOccured(""));
  } catch (err) {
    store.dispatch(errorOccured(err.message));
  } finally {
    store.dispatch(loadingFinished());
  }
}

/* ---------------------- signInUser  ---------------------------------- */

export async function signInUser(user) {
  store.dispatch(loadingStarted());

  try {
    const url = `${LOGIN_URL}?email=${encodeURIComponent(
      user.email
    )}&password=${encodeURIComponent(user.password)}`;

    const { token, user_id } = await $fetch(url);

    /* persist + put into RAM */

    setAuth(token, user_id);

    /* get full profile */

    const users = await $fetch(`${USERS_URL}?limit=-1`);

    const profile = users.find((u) => u.user_id === user_id);

    if (!profile) throw new Error("User not found");

    if (!profile.isEmailVerified)
      throw new Error("Please verify your email before to continue");

    store.dispatch(
      signIn({
        id: user_id,

        displayName: `${profile.firstname} ${profile.lastname}`,

        isEmailVerified: true,
      })
    );

    store.dispatch(errorOccured(""));
  } catch (err) {
    store.dispatch(errorOccured(err.message));

    clearAuth();
  } finally {
    store.dispatch(loadingFinished());
  }
}

/* ---------------------- signUserOut ---------------------------------- */

export async function signUserOut() {
  await patchOnline(false); /* mark offline */

  clearAuth();

  store.dispatch(signOut());
}

/* -------------------- sendPasswordReminder --------------------------- */

export function sendPasswordReminder(email) {
  console.info("[TODO] Implement password reminder for", email);

  return Promise.resolve();
}

/* ===================================================================== *
   
      SECTION B — IN-MEMORY MOCK (UNCHANGED)                                *
   
      ===================================================================== */

/* ------------- tiny DB (persists to localStorage for demo) ----------- */

const LS_DB = "__fakebook_mock_db__";

const DB = Object.assign(
  {
    currentUser: null,

    users: [],

    posts: [],

    messages: [],
  },

  JSON.parse(localStorage.getItem(LS_DB) || "{}")
);

const persist = () => localStorage.setItem(LS_DB, JSON.stringify(DB));

const me = () => DB.users.find((u) => u.userID === DB.currentUser?.id);

const nowISO = () => new Date().toISOString();

/* --------------------- generic helpers ------------------------------- */

export async function getImageURL(path) {
  return `/assets/${path}`;
}

/* ------------------- current user subscriptions ---------------------- */

/* ------------------------------------------------------------------ */

/*  Current user document                                             */

/* ------------------------------------------------------------------ */

export function subscribeCurrentUser() {
  let cancelled = false;

  (async () => {
    try {
      const token = localStorage.getItem(LS_TOKEN);

      const user_id = localStorage.getItem(LS_USER_ID);

      if (!token || !user_id) return;

      const users = await $fetch(`${USERS_URL}?limit=-1`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const meRow = users.find((u) => u.user_id === user_id);

      if (meRow && !cancelled) {
        store.dispatch(currentUserUpdated(mapRestUser(meRow)));
      }
    } catch (err) {
      console.warn("[subscribeCurrentUser] failed:", err.message);
    }
  })();

  return () => {
    cancelled = true;
  };
}
/* ------------------------------------------------------------------ */

/*  Online / offline flag                                             */

/* ------------------------------------------------------------------ */
async function patchOnline(isOnline) {
  const token = localStorage.getItem(LS_TOKEN);

  const user_id = localStorage.getItem(LS_USER_ID);

  if (!token || !user_id) return;

  try {
    await $fetch(USERS_URL, {
      method: "PUT",

      mode: "cors",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({
        user_id,

        isOnline: isOnline ? 1 : 0, // DB needs 1/0
      }),
    });

    /* -------- optimistic Redux update (merge, not overwrite) -------- */

    const cur = store.getState().currentUser;

    store.dispatch(currentUserUpdated({ ...cur, isOnline })); // boolean

    const usersNew = store
      .getState()
      .users.map((u) => (u.userID === user_id ? { ...u, isOnline } : u));

    store.dispatch(usersUpdated(usersNew));
  } catch (err) {
    console.warn("[online/offline] PUT failed:", err.message);
  }
}

export const currentUserOnline = () => patchOnline(true);

export const currentUserOffline = () => patchOnline(false);

/* ------------------------- users list -------------------------------- */

export function subscribeUsers() {
  let cancelled = false;

  (async () => {
    try {
      const token = localStorage.getItem(LS_TOKEN);

      const users = await $fetch(`${USERS_URL}?limit=-1`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!cancelled) {
        store.dispatch(usersUpdated(users.map(mapRestUser)));
      }
    } catch (err) {
      console.warn("[subscribeUsers] failed:", err.message);
    }
  })();

  /* return unsubscribe fn to keep same contract */

  return () => {
    cancelled = true;
  };
}

/* ------------------------- posts ------------------------------------- */

export function subscribePosts() {
  setTimeout(() => {
    store.dispatch(
      postsUpdated(
        DB.posts.map((p) => ({
          ...p,
          timestamp: new Date(p.timestamp).toLocaleString(),
        }))
      )
    );
  }, 0);

  return () => {};
}

export async function upload(post) {
  await delay();

  const doc = { ...post, postID: genId(), timestamp: nowISO() };

  DB.posts.unshift(doc);

  if (me()) me().posts.unshift(doc.postID);

  persist();

  return { id: doc.postID };
}

export function updatePost(post, postID) {
  const idx = DB.posts.findIndex((p) => p.postID === postID);

  if (idx !== -1) {
    DB.posts[idx] = { ...DB.posts[idx], ...post };
    persist();
  }
}

/* ------------------------- storage ----------------------------------- */

export function addFileToStorage(file) {
  console.info("[Mock] saved file", file.name);

  return Promise.resolve({
    ref: { fullPath: `${DB.currentUser?.id}/${file.name}` },
  });
}

/* ------------------------- profile ----------------------------------- */

export function updateProfile(profile) {
  if (me()) Object.assign(me(), profile);
  persist();
  return Promise.resolve();
}

/* ------------------------- messages ---------------------------------- */

export function subscribeMessages(kind) {
  const uid = DB.currentUser?.id;

  const inc = kind === "incoming";

  setTimeout(() => {
    const msgs = DB.messages.filter((m) =>
      inc ? m.recipient === uid : m.sender === uid
    );

    store.dispatch(
      (inc ? incomingMessagesUpdated : outgoingMessagesUpdated)([...msgs])
    );
  }, 0);

  return () => {};
}

export function uploadMessage(msg) {
  DB.messages.push({ ...msg, id: genId(), timestamp: nowISO(), isRead: false });
  persist();
  return Promise.resolve();
}

export function updateToBeRead(id) {
  const m = DB.messages.find((m) => m.id === id);
  if (m) {
    m.isRead = true;
    persist();
  }
  return Promise.resolve();
}

/* Ensure demo DB has at least one user */

if (!DB.users.length) {
  DB.users.push({
    userID: genId(),

    firstname: "Demo",

    lastname: "User",

    profilePictureURL: "fakebook-avatar.jpeg",

    backgroundPictureURL: "background-server.jpg",

    photos: [],

    posts: [],

    isOnline: 0,

    isEmailVerified: true,

    index: 0,
  });

  persist();
}
