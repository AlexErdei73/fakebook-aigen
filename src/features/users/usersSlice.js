import { createSlice } from "@reduxjs/toolkit";
import mapRestUser from "../../utils/mapRestUser";

export const usersSlice = createSlice({
  name: "users",
  initialState: [],
  reducers: {
    usersUpdated: (state, action) => {
      /* action.payload will always be an *array* */

      const incoming = action.payload;

      incoming.forEach((raw) => {
        const userID = raw.user_id ?? raw.userID;

        const idx = state.findIndex((u) => u.userID === userID);

        if (idx === -1) {
          /* -------- NEW USER ----------------------------------------- */

          state.push(mapRestUser(raw)); // map every field

          return;
        }

        /* -------- EXISTING USER -------------------------------------- */

        const cur = state[idx];

        const patch = {};

        /* Online flag comes as 0/1; convert to boolean if present */

        if (raw.isOnline !== undefined) patch.isOnline = !!raw.isOnline;

        if (raw.firstname !== undefined) patch.firstname = raw.firstname;

        if (raw.lastname !== undefined) patch.lastname = raw.lastname;

        if (raw.profilePictureURL !== undefined)
          patch.profilePictureURL = raw.profilePictureURL;

        if (raw.backgroundPictureURL !== undefined)
          patch.backgroundPictureURL = raw.backgroundPictureURL;

        /* add other fields you expect to arrive partially … */

        if (raw.posts !== undefined) patch.posts = JSON.parse(raw.posts);

        if (raw.photos !== undefined) patch.photos = JSON.parse(raw.photos);

        state[idx] = { ...cur, ...patch }; // keep old fields
      });
    },
  },
});

export const { usersUpdated } = usersSlice.actions;

export default usersSlice.reducer;
