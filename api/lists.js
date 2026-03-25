const { get, put } = require("@vercel/blob");

const SHARED_PATH = "tierlists/shared.json";

async function readStream(stream) {
  const reader = stream.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function readLists() {
  const result = await get(SHARED_PATH, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    return [];
  }

  const raw = await readStream(result.stream);
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.lists) ? parsed.lists : [];
}

async function writeLists(lists) {
  await put(
    SHARED_PATH,
    JSON.stringify({ lists }),
    {
      access: "public",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    },
  );
}

module.exports = async function handler(req, res) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      res.status(500).json({ error: "Missing BLOB_READ_WRITE_TOKEN" });
      return;
    }

    if (req.method === "GET") {
      const lists = await readLists();
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ lists });
      return;
    }

    if (req.method === "POST") {
      const incoming = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!incoming || !incoming.id || !Array.isArray(incoming.rows) || !Array.isArray(incoming.items)) {
        res.status(400).json({ error: "Invalid tier list payload" });
        return;
      }

      const lists = await readLists();
      const nextLists = [...lists];
      const existingIndex = nextLists.findIndex((entry) => entry.id === incoming.id);

      if (existingIndex >= 0) {
        nextLists[existingIndex] = incoming;
      } else {
        nextLists.unshift(incoming);
      }

      await writeLists(nextLists);
      res.status(200).json({ lists: nextLists });
      return;
    }

    if (req.method === "DELETE") {
      const listId = req.query.id;
      const lists = await readLists();
      const nextLists = lists.filter((entry) => entry.id !== listId);
      await writeLists(nextLists);
      res.status(200).json({ lists: nextLists });
      return;
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ error: "Blob sync failed" });
  }
};
