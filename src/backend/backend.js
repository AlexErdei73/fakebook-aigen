// backend.js -------------------------------------------------------------

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

import { mapRestMessage } from "../utils/mapRestMessage";

// urls / constants -------------------------------------------------------

const API = "https://alexerdei-team.us.ainiro.io/magic/modules/fakebook";

const SOCKETS = "wss://alexerdei-team.us.ainiro.io/sockets";

const USERS_URL = `${API}/users`;

const POSTS_URL = `${API}/posts`;

const MSG_URL = `${API}/message`;

const IMAGE_URL = `${API}/image`;

const PWD_URL = `${API}/pswreminder`; // GET ?email=<mail>

const LS_TOKEN = "fakebook.jwt";

const LS_UID = "fakebook.user_id";

// auth state -------------------------------------------------------------

let authToken = null;

let authUser = null;

const authHeader = () =>
	authToken ? { Authorization: `Bearer ${authToken}` } : {};

// localStorage helpers ---------------------------------------------------

const loadAuthFromStorage = () => {
	authToken = localStorage.getItem(LS_TOKEN);
	authUser = localStorage.getItem(LS_UID);
};

const saveAuthToStorage = (t, u) => {
	localStorage.setItem(LS_TOKEN, t);
	localStorage.setItem(LS_UID, u);
};

const clearAuthStorage = () => {
	localStorage.removeItem(LS_TOKEN);
	localStorage.removeItem(LS_UID);
};

// fetch helper -----------------------------------------------------------

const $fetch = async (url, opts = {}) => {
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
};

// misc helpers -----------------------------------------------------------

const genId = () => Math.random().toString(36).slice(2, 11);

// socket -----------------------------------------------------------------

let hub = null;

const openSocket = () => {
	if (hub || !authToken) return;

	hub = new signalR.HubConnectionBuilder()

		.withUrl(SOCKETS, {
			accessTokenFactory: () => authToken,
			skipNegotiation: true,
			transport: signalR.HttpTransportType.WebSockets,
		})

		.withAutomaticReconnect()

		.configureLogging(signalR.LogLevel.Warning)

		.build();

	hub
		.start()
		.then(() => {
			hub.on("fakebook.users.post", (raw) =>
				store.dispatch(usersUpdated([JSON.parse(raw)]))
			);

			hub.on("fakebook.users.put", (raw) => {
				const row = JSON.parse(raw);

				store.dispatch(usersUpdated([row]));

				if (row.user_id === authUser) store.dispatch(currentUserUpdated(row));
			});

			hub.on("fakebook.posts.post", (raw) =>
				store.dispatch(postsUpdated([JSON.parse(raw)]))
			);

			hub.on("fakebook.posts.put", (raw) =>
				store.dispatch(postsUpdated([JSON.parse(raw)]))
			);

			hub.on("fakebook.message.post", (raw) => {
				const msg = mapRestMessage(JSON.parse(raw));

				if (msg.recipient === authUser)
					store.dispatch(incomingMessagesUpdated([msg]));

				if (msg.sender === authUser)
					store.dispatch(outgoingMessagesUpdated([msg]));
			});
		})
		.catch((err) => {
			console.warn("[SignalR] start failed:", err);
			hub = null;
		});
};

// presence ---------------------------------------------------------------

// patchOnline(on, keep = false)  ← keep=true will add keepalive: true

const patchOnline = async (on, keep = false) => {
	if (!authUser) return;

	try {
		await fetch(USERS_URL, {
			method: "PUT",

			headers: { "Content-Type": "application/json", ...authHeader() },

			body: JSON.stringify({ user_id: authUser, isOnline: on ? 1 : 0 }),

			...(keep ? { keepalive: true } : {}),
		});
	} catch (e) {
		console.warn("[online] PUT failed:", e.message);
	}
};

export const currentUserOnline = () => patchOnline(true);

export const currentUserOffline = () => patchOnline(false);

// leave / background handlers -------------------------------------------

let leaveHandlerInstalled = false;

const sendOfflineKeepalive = () => patchOnline(false, true);

const handleVisibility = () => {
	if (document.visibilityState === "hidden") sendOfflineKeepalive();

	if (document.visibilityState === "visible") currentUserOnline();
};

const installLeaveHandlers = () => {
	if (leaveHandlerInstalled) return;

	window.addEventListener("pagehide", sendOfflineKeepalive); // tab / window close

	window.addEventListener("freeze", sendOfflineKeepalive); // page-lifecycle freeze

	window.addEventListener("resume", currentUserOnline); // page-lifecycle resume

	document.addEventListener("visibilitychange", handleVisibility);

	leaveHandlerInstalled = true;
};

