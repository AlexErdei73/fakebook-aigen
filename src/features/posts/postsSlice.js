import { createSlice } from "@reduxjs/toolkit";

import mapRestPost from "../../utils/mapRestPost";

export const postsSlice = createSlice({
	name: "posts",

	initialState: [],

	reducers: {
		/* full reload (initial screen) --------------------------------- */

		postsLoaded: (_state, action) =>
			// API returns oldest → newest, so reverse once

			action.payload.map(mapRestPost).reverse(),

		/* incremental updates: insert new or patch existing ------------ */

		postsUpdated: (state, action) => {
			const incoming = action.payload; // array of raw rows

			incoming.forEach((raw) => {
				const postID = raw.post_id ?? raw.postID;

				const idx = state.findIndex((p) => p.postID === postID);

				if (idx === -1) {
					/* NEW  →  put at the front so list stays newest-first */

					state.unshift(mapRestPost(raw));

					return;
				}

				/* MERGE PARTIAL UPDATE (order unchanged) ------------------ */

				const cur = state[idx];

				if (raw.text !== undefined) cur.text = raw.text;

				if (raw.photoURL !== undefined) cur.photoURL = raw.photoURL;

				if (raw.youtubeURL !== undefined) cur.youtubeURL = raw.youtubeURL;

				if (raw.isPhoto !== undefined) cur.isPhoto = !!raw.isPhoto;

				if (raw.isYoutube !== undefined) cur.isYoutube = !!raw.isYoutube;

				if (raw.comments !== undefined) cur.comments = JSON.parse(raw.comments);

				if (raw.likes !== undefined) cur.likes = JSON.parse(raw.likes);

				/* raw.timestamp never changes, so we leave it untouched */
			});
		},
	},
});

export const { postsLoaded, postsUpdated } = postsSlice.actions;

export default postsSlice.reducer;
