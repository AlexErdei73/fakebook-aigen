/* --------------------------------------------------------------

   mapRestMessage  – Magic → legacy Firebase shape

   -------------------------------------------------------------- */

export function mapRestMessage(row) {
	/* Convert "2025-04-05 09:34:52" → JS ISO string the UI already
  
       parses with new Date() (or keep as Date object if you prefer) */

	const iso = row.timestamp
		? row.timestamp.replace(" ", "T") + "Z"
		: new Date().toISOString();

	return {
		/* Firebase used the doc id as ‘id’; we’ll expose the PK */

		id: row.message_id,

		sender: row.sender,

		recipient: row.recipient,

		text: row.text,

		photoURL: row.photoURL,

		isPhoto: !!row.isPhoto,

		isRead: !!row.isRead,

		timestamp: iso,
	};
}
