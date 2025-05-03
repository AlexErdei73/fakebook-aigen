/* =====================================================================


          Fakebook — back-end file (AUTH + mock social features)


   ===================================================================== */

import * as signalR from "@microsoft/signalr";

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

import { postsLoaded, postsUpdated } from "../features/posts/postsSlice";

import { incomingMessagesUpdated } from "../features/incomingMessages/incomingMessagesSlice";

import { outgoingMessagesUpdated } from "../features/outgoingMessages/outgoingMessagesSlice";

/* --------------------------- CONSTANTS -------------------------------- */

const API_BASE = "https://alexerdei-team.us.ainiro.io/magic/modules/fakebook";

const SOCKETS_URL = "wss://alexerdei-team.us.ainiro.io/sockets";

const REGISTER_URL = `${API_BASE}/register`;

const LOGIN_URL = `${API_BASE}/login`;

const USERS_URL = `${API_BASE}/users`;

const POSTS_URL = `${API_BASE}/posts`;

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

  openSocket();
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

/* ===================================================================== *
   
   
                    SECTION A — REAL AUTH WORKFLOW
   
   
   ===================================================================== */

/* =========================================================================

   BOOTSTRAP SESSION  –  used by subscribeAuth()  *and*  signInUser()

   ====================================================================== */

/**

 * Fetches all users, finds the logged-in user, updates Redux,

 * cold-starts the post feed, and marks the user online.

 *

 * Throws if the user row cannot be found.

 */

async function bootstrapSession(user_id) {
  // 1. fetch all users (Magic API has no `/users/:id`)

  const users = await $fetch(`${USERS_URL}?limit=-1`);

  const meRow = users.find((u) => u.user_id === user_id);

  if (!meRow) throw new Error("User not found");

  // 2. update the auth slice (for navbar, etc.)

  store.dispatch(
    signIn({
      id: user_id,

      displayName: `${meRow.firstname} ${meRow.lastname}`,

      isEmailVerified: !!meRow.isEmailVerified,
    })
  );

  // 3. populate currentUser slice (fixes “missing photos / posts”)

  store.dispatch(currentUserUpdated(meRow));

  // 4. cold-start posts feed and mark myself online

  subscribePosts();

  currentUserOnline();
}

