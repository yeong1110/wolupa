import { head, put } from '@vercel/blob';

const NOTES_PATH = 'notes.json';
const MAX_NOTES = 8;
const TTL_MS = 5 * 60 * 1000; // 5분 지나면 아무도 안 봤어도 자동 폐기
const NAME_POOL = ["김사원님","이사원님","박대리님","최부장님","정과장님","한대리님","오사원님","윤차장님","장팀장님","서인턴님","황상무님","노주임님"];

const token = process.env.BLOB_READ_WRITE_TOKEN;

async function readNotes() {
  try {
    const info = await head(NOTES_PATH, { token });
    const res = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return []; // 블롭이 아직 없으면 404 -> 빈 배열 취급
  }
}

async function writeNotes(notes) {
  await put(NOTES_PATH, JSON.stringify(notes), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const notes = await readNotes();
    const now = Date.now();
    const fresh = notes.filter(n => now - n.ts < TTL_MS);
    if (fresh.length === 0) {
      if (fresh.length !== notes.length) await writeNotes(fresh);
      return res.status(200).json({ note: null });
    }
    // 가장 오래된 쪽지 하나를 이 요청이 "소비" -> 즉시 삭제(휘발)
    const [next, ...rest] = fresh;
    await writeNotes(rest);
    return res.status(200).json({ note: next });
  }

  if (req.method === 'POST') {
    const text = (req.body && req.body.text ? String(req.body.text) : '').trim().slice(0, 40);
    if (!text) return res.status(400).json({ error: 'empty' });

    const notes = await readNotes();
    const now = Date.now();
    let list = notes.filter(n => now - n.ts < TTL_MS);
    const from = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)];
    list.push({ id: now + '-' + Math.random().toString(36).slice(2, 6), text, ts: now, from });
    if (list.length > MAX_NOTES) list = list.slice(list.length - MAX_NOTES);
    await writeNotes(list);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
