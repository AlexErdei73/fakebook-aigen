import { createSlice } from "@reduxjs/toolkit";

/* Helper to keep the array ordered (oldest → newest).

   If you don’t care about ordering you can remove the sort. */

const byTimestampAsc = (a, b) =>
	new Date(a.timestamp).valueOf() - new Date(b.timestamp).valueOf();

export const incomingMessagesSlice = createSlice({
	name: "incomingMessages",

	/* simple array of message objects */

	initialState: [],

	reducers: {
		/* ------------------------------------------------------------------

       incomingMessagesUpdated

       – payload is ALWAYS an array (can be 1 or many rows)

       – for every row:   if new  → append

                          if exist → merge/patch

    ------------------------------------------------------------------ */

		incomingMessagesUpdated: (state, action) => {
			action.payload.forEach((msg) => {
				/* support both id and message_id just in case */

				const msgId = msg.id ?? msg.message_id;

				const idx = state.findIndex((m) => (m.id ?? m.message_id) === msgId);

				if (idx === -1) {
					/* ① brand-new message → push */

					state.push(msg);
				} else {
					/* ② already stored → shallow merge keeps other fields */
					state[idx] = { ...state[idx], ...msg };
				}
			});

			/* keep messages sorted for deterministic rendering */

			state.sort(byTimestampAsc);

			/*  Immer lets us “mutate” state directly; no return needed */
		},
	},
});

export const { incomingMessagesUpdated } = incomingMessagesSlice.actions;

export default incomingMessagesSlice.reducer;
