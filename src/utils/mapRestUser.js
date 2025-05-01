/* utils/mapRestUser.js

   Converts a “magic” REST / SignalR user row into the shape Fakebook

   components already consume. */

function addPath(row, fileName) {
  if (typeof fileName !== "string" || !fileName.length) return fileName;

  if (fileName.includes("/")) return fileName; // already has folder

  return `${row.user_id}/${fileName}`; // prepend owner id
}

export default function mapRestUser(row) {
  const photosRaw = JSON.parse(row.photos || "[]");

  const photos = photosRaw.map((item) => {
    if (typeof item === "string") {
      return { filename: addPath(row, item) }; // legacy array
    }

    if (item && typeof item.filename === "string") {
      return { ...item, filename: addPath(row, item.filename) };
    }

    return item;
  });

  return {
    userID: row.user_id,

    firstname: row.firstname,

    lastname: row.lastname,

    profilePictureURL: row.profilePictureURL,

    backgroundPictureURL: row.backgroundPictureURL,

    photos,

    posts: JSON.parse(row.posts || "[]"),

    isOnline: !!row.isOnline,

    isEmailVerified: !!row.isEmailVerified,

    index: row.index ?? 0,
  };
}
