import { createSlice } from "@reduxjs/toolkit";

import mapRestPost from "../../utils/mapRestPost";

/* --------------------------------------------------------------

   helper – fixes the Magic placeholder only once, on INSERT

   -------------------------------------------------------------- */

const withValidTimestamp = (post) =>
  post.timestamp === "Invalid Date" || !post.timestamp
    ? { ...post, timestamp: new Date().toISOString() }
    : post;

export const postsSlice = createSlice({
  name: "posts",

  initialState: [],

  reducers: {
    /* full reload: oldest → newest, so reverse once */

    postsLoaded: (_state, action) => action.payload.map(mapRestPost).reverse(),

    /* incremental updates from Signal R */

    postsUpdated: (state, action) => {
      action.payload.forEach((raw) => {
        const postID = raw.post_id ?? raw.postID;

        const idx = state.findIndex((p) => p.postID === postID);

        /* -------- INSERT NEW ------------------------------------------------ */

        if (idx === -1) {
          state.unshift(withValidTimestamp(mapRestPost(raw))); // newest first

          return;
        }

        /* -------- MERGE PARTIAL UPDATE ------------------------------------- */

        const cur = state[idx];

        if (raw.text !== undefined) cur.text = raw.text;

        if (raw.photoURL !== undefined) cur.photoURL = raw.photoURL;

        if (raw.youtubeURL !== undefined) cur.youtubeURL = raw.youtubeURL;

        if (raw.isPhoto !== undefined) cur.isPhoto = !!raw.isPhoto;

        if (raw.isYoutube !== undefined) cur.isYoutube = !!raw.isYoutube;

        if (raw.comments !== undefined) cur.comments = JSON.parse(raw.comments);

        if (raw.likes !== undefined) cur.likes = JSON.parse(raw.likes);

        /* raw.timestamp never changes in an update → leave untouched */
      });
    },
  },
});

export const { postsLoaded, postsUpdated } = postsSlice.actions;

export default postsSlice.reducer;