const removeLeaveHandlers = () => {
	if (!leaveHandlerInstalled) return;

	window.removeEventListener("pagehide", sendOfflineKeepalive);

	window.removeEventListener("freeze", sendOfflineKeepalive);

	window.removeEventListener("resume", currentUserOnline);

	document.removeEventListener("visibilitychange", handleVisibility);

	leaveHandlerInstalled = false;
};

// setAuth … add

const setAuth = (t, u) => {
	authToken = t;

	authUser = u;

	saveAuthToStorage(t, u);

	openSocket();

	installLeaveHandlers(); // ← here
};

// clearAuth … add

const clearAuth = () => {
	authToken = null;

	authUser = null;

	clearAuthStorage();

	if (hub) {
		hub.stop();
		hub = null;
	}

	removeLeaveHandlers(); // ← here
};

// bootstrap after login/restore -----------------------------------------

const bootstrapSession = async (uid) => {
	const users = await $fetch(`${USERS_URL}?limit=-1`);

	const me = users.find((u) => u.user_id === uid);

	if (!me) throw new Error("User not found");

	store.dispatch(
		signIn({
			id: uid,
			displayName: `${me.firstname} ${me.lastname}`,
			isEmailVerified: !!me.isEmailVerified,
		})
	);

	store.dispatch(currentUserUpdated(me));

	subscribePosts();

	currentUserOnline();

	subscribeMessages("incoming");

	subscribeMessages("outgoing");
};

// public auth api --------------------------------------------------------

export const subscribeAuth = () => {
	store.dispatch(loadingStarted());

	loadAuthFromStorage();

	if (!authToken || !authUser) {
		clearAuth();
		store.dispatch(signOut());
		store.dispatch(loadingFinished());
		return () => {};
	}

	setAuth(authToken, authUser);

	bootstrapSession(authUser)
		.catch((err) => {
			console.warn("[Auth] bootstrap failed:", err.message);
			clearAuth();
			store.dispatch(signOut());
		})

		.finally(() => store.dispatch(loadingFinished()));

	return () => {};
};

export const createUserAccount = async (u) => {
	store.dispatch(loadingStarted());

	try {
		await $fetch(`${API}/register`, {
			method: "POST",
			body: JSON.stringify(u),
		});
		store.dispatch(errorOccured(""));
	} catch (e) {
		store.dispatch(errorOccured(e.message));
	}

	store.dispatch(loadingFinished());
};

export const signInUser = async (u) => {
	store.dispatch(loadingStarted());

	try {
		const { token, user_id } = await $fetch(
			`${API}/login?email=${encodeURIComponent(
				u.email
			)}&password=${encodeURIComponent(u.password)}`
		);

		setAuth(token, user_id);
		await bootstrapSession(user_id);
		store.dispatch(errorOccured(""));
	} catch (e) {
		store.dispatch(errorOccured(e.message));
		clearAuth();
	}

	store.dispatch(loadingFinished());
};

export const signUserOut = async () => {
	await patchOnline(false);
	clearAuth();
	store.dispatch(signOut());
};

// password reminder ------------------------------------------------------

export const sendPasswordReminder = async (email) => {
	store.dispatch(loadingStarted());

	try {
		await $fetch(`${PWD_URL}?email=${encodeURIComponent(email)}`, {
			method: "GET",
		});

		store.dispatch(errorOccured("")); // clear old errors
	} catch (e) {
		store.dispatch(errorOccured(e.message));
	}

	store.dispatch(loadingFinished());
};

// users subscription -----------------------------------------------------

export const subscribeUsers = () => {
	let cancelled = false;

	(async () => {
		try {
			const u = await $fetch(`${USERS_URL}?limit=-1`);
			if (!cancelled) store.dispatch(usersUpdated(u));
		} catch (e) {
			console.warn("[subscribeUsers] failed:", e.message);
		}
	})();

	return () => {
		cancelled = true;
	};
};

// posts ------------------------------------------------------------------

export const subscribePosts = () => {
	let cancelled = false;

	(async () => {
		try {
			const p = await $fetch(`${POSTS_URL}?limit=-1`);
			if (!cancelled) store.dispatch(postsLoaded(p));
		} catch (e) {
			console.warn("[subscribePosts] failed:", e.message);
		}
	})();

	return () => {
		cancelled = true;
	};
};

