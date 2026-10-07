/* PROTECTTÚ — camada Firebase (Auth anónima + Realtime Database).
   A senha NUNCA vai para a base de dados nem para o caminho: guarda-se só um hash
   (joinKey) num nó ilegível; as regras (database.rules.json) comparam o hash. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, push, onValue, onChildAdded, onDisconnect, query, limitToLast, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

export const configured =
  /^AIza/.test(firebaseConfig.apiKey) && !/COLOQUE/.test(firebaseConfig.databaseURL);

let auth, db;
if (configured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
}

export const slug = (s) =>
  String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

async function deriveKey(cid, password) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode("protecttu:" + cid), iterations: 200000 }, base, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureAuth() {
  if (!configured) throw new Error("not-configured");
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  return (await signInAnonymously(auth)).user;
}

const base = (cid) => `communities/${cid}`;

export async function createCommunity({ name, password, userName, phone }) {
  const u = await ensureAuth();
  const cid = slug(name);
  if (cid.length < 3) throw new Error("O nome da comunidade precisa de pelo menos 3 letras.");
  if (password.length < 8) throw new Error("A senha precisa de pelo menos 8 caracteres.");
  const key = await deriveKey(cid, password);
  const member = { name: userName, joined: serverTimestamp(), key };
  if (phone) member.phone = phone;
  await set(ref(db, base(cid)), {
    meta: { name: name.trim(), adminUid: u.uid, created: serverTimestamp() },
    secret: { joinKey: key },
    members: { [u.uid]: member },
  });
  let indexOk = true;                 // lista usada pela Central; falhar aqui não impede a criação
  try { await set(ref(db, `index/${cid}`), { name: name.trim(), adminUid: u.uid, created: serverTimestamp() }); }
  catch (err) { indexOk = false; console.warn("[index]", err); }
  return { cid, communityName: name.trim(), userName, uid: u.uid, indexOk };
}

export async function joinCommunity({ name, password, userName, phone }) {
  const u = await ensureAuth();
  const cid = slug(name);
  const key = await deriveKey(cid, password);
  const member = { name: userName, joined: serverTimestamp(), key };
  if (phone) member.phone = phone;
  await set(ref(db, `${base(cid)}/members/${u.uid}`), member);   // a regra compara o hash com o guardado
  const meta = (await get(ref(db, `${base(cid)}/meta`))).val();
  return { cid, communityName: meta ? meta.name : name.trim(), userName, uid: u.uid };
}

export async function leaveCommunity(session) {
  const u = await ensureAuth();
  await set(ref(db, `${base(session.cid)}/members/${u.uid}`), null);
}

export async function sendAlert(session, text, extra = {}) {
  const u = await ensureAuth();
  const a = {
    uid: u.uid, user: session.userName, text: String(text).trim().slice(0, 500),
    type: extra.type === "sos" ? "sos" : "alerta", ts: serverTimestamp(),
  };
  if (extra.pol) { a.pol = String(extra.pol).slice(0, 20); if (extra.polNome) a.polNome = String(extra.polNome).slice(0, 60); }
  if (Array.isArray(extra.for) && extra.for.length) {         // contactos cujo telemóvel deve tocar o alarme (só hashes)
    a.for = {}; for (const p of extra.for.slice(0, 5)) a.for[await phoneHash(session.cid, p)] = true;
  }
  if (typeof extra.lat === "number" && typeof extra.lng === "number") { a.lat = extra.lat; a.lng = extra.lng; }
  const r = await push(ref(db, `${base(session.cid)}/alerts`), a);
  return r.key;
}

export const deleteAlert = (cid, id) => update(ref(db), { [`${base(cid)}/alerts/${id}`]: null });
export const removeMember = (cid, uid) => update(ref(db), { [`${base(cid)}/members/${uid}`]: null });
export const saveInfo = (cid, description) => update(ref(db, `${base(cid)}/info`), { description: description.slice(0, 500) });

export function watchCommunity(cid, h) {
  const err = (e) => h.error && h.error(e);
  const offs = [
    onValue(ref(db, `${base(cid)}/meta`), (s) => h.meta && h.meta(s.val()), err),
    onValue(ref(db, `${base(cid)}/info`), (s) => h.info && h.info(s.val()), err),
    onValue(ref(db, `${base(cid)}/members`), (s) => {
      const list = []; s.forEach((c) => { list.push({ uid: c.key, ...c.val() }); });
      h.members && h.members(list);
    }, err),
    onValue(query(ref(db, `${base(cid)}/alerts`), limitToLast(50)), (s) => {
      const list = []; s.forEach((c) => { list.push({ id: c.key, ...c.val() }); });
      h.alerts && h.alerts(list.reverse());
    }, err),
    onValue(ref(db, ".info/connected"), (s) => h.connected && h.connected(!!s.val())),
  ];
  return () => offs.forEach((off) => off());
}

/* "Já vi / vou ajudar" — resposta de um membro a um S.O.S */
export async function ackAlert(cid, id) {
  const u = await ensureAuth();
  await set(ref(db, `${base(cid)}/alerts/${id}/acks/${u.uid}`), serverTimestamp());
}
export async function countAcks(cid, id) {
  await ensureAuth();
  const s = await get(ref(db, `${base(cid)}/alerts/${id}/acks`));
  return s.exists() ? Object.keys(s.val()).length : 0;
}
export { auth, db };

export async function ensureIndex(cid, name) {
  try { const u = await ensureAuth(); await set(ref(db, `index/${cid}`), { name, adminUid: u.uid, created: serverTimestamp() }); }
  catch (e) { /* já existe ou regras antigas: ignora */ }
}

export async function phoneHash(cid, phone) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cid + "|" + phone));
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const watchAlerts = (cid, cb) =>
  onChildAdded(query(ref(db, `${base(cid)}/alerts`), limitToLast(1)), (s) => cb({ id: s.key, ...s.val() }), () => {});
/* Presença: a Central vê quantos membros estão ligados agora */
export function announcePresence(session) {
  return ensureAuth().then((u) => {
    const pr = ref(db, `presence/${u.uid}`);
    return onValue(ref(db, ".info/connected"), (s) => {
      if (!s.val()) return;
      onDisconnect(pr).remove().then(() => set(pr, { cid: session.cid, name: session.userName, ts: serverTimestamp() })).catch(() => {});
    });
  });
}