export function subscribeAuth() {
  store.dispatch(loadingStarted());

  (async () => {
    const token = localStorage.getItem(LS_TOKEN);

    const user_id = localStorage.getItem(LS_USER_ID);

    if (!token || !user_id) {
      clearAuth();

      store.dispatch(signOut());

      store.dispatch(loadingFinished());

      return;
    }

    setAuth(token, user_id);

    try {
      await bootstrapSession(user_id); // <── single shared call
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

export async function signInUser(user) {
  store.dispatch(loadingStarted());

  try {
    // 1. login

    const url = `${LOGIN_URL}?email=${encodeURIComponent(
      user.email
    )}&password=${encodeURIComponent(user.password)}`;

    const { token, user_id } = await $fetch(url);

    // 2. persist token + open socket

    setAuth(token, user_id);

    // 3. reuse the exact same bootstrap logic

    await bootstrapSession(user_id);

    store.dispatch(errorOccured("")); // clear possible old errors
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

/* ------------------------------------------------------------------ */

/*  SignalR hub – one connection shared across the app                */

/* ------------------------------------------------------------------ */

let hub = null;

function openSocket() {
  if (hub) return; // already connected / connecting

  const token = localStorage.getItem(LS_TOKEN);

  if (!token) return; // not logged-in → no live updates

  hub = new signalR.HubConnectionBuilder()

    .withUrl(SOCKETS_URL, {
      accessTokenFactory: () => token,

      skipNegotiation: true, // no CORS pre-flight

      transport: signalR.HttpTransportType.WebSockets, // WebSocket only
    })

    .withAutomaticReconnect()

    .configureLogging(signalR.LogLevel.Warning)

    .build();

  /* ---------------------------------------------------- */

  /* helper – SignalR sends a JSON-string → return POJO   */

  /* ---------------------------------------------------- */

  const parseMsg = (raw) => (typeof raw === "string" ? JSON.parse(raw) : raw);

  /* 1️⃣  Start first … */

  hub
    .start()

    .then(() => {
      console.info("[SignalR] connected, id:", hub.connectionId);

      /* 2️⃣  … then register listeners ----------------------------- */

      /* inside openSocket() – unchanged except the helper */

      hub.on("fakebook.users.post", (raw) => {
        store.dispatch(usersUpdated([parseMsg(raw)]));
      });

      hub.on("fakebook.users.put", (raw) => {
        store.dispatch(usersUpdated([parseMsg(raw)]));
      });

      hub.on("fakebook.posts.post", (raw) => {
        store.dispatch(postsUpdated([JSON.parse(raw)]));
      });

      hub.on("fakebook.posts.put", (raw) => {
        store.dispatch(postsUpdated([JSON.parse(raw)]));
      });
    })

    .catch((err) => {
      console.warn("[SignalR] start failed:", err);

      hub = null; // let auto-reconnect retry
    });

  /* extra diagnostics ---------------------------------------------- */

  hub.onreconnecting((err) => console.warn("[SignalR] reconnecting:", err));

  hub.onreconnected((id) => console.info("[SignalR] reconnected, id:", id));

  hub.onclose((err) => console.warn("[SignalR] closed:", err));
}

/* ------------------------------------------------------------------ */

/*  Close SignalR + forget credentials                                */

/* ------------------------------------------------------------------ */

function clearAuth() {
  /* forget in-memory copies */

  authToken = null;

  authUser = null;

  /* forget persisted copies */

  localStorage.removeItem(LS_TOKEN); // "fakebook.jwt"

  localStorage.removeItem(LS_USER_ID); // "fakebook.user_id"

  /* close the hub if it exists */

  if (hub) {
    hub.stop(); // graceful shutdown → returns a promise we don’t await

    hub = null;
  }
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
        store.dispatch(currentUserUpdated(meRow));
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

      body: JSON.stringify({
        user_id,

        isOnline: isOnline ? 1 : 0, // DB needs 1/0
      }),
    });
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
        store.dispatch(usersUpdated(users));
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

/* ------------------------------------------------------------------ */

/*  posts subscription: replaces old in-memory mock version           */

/* ------------------------------------------------------------------ */

export function subscribePosts() {
  let cancelled = false;

  (async () => {
    try {
      const token = localStorage.getItem(LS_TOKEN);

      const arr = await $fetch(`${POSTS_URL}?limit=-1`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!cancelled) {
        store.dispatch(postsLoaded(arr)); // full list once
      }
    } catch (err) {
      console.warn("[subscribePosts] failed:", err.message);
    }
  })();

  /* return unsubscribe fn (keeps contract identical) */

  return () => {
    cancelled = true;
  };
}

export async function upload(post) {
  await delay();

  const doc = { ...post, postID: genId(), timestamp: nowISO() };

  DB.posts.unshift(doc);

  if (me()) me().posts.unshift(doc.postID);

  persist();

  return { id: doc.postID };
}

/* --------------------------------------------------------------

    Update a post (likes, comments, text, etc.)

    post   → partial object in Redux/UI format

    postID → numeric/string id in the REST DB

   -------------------------------------------------------------- */

export async function updatePost(post, postID) {
  const token = localStorage.getItem(LS_TOKEN);

  if (!token) throw new Error("Not authenticated");

  /* 1. Map Redux-shape → Magic API shape ----------------------- */

  const body = { post_id: postID }; // mandatory key

  if (post.comments !== undefined)
    body.comments = JSON.stringify(post.comments);

  if (post.likes !== undefined) body.likes = JSON.stringify(post.likes);

  /* 2. Fire PUT /posts ---------------------------------------- */

  await $fetch(POSTS_URL, {
    method: "PUT",

    body: JSON.stringify(body),
  });
}

/* =====================================================================

   PHOTO / PROFILE HELPERS

   ===================================================================== */

const IMAGE_UPLOAD_URL = `${API_BASE}/image`; // POST image

/* --------------------------------------------------------------
   
      addFileToStorage
   
      -------------------------------------------------------------- */

/*  file → native File object coming from <input type="file">         */

/*  RETURNS: { url, path, ... } exactly what the Magic endpoint sends */

export async function addFileToStorage(file) {
  if (!file) throw new Error("No file given");

  const fd = new FormData();

  fd.append("file", file, file.name);

  const res = await fetch(IMAGE_UPLOAD_URL, {
    method: "POST",

    headers: {
      ...authHeader(), // adds Authorization if we’re logged in

      // DO NOT set Content-Type – the browser will add multipart boundary
    },

    body: fd,
  });

  if (!res.ok) {
    const msg = await res.text();

    throw new Error(`Image upload failed: ${msg || res.statusText}`);
  }

  /* Magic returns JSON with at least { url } (and sometimes path, size…) */

  const data = await res.json();

  return data; // UploadPhoto.jsx ignores, updateDatabase uses
}

/* --------------------------------------------------------------

   updateProfile

   -------------------------------------------------------------- */

/*  patch → only the fields that changed, e.g.                     */

/*          { profilePictureURL: "...jpg" }                        */

/*          { photos: ["p1.jpg", "p2.jpg"] }                       */

/*  Updates DB and refreshes Redux                                 */

export async function updateProfile(patch) {
  const token = localStorage.getItem(LS_TOKEN);

  const user_id = localStorage.getItem(LS_USER_ID);

  if (!token || !user_id) throw new Error("Not authenticated");

  /* Shape request body exactly like the Magic API expects -------- */

  const body = { user_id };

  if (patch.profilePictureURL !== undefined)
    body.profilePictureURL = patch.profilePictureURL;

  if (patch.backgroundPictureURL !== undefined)
    body.backgroundPictureURL = patch.backgroundPictureURL;

  if (patch.photos !== undefined)
    // array → JSON string

    body.photos = JSON.stringify(patch.photos);

  /* Fire PUT /users --------------------------------------------- */

  const updatedRow = await $fetch(USERS_URL, {
    method: "PUT",

    body: JSON.stringify(body),
  }); // $fetch auto-adds headers

  /* Update Redux immediately for smooth UX ---------------------- */

  store.dispatch(currentUserUpdated(updatedRow));

  store.dispatch(usersUpdated([updatedRow]));

  /* When the hub later sends fakebook.users.put the same row will

     merge in again; that’s harmless. */
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