export const upload = async (p) => {
	if (!authUser) throw new Error("Not authenticated");

	const post_id = genId();

	await $fetch(POSTS_URL, {
		method: "POST",
		body: JSON.stringify({
			post_id,
			user_id: authUser,
			text: p.text ?? "",
			photoURL: p.photoURL ?? "",
			youtubeURL: p.youtubeURL ?? "",
			isPhoto: p.isPhoto ? 1 : 0,
			isYoutube: p.isYoutube ? 1 : 0,
			likes: JSON.stringify(p.likes ?? []),
			comments: JSON.stringify(p.comments ?? []),
			timestamp: new Date().toISOString(),
		}),
	});

	try {
		const curPosts = JSON.parse(store.getState().currentUser?.posts ?? "[]");

		await $fetch(USERS_URL, {
			method: "PUT",
			body: JSON.stringify({
				user_id: authUser,
				posts: JSON.stringify([...curPosts, post_id]),
			}),
		});
	} catch (e) {
		console.warn("[uploadPost] users.posts PUT failed:", e.message);
	}

	return { id: post_id };
};

export const updatePost = async (patch, id) => {
	if (!authToken) throw new Error("Not authenticated");

	const body = { post_id: id };

	if (patch.comments !== undefined)
		body.comments = JSON.stringify(patch.comments);

	if (patch.likes !== undefined) body.likes = JSON.stringify(patch.likes);

	await $fetch(POSTS_URL, { method: "PUT", body: JSON.stringify(body) });
};

// messages ---------------------------------------------------------------

export const subscribeMessages = (kind) => {
	let cancelled = false;

	(async () => {
		try {
			if (!authUser) return;

			const filter =
				kind === "incoming"
					? `message.recipient.eq=${authUser}`
					: `message.sender.eq=${authUser}`;

			const rows = await $fetch(`${MSG_URL}?limit=-1&${filter}`);

			const mapped = rows.map(mapRestMessage);

			if (!cancelled)
				kind === "incoming"
					? store.dispatch(incomingMessagesUpdated(mapped))
					: store.dispatch(outgoingMessagesUpdated(mapped));
		} catch (e) {
			console.warn("[subscribeMessages] failed:", e.message);
		}
	})();

	return () => {
		cancelled = true;
	};
};

export const uploadMessage = async (m) => {
	if (!authUser) throw new Error("Not authenticated");

	const message_id = genId();

	await $fetch(MSG_URL, {
		method: "POST",
		body: JSON.stringify({
			message_id,
			sender: authUser,
			recipient: m.recipient,
			text: m.text ?? "",
			photoURL: m.photoURL ?? "",
			isPhoto: m.photoURL ? 1 : 0,
			isRead: 0,
		}),
	});

	return { id: message_id };
};

export const updateToBeRead = async (id) => {
	const patch = [{ message_id: id, isRead: 1 }];

	store.dispatch(incomingMessagesUpdated(patch));

	store.dispatch(outgoingMessagesUpdated(patch));

	try {
		await $fetch(MSG_URL, {
			method: "PUT",
			body: JSON.stringify({ message_id: id, isRead: 1 }),
		});
	} catch (e) {
		console.warn("[updateToBeRead] PUT failed:", e.message);
	}
};

// currentUser refresh ----------------------------------------------------

export const subscribeCurrentUser = () => {
	let cancelled = false;

	(async () => {
		try {
			if (!authUser) return;

			const users = await $fetch(`${USERS_URL}?limit=-1`);

			const me = users.find((u) => u.user_id === authUser);

			if (me && !cancelled) store.dispatch(currentUserUpdated(me));
		} catch (e) {
			console.warn("[subscribeCurrentUser] failed:", e.message);
		}
	})();

	return () => {
		cancelled = true;
	};
};

// files & profile --------------------------------------------------------

export const addFileToStorage = async (file) => {
	if (!file) throw new Error("No file");

	const fd = new FormData();
	fd.append("file", file, file.name);

	const res = await fetch(IMAGE_URL, {
		method: "POST",
		headers: { ...authHeader() },
		body: fd,
	});

	if (!res.ok) throw new Error(await res.text());

	return res.json();
};

export const updateProfile = async (patch) => {
	if (!authUser) throw new Error("Not authenticated");

	const body = { user_id: authUser };

	if (patch.profilePictureURL !== undefined)
		body.profilePictureURL = patch.profilePictureURL;

	if (patch.backgroundPictureURL !== undefined)
		body.backgroundPictureURL = patch.backgroundPictureURL;

	if (patch.photos !== undefined) body.photos = JSON.stringify(patch.photos);

	const updated = await $fetch(USERS_URL, {
		method: "PUT",
		body: JSON.stringify(body),
	});

	store.dispatch(currentUserUpdated(updated));

	store.dispatch(usersUpdated([updated]));
};

// misc helper ------------------------------------------------------------

export const getImageURL = async (path) => `/assets/${path}`;
