import { createSlice } from "@reduxjs/toolkit";

import mapRestUser from "../../utils/mapRestUser"; // same helper the users slice uses

export const currentUserSlice = createSlice({
  name: "currentUser",

  initialState: null, // stays a single object, not an array

  reducers: {
    /* ------------------------------------------------------------------

       currentUserUpdated

       – can receive either a *full* user object  (first load / login)

       – or a *partial* patch coming from SignalR  (online flag etc.)

    ------------------------------------------------------------------ */

    currentUserUpdated: (state, action) => {
      const raw = action.payload;

      /* first call or explicit full replacement ---------------------- */

      if (
        state === null ||
        (raw.firstname !== undefined && raw.lastname !== undefined)
      ) {
        return mapRestUser(raw); // normalise every field once
      }

      /* otherwise treat it as a PATCH -------------------------------- */

      const next = { ...state }; // Immer lets us mutate but explicit copy is clear

      if (raw.isOnline !== undefined) next.isOnline = !!raw.isOnline;

      if (raw.firstname !== undefined) next.firstname = raw.firstname;

      if (raw.lastname !== undefined) next.lastname = raw.lastname;

      if (raw.profilePictureURL !== undefined)
        next.profilePictureURL = raw.profilePictureURL;

      if (raw.backgroundPictureURL !== undefined)
        next.backgroundPictureURL = raw.backgroundPictureURL;

      /* add similar guards if more fields can arrive partially … */

      return next; // Immer will take care of immutability
    },
  },
});

export const { currentUserUpdated } = currentUserSlice.actions;

export default currentUserSlice.reducer;
