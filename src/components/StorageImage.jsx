import React, { useEffect, useState } from "react";

import placeholderImage from "../images/placeholder-image.jpg";

import fakebookAvatar from "../images/fakebook-avatar.jpeg";

import backgroundServer from "../images/background-server.jpg";

const API_BASE = "https://alexerdei-team.us.ainiro.io/magic/modules/fakebook";

/* ------------------------------------------------------------------ */

function toWebp(name) {
  if (name.toLowerCase().endsWith(".webp")) return name;

  const dot = name.lastIndexOf(".");

  return dot === -1 ? `${name}.webp` : `${name.slice(0, dot)}.webp`;
}

async function fetchImageURL(storagePath) {
  if (!storagePath) return placeholderImage;

  if (storagePath === "fakebook-avatar.jpeg") return fakebookAvatar;

  if (storagePath === "background-server.jpg") return backgroundServer;

  const [folder, ...rest] = storagePath.split("/");

  const rawFilename = rest.join("/");

  const filenameWebp = toWebp(rawFilename); // ← only change

  const url =
    `${API_BASE}/image?folder=fakebook/${encodeURIComponent(folder)}` +
    `&filename=${encodeURIComponent(filenameWebp)}`;

  const res = await fetch(url);

  if (!res.ok) throw new Error("Image request failed");

  const blob = await res.blob();

  return URL.createObjectURL(blob);
}

/* ================================================================== */

const StorageImage = ({ storagePath, ...rest }) => {
  const [src, setSrc] = useState(placeholderImage);

  useEffect(() => {
    let cancelled = false;

    fetchImageURL(storagePath)
      .then((url) => !cancelled && setSrc(url))

      .catch(() => !cancelled && setSrc(placeholderImage));

    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return <img src={src} alt='' {...rest} />;
};

export default StorageImage;
