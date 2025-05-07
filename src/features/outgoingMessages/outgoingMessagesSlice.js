import { createSlice } from "@reduxjs/toolkit";

/* Optional: keep the list ordered (oldest → newest). */

const byTimestampAsc = (a, b) =>
	new Date(a.timestamp).valueOf() - new Date(b.timestamp).valueOf();

export const outgoingMessagesSlice = createSlice({
	name: "outgoingMessages",

	initialState: [], // simple array of message objects

	reducers: {
		/* ------------------------------------------------------------------

       outgoingMessagesUpdated

       – payload is ALWAYS an array (1 or many rows)

       – merge-in logic keeps existing rows and patches them if needed

    ------------------------------------------------------------------ */

		outgoingMessagesUpdated: (state, action) => {
			action.payload.forEach((msg) => {
				const msgId = msg.id ?? msg.message_id; // tolerate either key

				const idx = state.findIndex((m) => (m.id ?? m.message_id) === msgId);

				if (idx === -1) {
					/* ① brand-new row → append */

					state.push(msg);
				} else {
					/* ② existing row → shallow merge (e.g. read flag flips) */

					state[idx] = { ...state[idx], ...msg };
				}
			});

			/* Keep deterministic order for rendering (remove if unnecessary). */

			state.sort(byTimestampAsc);

			/* Immer lets us mutate in place; no return statement required */
		},
	},
});

export const { outgoingMessagesUpdated } = outgoingMessagesSlice.actions;

export default outgoingMessagesSlice.reducer;
