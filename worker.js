/**
 * lex-mexico-worker — Cloudflare Worker
 *
 * BINDINGS requeridos (Dashboard → Worker → Settings → Bindings):
 *   R2 Bucket  LEX_RECIBOS     → lex-recibos-pdf
 *   R2 Bucket  LEX_PLACAS      → lex-placas
 *   R2 Bucket  LEX_EXPEDIENTES → lex-expedientes
 *
 * Variable de entorno (Settings → Variables):
 *   AUTH_TOKEN  → LexMx2026-R2-7kP9nQvT   (mismo valor que R2_TOKEN en index.html)
 *
 * Endpoints:
 *   POST   /r2/upload          body: FormData { file, path, bucket }
 *   GET    /r2/file?path=&bucket=&token=   → sirve el archivo inline
 *   DELETE /r2/file?path=&bucket=          header X-Auth-Token requerido
 *   GET    /r2/list?prefix=&bucket=&limit= → JSON { objects: [...] }
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
  'Access-Control-Max-Age': '86400',
};

function getBucket(env, name) {
  if (name === 'recibos')     return env.LEX_RECIBOS;
  if (name === 'placas')      return env.LEX_PLACAS;
  if (name === 'expedientes') return env.LEX_EXPEDIENTES;
  return null;
}

function resp(body, status, extra) {
  return new Response(body, { status: status || 200, headers: Object.assign({}, CORS, extra || {}) });
}

function json(data, status) {
  return resp(JSON.stringify(data), status || 200, { 'Content-Type': 'application/json' });
}

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const method = request.method;

    // Preflight CORS
    if (method === 'OPTIONS') return resp(null, 204);

    // Autenticación: header para escritura/borrado, query param para GETs directos desde browser
    const token = request.headers.get('X-Auth-Token') || url.searchParams.get('token');
    if (!token || token !== env.AUTH_TOKEN) {
      return resp('Unauthorized', 401);
    }

    const path       = url.pathname;
    const bucketName = url.searchParams.get('bucket') || 'recibos';
    const r2         = getBucket(env, bucketName);
    if (!r2) return json({ error: 'bucket invalido: ' + bucketName }, 400);

    try {

      // ── UPLOAD ─────────────────────────────────────────────────────
      if (path === '/r2/upload' && method === 'POST') {
        const fd       = await request.formData();
        const file     = fd.get('file');
        const filePath = fd.get('path');
        if (!file || !filePath) return json({ error: 'Falta file o path' }, 400);

        // arrayBuffer() es más confiable que stream() en Workers con FormData
        const buffer = await file.arrayBuffer();
        await r2.put(filePath, buffer, {
          httpMetadata: { contentType: file.type || 'application/octet-stream' }
        });
        return json({ ok: true, path: filePath });
      }

      // ── DESCARGA / VISOR ───────────────────────────────────────────
      if (path === '/r2/file' && method === 'GET') {
        const filePath = url.searchParams.get('path');
        if (!filePath) return json({ error: 'Falta path' }, 400);

        const obj = await r2.get(filePath);
        if (!obj) return resp('Not found', 404);

        const headers = new Headers(CORS);
        obj.writeHttpMetadata(headers);
        const disposition = url.searchParams.get('dl') === '1' ? 'attachment' : 'inline';
        headers.set('Content-Disposition', disposition + '; filename="' + filePath.split('/').pop() + '"');
        headers.set('Cache-Control', 'private, max-age=300');
        return new Response(obj.body, { headers });
      }

      // ── BORRAR ─────────────────────────────────────────────────────
      if (path === '/r2/file' && method === 'DELETE') {
        const filePath = url.searchParams.get('path');
        if (!filePath) return json({ error: 'Falta path' }, 400);
        await r2.delete(filePath);
        return json({ ok: true });
      }

      // ── LISTAR ─────────────────────────────────────────────────────
      if (path === '/r2/list' && method === 'GET') {
        const prefix  = url.searchParams.get('prefix') || '';
        const limit   = parseInt(url.searchParams.get('limit') || '1000');
        const listed  = await r2.list({ prefix, limit });
        return json({
          objects: listed.objects.map(function(o) {
            return {
              name:       o.key.split('/').pop(),
              key:        o.key,
              size:       o.size,
              uploaded:   o.uploaded,
              created_at: o.uploaded   // compatibilidad con código que usa .created_at
            };
          })
        });
      }

      return resp('Not found', 404);

    } catch (e) {
      console.error('Worker error:', e);
      return json({ error: e.message }, 500);
    }
  }
};
