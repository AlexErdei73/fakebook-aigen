/* Converts the “Magic / Firebase” row into the shape the UI expects.

   – comments / likes arrive as JSON-encoded strings

   – timestamp comes as “2025-03-18 14:18:43” (UTC); we store it as Date

   – isPhoto / isYoutube arrive as 0|1 (or false|true) → boolean

*/

export default function mapRestPost(row) {
  /* helper – coerce all falsy / 0 / "0" / false values to boolean */

  const bool = (v) => v === true || v === 1 || v === "1";

  return {
    postID: row.post_id,

    userID: row.user_id,

    text: row.text,

    photoURL: row.photoURL,

    youtubeURL: row.youtubeURL,

    isPhoto: bool(row.isPhoto),

    isYoutube: bool(row.isYoutube),

    comments: JSON.parse(row.comments || "[]"),

    likes: JSON.parse(row.likes || "[]"),

    /* keep the original ISO string too if you need it elsewhere */

    timestamp: new Date(row.timestamp).toLocaleString(),
  };
}
