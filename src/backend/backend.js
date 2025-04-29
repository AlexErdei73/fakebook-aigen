/*  backend.js  –  FIRST MIGRATION STEP

    ------------------------------------

    0.   NO Firebase imports at all.

    1.   Export *exactly* the same function names the UI already uses.

    2.   Provide no-op or mock implementations that fulfil those contracts.

    3.   Tiny in-memory cache (+ localStorage) so screens have something

         to display and don’t blow up on undefined values.

*/

/* Redux store + slices stay exactly as they were */

import store from "../app/store";

import {
  signIn,
  signOut,
  errorOccured,
  loadingFinished,
  loadingStarted,
} from "../features/user/userSlice";

import { currentUserUpdated } from "../features/currentUser/currentUserSlice";

import { usersUpdated } from "../features/users/usersSlice";

import { postsUpdated } from "../features/posts/postsSlice";

import { incomingMessagesUpdated } from "../features/incomingMessages/incomingMessagesSlice";

import { outgoingMessagesUpdated } from "../features/outgoingMessages/outgoingMessagesSlice";

/* ------------------------------------------------------------------ */

/*  Small helper utilities                                             */

/* ------------------------------------------------------------------ */

const genId = () => Math.random().toString(36).slice(2, 11);

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

/* Persist minimal mock DB so a reload keeps state (optional) */

const LS_KEY = "__fakebook_mock_db__";

const loadDB = () => JSON.parse(localStorage.getItem(LS_KEY) || "{}");

const saveDB = (db) => localStorage.setItem(LS_KEY, JSON.stringify(db));

/* ------------------------------------------------------------------ */

/*  “Database” – lives in memory, persisted to localStorage            */

/* ------------------------------------------------------------------ */

let DB = {
  currentUser: null, // { id, displayName, isEmailVerified }

  users: [], // array of “profile” objects

  posts: [], // array of posts

  messages: [], // array of { id, sender, recipient, text, isRead, ... }

  ...loadDB(),
};

/* Convenience finders */

const me = () => DB.users.find((u) => u.userID === DB.currentUser?.id);

const nowISO = () => new Date().toISOString();

/* Anytime we mutate DB we persist */

const commit = () => saveDB(DB);

/* ------------------------------------------------------------------ */

/*  PUBLIC API  (ALL the names the UI already imports)                 */

/* ------------------------------------------------------------------ */

/* ---------- Generic helpers ---------- */

export async function getImageURL(path) {
  /* Pretend we have a CDN */

  return `/assets/${path}`;
}

/* ---------- Auth ---------- */

export function subscribeAuth() {
  /* Mimic Firebase: emit immediately, return an unsubscribe fn */

  setTimeout(() => {
    if (DB.currentUser) {
      const { id, displayName, isEmailVerified } = DB.currentUser;

      store.dispatch(signIn({ id, displayName, isEmailVerified }));
    } else {
      store.dispatch(signOut());
    }

    store.dispatch(loadingFinished());
  }, 0);

  return () => {}; // no-op unsubscribe
}

export async function signUserOut() {
  store.dispatch(loadingStarted());

  DB.currentUser = null;

  commit();

  store.dispatch(signOut());

  store.dispatch(loadingFinished());
}

/* createUserAccount mimics registration + e-mail verification mail */

export async function createUserAccount(user) {
  try {
    await delay();

    const uid = genId();

    DB.currentUser = {
      id: uid,

      displayName: `${user.firstname} ${user.lastname}`,

      isEmailVerified: true,
    };

    /* -------------------------------------------------- */

    /* Work out the index:                                */

    /*   – 0 for the first user with this first+last name */

    /*   – N for the N-th user who shares that name       */

    /* -------------------------------------------------- */

    const duplicates = DB.users.filter(
      (u) => u.firstname === user.firstname && u.lastname === user.lastname
    ).length;

    DB.users.push({
      userID: uid,

      firstname: user.firstname,

      lastname: user.lastname,

      profilePictureURL: "fakebook-avatar.jpeg",

      backgroundPictureURL: "background-server.jpg",

      photos: [],

      posts: [],

      isOnline: false,

      isEmailVerified: true,

      index: duplicates, // 0 for first, 1 for second, …
    });

    commit();

    console.info("[Mock] Registration OK — verification email “sent”.");
  } catch (err) {
    store.dispatch(errorOccured(err.message));
  }
}

