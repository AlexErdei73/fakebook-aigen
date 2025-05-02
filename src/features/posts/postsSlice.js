import { createSlice } from "@reduxjs/toolkit";

import mapRestPost from "../../utils/mapRestPost";

export const postsSlice = createSlice({
  name: "posts",

  initialState: [], // still an array

  reducers: {
    /* full reload (initial screen) --------------------------------- */

    postsLoaded: (_, action) => action.payload.map(mapRestPost),

    /* incremental updates: insert new or patch existing ------------ */

    postsUpdated: (state, action) => {
      const incoming = action.payload; // array of raw rows

      incoming.forEach((raw) => {
        const postID = raw.post_id ?? raw.postID;

        const idx = state.findIndex((p) => p.postID === postID);

        if (idx === -1) {
          /* NEW */

          state.push(mapRestPost(raw));

          return;
        }

        /* MERGE PARTIAL UPDATE */

        const cur = state[idx];

        const next = { ...cur };

        if (raw.text !== undefined) next.text = raw.text;

        if (raw.photoURL !== undefined) next.photoURL = raw.photoURL;

        if (raw.youtubeURL !== undefined) next.youtubeURL = raw.youtubeURL;

        if (raw.isPhoto !== undefined) next.isPhoto = !!raw.isPhoto;

        if (raw.isYoutube !== undefined) next.isYoutube = !!raw.isYoutube;

        if (raw.comments !== undefined)
          next.comments = JSON.parse(raw.comments);

        if (raw.likes !== undefined) next.likes = JSON.parse(raw.likes);

        if (raw.timestamp !== undefined)
          next.timestamp = new Date(raw.timestamp);

        state[idx] = next;
      });
    },
  },
});

export const { postsLoaded, postsUpdated } = postsSlice.actions;

export default postsSlice.reducer;