export async function signInUser(user) {
  const NO_ERROR = "";

  const EMAIL_VERIF_ERROR = "Please verify your email before to continue";

  await delay();

  /* Any credentials work in the mock */

  const existing =
    DB.users.find((u) => u.firstname === user.email.split("@")[0]) ||
    DB.users[0];

  if (!existing) {
    store.dispatch(errorOccured("No account found (mock)"));
  } else if (existing && !existing.isEmailVerified) {
    DB.currentUser = null;

    store.dispatch(errorOccured(EMAIL_VERIF_ERROR));
  } else {
    DB.currentUser = {
      id: existing.userID,

      displayName: `${existing.firstname} ${existing.lastname}`,

      isEmailVerified: true,
    };

    /* 👇  NEW: tell Redux that we’re signed in  */

    store.dispatch(
      signIn({
        id: DB.currentUser.id,

        displayName: DB.currentUser.displayName,

        isEmailVerified: true,
      })
    );

    store.dispatch(errorOccured(NO_ERROR));

    commit();
  }

  store.dispatch(loadingFinished());
}

export function sendPasswordReminder(email) {
  console.info(`[Mock] password reset email sent to ${email}`);

  return Promise.resolve();
}

/* ---------- Current user doc ---------- */

export function subscribeCurrentUser() {
  const uid = store.getState().user.id;

  /* Emit once */

  setTimeout(() => {
    const doc = DB.users.find((u) => u.userID === uid);

    store.dispatch(currentUserUpdated(doc || {}));
  }, 0);

  /* Return unsubscribe noop */

  return () => {};
}

export async function currentUserOnline() {
  if (me()) {
    me().isOnline = true;
    commit();
  }
}

export async function currentUserOffline() {
  if (me()) {
    me().isOnline = false;
    commit();
  }
}

/* ---------- Users list ---------- */

export function subscribeUsers() {
  /* Emit immediately */

  setTimeout(() => {
    store.dispatch(usersUpdated(DB.users.slice()));
  }, 0);

  return () => {};
}

/* ---------- Posts ---------- */

export function subscribePosts() {
  setTimeout(() => {
    const postsWithStrings = DB.posts.map((p) => ({
      ...p,

      timestamp: new Date(p.timestamp).toLocaleString(),
    }));

    store.dispatch(postsUpdated(postsWithStrings));
  }, 0);

  return () => {};
}

export async function upload(post) {
  await delay();

  const doc = {
    ...post,

    postID: genId(),

    timestamp: nowISO(),
  };

  DB.posts.unshift(doc);

  if (me()) {
    me().posts.unshift(doc.postID);
  }

  commit();

  return { id: doc.postID }; // mimic Firebase’s docRef id
}

export function updatePost(post, postID) {
  const idx = DB.posts.findIndex((p) => p.postID === postID);

  if (idx !== -1) {
    DB.posts[idx] = { ...DB.posts[idx], ...post };

    commit();
  }
}

/* ---------- Storage uploads ---------- */

export function addFileToStorage(file) {
  console.info("[Mock] file saved:", file.name);

  return Promise.resolve({
    ref: { fullPath: `${DB.currentUser?.id}/${file.name}` },
  });
}

/* ---------- Profile ---------- */

export function updateProfile(profile) {
  if (me()) {
    Object.assign(me(), profile);

    commit();
  }

  return Promise.resolve();
}

/* ---------- Messages ---------- */

export function subscribeMessages(kind) {
  const uid = DB.currentUser?.id;

  const isIncoming = kind === "incoming";

  setTimeout(() => {
    const msgs = DB.messages

      .filter((m) => (isIncoming ? m.recipient === uid : m.sender === uid))

      .map((m) => ({ ...m, timestamp: m.timestamp }));

    store.dispatch(
      (isIncoming ? incomingMessagesUpdated : outgoingMessagesUpdated)(msgs)
    );
  }, 0);

  return () => {};
}

export function uploadMessage(msg) {
  DB.messages.push({
    ...msg,

    id: genId(),

    timestamp: nowISO(),

    isRead: false,
  });

  commit();

  return Promise.resolve();
}

export function updateToBeRead(messageID) {
  const m = DB.messages.find((m) => m.id === messageID);

  if (m) {
    m.isRead = true;
    commit();
  }

  return Promise.resolve();
}

/* ------ internal helper still referenced by UI code ---------------- */

function updateUserPosts() {
  /* kept only to satisfy imports; real logic in upload() above */
}

export { updateUserPosts }; // keep named export so imports don’t break
