import { randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const META_VERSION = process.env.META_GRAPH_API_VERSION || 'v26.0';
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION || '202610';
// Keep OAuth on the scope currently authorized for this app. Page lookup is attempted
// after connection; LinkedIn may deny it until organization-admin access is approved.
const LINKEDIN_SCOPES = 'w_organization_social';
function canonicalMediaUrl(input) {
  const value = String(input || '').trim();
  if (!value) return value;
  try {
    const parsed = new URL(value, process.env.PUBLIC_API_URL || 'http://localhost');
    if (!parsed.pathname.startsWith('/uploads/')) return value;
    const base = String(process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    return `${base}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch { return value; }
}

async function apiJson(url, init = {}, timeoutMs = 30_000) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || body?.message || `Provider returned HTTP ${response.status}.`;
    throw Object.assign(new Error(message), { status: response.status, provider: body?.error?.type || 'provider' });
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) body._providerId = response.headers.get('x-restli-id') || response.headers.get('location') || '';
  return body;
}

async function linkedinUploadImage({ accessToken, owner, imageUrl }) {
  const fileName = path.basename(new URL(imageUrl, process.env.PUBLIC_API_URL || 'http://localhost').pathname);
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || './uploads');
  const filePath = path.resolve(uploadRoot, fileName);
  if (!filePath.startsWith(`${uploadRoot}${path.sep}`)) throw Object.assign(new Error('The selected LinkedIn image must be an uploaded media-library file.'), { status: 422 });
  await stat(filePath);
  const bytes = await readFile(filePath);
  const extension = path.extname(fileName).toLowerCase();
  const contentType = extension === '.png' ? 'image/png' : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : '';
  if (!contentType) throw Object.assign(new Error('LinkedIn image posts support PNG or JPEG media-library files.'), { status: 422 });
  const headers = { Authorization: `Bearer ${accessToken}`, 'LinkedIn-Version': LINKEDIN_VERSION, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' };
  const initialized = await apiJson('https://api.linkedin.com/rest/images?action=initializeUpload', { method: 'POST', headers, body: JSON.stringify({ initializeUploadRequest: { owner } }) });
  const uploadUrl = initialized.value?.uploadUrl;
  const imageUrn = initialized.value?.image;
  if (!uploadUrl || !imageUrn) throw new Error('LinkedIn did not return an image upload URL and image URN.');
  const uploaded = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: bytes, signal: AbortSignal.timeout(60_000) });
  if (!uploaded.ok) throw Object.assign(new Error(`LinkedIn image upload failed with HTTP ${uploaded.status}.`), { status: uploaded.status });
  return imageUrn;
}

function localUploadFile(mediaUrl) {
  const fileName = path.basename(new URL(mediaUrl, process.env.PUBLIC_API_URL || 'http://localhost').pathname);
  const root = path.resolve(process.env.UPLOAD_DIR || './uploads');
  const full = path.resolve(root, fileName);
  if (!full.startsWith(`${root}${path.sep}`)) throw Object.assign(new Error('Choose a file from the application media library.'), { status: 422 });
  return { fileName, full, root };
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let errorText = '';
    const timeout = setTimeout(() => child.kill('SIGKILL'), 5 * 60_000);
    child.stderr.on('data', chunk => { errorText = (errorText + chunk.toString()).slice(-1500); });
    child.once('error', error => { clearTimeout(timeout); reject(Object.assign(new Error(`Could not start ${command}: ${error.message}`), { status: 503 })); });
    child.once('close', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(Object.assign(new Error(`Media conversion failed. ${errorText}`), { status: 422 })); });
  });
}

async function instagramJpegUrl(postId, imageUrl) {
  const { fileName, full, root } = localUploadFile(imageUrl);
  await stat(full);
  if (/\.jpe?g$/i.test(fileName)) return imageUrl;
  const outputName = `instagram-${postId}.jpg`;
  const output = path.join(root, outputName);
  await run('ffmpeg', ['-nostdin', '-y', '-i', full, '-frames:v', '1', '-q:v', '2', output]);
  const base = String(process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
  if (!base) throw Object.assign(new Error('Set PUBLIC_API_URL to a public API origin before publishing Instagram images.'), { status: 503 });
  return `${base}/uploads/${outputName}`;
}

async function linkedinUploadVideo({ accessToken, owner, videoUrl }) {
  const { full } = localUploadFile(videoUrl);
  const info = await stat(full);
  if (info.size < 75 * 1024 || info.size > 100 * 1024 * 1024) throw Object.assign(new Error('LinkedIn video uploads must be MP4 files between 75 KB and 100 MB.'), { status: 422 });
  const bytes = await readFile(full);
  const headers = { Authorization: `Bearer ${accessToken}`, 'LinkedIn-Version': LINKEDIN_VERSION, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' };
  const initialized = await apiJson('https://api.linkedin.com/rest/videos?action=initializeUpload', { method: 'POST', headers, body: JSON.stringify({ initializeUploadRequest: { owner, fileSizeBytes: bytes.length, uploadCaptions: false, uploadThumbnail: false } }) });
  const value = initialized.value || {};
  if (!value.video || !Array.isArray(value.uploadInstructions) || !value.uploadInstructions.length) throw new Error('LinkedIn did not return video upload instructions.');
  const uploadedPartIds = [];
  for (const part of value.uploadInstructions) {
    const chunk = bytes.subarray(Number(part.firstByte), Number(part.lastByte) + 1);
    const response = await fetch(part.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: chunk, signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw Object.assign(new Error(`LinkedIn video upload part failed with HTTP ${response.status}.`), { status: response.status });
    const etag = String(response.headers.get('etag') || '').replace(/^"|"$/g, '');
    if (!etag) throw new Error('LinkedIn video upload did not return a part ETag.');
    uploadedPartIds.push(etag);
  }
  await apiJson('https://api.linkedin.com/rest/videos?action=finalizeUpload', { method: 'POST', headers, body: JSON.stringify({ finalizeUploadRequest: { video: value.video, uploadToken: value.uploadToken || '', uploadedPartIds } }) });
  for (let attempt = 0; attempt < 60; attempt++) {
    const video = await apiJson(`https://api.linkedin.com/rest/videos/${encodeURIComponent(value.video)}`, { headers });
    if (video.status === 'AVAILABLE') return value.video;
    if (['PROCESSING_FAILED', 'FAILED'].includes(video.status)) throw new Error('LinkedIn could not process the uploaded video.');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw Object.assign(new Error('LinkedIn video is still processing. Retry publishing after the video becomes available.'), { status: 503 });
}

function postText(post) {
  const v = post.variants?.[post.platform] || {};
  return [v.hook, v.caption, v.hashtags].map(x => String(x || '').trim()).filter(Boolean).join('\n\n').slice(0, 60000);
}

function accountSecret(row, decryptSecret) {
  const encrypted = row.credentials?.ciphertext;
  if (!encrypted?.iv) throw Object.assign(new Error('Save valid provider credentials before connecting.'), { status: 409 });
  try { return JSON.parse(decryptSecret(encrypted)); }
  catch { throw Object.assign(new Error('Saved credentials cannot be decrypted. Check the server CREDENTIAL_ENCRYPTION_KEY.'), { status: 503 }); }
}

export function mountSocialRoutes(app, { pool, fail, encryptSecret, decryptSecret }) {
  app.post('/api/accounts/:id/validate', async (req, res, next) => {
    if (req.user.role !== 'Super Administrator') return fail(res, 403, 'Administrator permission is required.');
    try {
      const { rows } = await pool.query('SELECT * FROM social_accounts WHERE id=$1', [req.params.id]);
      const account = rows[0];
      if (!account) return fail(res, 404, 'Social account not found.');
      const credentials = accountSecret(account, decryptSecret);
      let identity;
      if (account.platform === 'Facebook') {
        identity = await apiJson(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(credentials.pageId)}?fields=id,name&access_token=${encodeURIComponent(credentials.accessToken)}`);
        if (String(identity.id) !== String(credentials.pageId)) throw new Error('The token does not have access to the configured Page ID.');
      } else if (account.platform === 'Instagram') {
        identity = await apiJson(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(credentials.pageId)}?fields=id,username,name&access_token=${encodeURIComponent(credentials.accessToken)}`);
        if (String(identity.id) !== String(credentials.pageId)) throw new Error('The token does not have access to the configured Instagram professional account ID.');
      } else if (account.platform === 'LinkedIn') {
        if (!credentials.accessToken) return fail(res, 409, 'Authorize this LinkedIn account with the Connect LinkedIn button first.');
        if (credentials.expiresAt && Date.parse(credentials.expiresAt) <= Date.now()) throw new Error('LinkedIn authorization expired. Reconnect the account.');
        identity = { name: credentials.organizationUrn ? 'LinkedIn company Page authorization' : 'LinkedIn posting authorization' };
      } else return fail(res, 400, 'Unsupported social platform.');
      await pool.query("UPDATE social_accounts SET status='Connected',last_connected=now()::text,last_error='' WHERE id=$1", [account.id]);
      res.json({ id: account.id, status: 'Connected', identity: identity.name || identity.username || identity.name || identity.sub || 'Authorized account' });
    } catch (error) {
      await pool.query("UPDATE social_accounts SET status='Disconnected',last_error=$1 WHERE id=$2", [String(error.message).slice(0, 1000), req.params.id]).catch(() => {});
      next(error);
    }
  });

  app.post('/api/accounts/:id/linkedin/connect', async (req, res, next) => {
    if (req.user.role !== 'Super Administrator') return fail(res, 403, 'Administrator permission is required.');
    try {
      const { rows } = await pool.query("SELECT * FROM social_accounts WHERE id=$1 AND platform='LinkedIn'", [req.params.id]);
      if (!rows[0]) return fail(res, 404, 'LinkedIn account not found.');
      const credentials = accountSecret(rows[0], decryptSecret);
      if (!credentials.clientId || !credentials.clientSecret) return fail(res, 409, 'Save LinkedIn client ID and client secret first.');
      const redirectUri = String(req.body.redirectUri || process.env.LINKEDIN_REDIRECT_URI || `${process.env.PUBLIC_API_URL || ''}/api/oauth/linkedin/callback`).trim();
      if (!/^https?:\/\//i.test(redirectUri)) return fail(res, 400, 'Configure the LinkedIn OAuth callback URL in this dialog or server settings.');
      const state = randomBytes(32).toString('hex');
      await pool.query('INSERT INTO oauth_states(state,account_id,user_id,redirect_uri,expires_at) VALUES($1,$2,$3,$4,now()+interval \'10 minutes\')', [state, rows[0].id, req.user.sub, redirectUri]);
      const authorize = new URL('https://www.linkedin.com/oauth/v2/authorization');
      authorize.search = new URLSearchParams({ response_type: 'code', client_id: credentials.clientId, redirect_uri: redirectUri, state, scope: LINKEDIN_SCOPES }).toString();
      res.json({ authorizationUrl: authorize.toString(), redirectUri });
    } catch (error) { next(error); }
  });

  app.get('/api/oauth/linkedin/callback', async (req, res) => {
    const state = String(req.query.state || '');
    const code = String(req.query.code || '');
    try {
      if (!state || !code) throw new Error(String(req.query.error_description || req.query.error || 'LinkedIn authorization was cancelled.'));
      const client = await pool.connect();
      let account;
      try {
        await client.query('BEGIN');
        const savedState = await client.query('DELETE FROM oauth_states WHERE state=$1 AND expires_at>now() RETURNING account_id,user_id,redirect_uri', [state]);
        if (!savedState.rows[0]) throw new Error('This LinkedIn authorization request expired or was already used. Start Connect LinkedIn again.');
        const found = await client.query("SELECT * FROM social_accounts WHERE id=$1 AND platform='LinkedIn' FOR UPDATE", [savedState.rows[0].account_id]);
        if (!found.rows[0]) throw new Error('LinkedIn account no longer exists.');
        account = found.rows[0];
        const credentials = accountSecret(account, decryptSecret);
        const redirectUri = savedState.rows[0].redirect_uri;
        const token = await apiJson('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: credentials.clientId, client_secret: credentials.clientSecret, redirect_uri: redirectUri }) });

        const updated = { ...credentials, accessToken: token.access_token, refreshToken: token.refresh_token || '', expiresAt: new Date(Date.now() + Number(token.expires_in || 0) * 1000).toISOString(), oauthScopes: LINKEDIN_SCOPES };
        await client.query("UPDATE social_accounts SET credentials=$1,status='Connected',last_connected=now()::text,last_error='',metadata=(metadata-'organizationOptions'-'organizationLookupError')||$2::jsonb WHERE id=$3", [JSON.stringify({ ciphertext: encryptSecret(JSON.stringify(updated)) }), JSON.stringify({ displayName: updated.displayName, personUrn: updated.personUrn }), account.id]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
      finally { client.release(); }
      const appUrl = String(process.env.PUBLIC_APP_URL || process.env.PUBLIC_API_URL || '').trim();
      res.redirect(appUrl ? `${appUrl.replace(/\/$/, '')}/integrations?linkedin=connected` : '/api/health?linkedin=connected');
    } catch (error) {
      const appUrl = String(process.env.PUBLIC_APP_URL || process.env.PUBLIC_API_URL || '').trim();
      const message = encodeURIComponent(String(error.message).slice(0, 250));
      res.redirect(appUrl ? `${appUrl.replace(/\/$/, '')}/integrations?linkedin=error&message=${message}` : `/api/health?linkedin=error&message=${message}`);
    }
  });

  app.post('/api/posts/:id/publish', async (req, res, next) => {
    if (!['Super Administrator', 'Editor'].includes(req.user.role)) return fail(res, 403, 'Editor or administrator permission is required.');
    try {
      const post = await publishById(pool, req.params.id, { decryptSecret, encryptSecret, failIfNotApproved: true });
      res.json(post);
    } catch (error) { next(error); }
  });

  app.post('/api/posts/:id/republish', async (req, res, next) => {
    if (!['Super Administrator', 'Editor'].includes(req.user.role)) return fail(res, 403, 'Editor or administrator permission is required.');
    try {
      const { rows } = await pool.query('SELECT * FROM posts WHERE id=$1', [req.params.id]);
      const post = rows[0];
      if (!post) return fail(res, 404, 'Post not found.');
      if (req.user.role !== 'Super Administrator' && !req.user.businesses?.includes(post.business_id)) return fail(res, 403, 'This business is not assigned to your account.');
      if (!post.provider_deleted_at) return fail(res, 409, 'Only a post deleted from its social account can be republished here.');
      await pool.query("UPDATE posts SET status='Approved',last_publish_error='',updated_at=now() WHERE id=$1", [post.id]);
      const republished = await publishById(pool, post.id, { decryptSecret, encryptSecret, failIfNotApproved: true });
      res.json(republished);
    } catch (error) { next(error); }
  });

  app.post('/api/posts/:id/mark-deleted', async (req, res, next) => {
    if (!['Super Administrator', 'Editor'].includes(req.user.role)) return fail(res, 403, 'Editor or administrator permission is required.');
    try {
      const { rows } = await pool.query('SELECT * FROM posts WHERE id=$1', [req.params.id]);
      const post = rows[0];
      if (!post) return fail(res, 404, 'Post not found.');
      if (req.user.role !== 'Super Administrator' && !req.user.businesses?.includes(post.business_id)) return fail(res, 403, 'This business is not assigned to your account.');
      if (post.platform !== 'Instagram' || post.status !== 'Published' || !post.provider_post_id) return fail(res, 409, 'Only a published Instagram post can be marked deleted manually.');
      const history = JSON.stringify([{ action: 'Manually marked deleted from Instagram', date: new Date().toISOString() }]);
      const { rows: updated } = await pool.query("UPDATE posts SET status='Deleted',provider_deleted_at=now(),history=history||$1::jsonb,updated_at=now() WHERE id=$2 RETURNING *", [history, post.id]);
      res.json(updated[0]);
    } catch (error) { next(error); }
  });

  // Permanently remove only the app's saved record. This never calls a social API.
  app.delete('/api/posts/:id/record', async (req, res, next) => {
    if (!['Super Administrator', 'Editor'].includes(req.user.role)) return fail(res, 403, 'Editor or administrator permission is required.');
    try {
      const found = await pool.query('SELECT id,business_id FROM posts WHERE id=$1', [req.params.id]);
      const post = found.rows[0];
      if (!post) return fail(res, 404, 'Saved post record not found.');
      if (req.user.role !== 'Super Administrator' && !req.user.businesses?.includes(post.business_id)) return fail(res, 403, 'This business is not assigned to your account.');
      await pool.query('DELETE FROM posts WHERE id=$1', [post.id]);
      res.status(204).end();
    } catch (error) { next(error); }
  });

  app.delete('/api/posts/:id/published', async (req, res, next) => {
    if (!['Super Administrator', 'Editor'].includes(req.user.role)) return fail(res, 403, 'Editor or administrator permission is required.');
    try {
      const found = await pool.query('SELECT * FROM posts WHERE id=$1', [req.params.id]);
      const post = found.rows[0];
      if (!post) return fail(res, 404, 'Published post not found.');
      if (req.user.role !== 'Super Administrator' && !req.user.businesses?.includes(post.business_id)) return fail(res, 403, 'This business is not assigned to your account.');
      if (post.status !== 'Published' || !post.provider_post_id) return fail(res, 409, 'This post has no confirmed provider publication to delete.');
      if (post.provider_deleted_at) return fail(res, 409, 'This post is already marked as deleted from its social account.');
      const accountResult = post.provider_account_id ? await pool.query("SELECT * FROM social_accounts WHERE id=$1 AND status='Connected'", [post.provider_account_id]) : await pool.query("SELECT * FROM social_accounts WHERE business_id=$1 AND platform=$2 AND status='Connected' ORDER BY id LIMIT 1", [post.business_id, post.platform]);
      const account = accountResult.rows[0];
      if (!account) return fail(res, 409, `Reconnect the ${post.platform} account before deleting the published post.`);
      const credentials = accountSecret(account, decryptSecret);
      let providerUrl = post.provider_post_url || '';
      if (post.platform === 'LinkedIn') {
        providerUrl ||= `https://www.linkedin.com/feed/update/${post.provider_post_id}/`;
        await apiJson(`https://api.linkedin.com/rest/posts/${encodeURIComponent(post.provider_post_id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${credentials.accessToken}`, 'LinkedIn-Version': LINKEDIN_VERSION, 'X-Restli-Protocol-Version': '2.0.0', 'X-RestLi-Method': 'DELETE' } });
      } else if (post.platform === 'Facebook') {
        try { const details = await apiJson(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(post.provider_post_id)}?fields=permalink_url&access_token=${encodeURIComponent(credentials.accessToken)}`); providerUrl ||= String(details.permalink_url || ''); } catch {}
        await apiJson(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(post.provider_post_id)}?access_token=${encodeURIComponent(credentials.accessToken)}`, { method: 'DELETE' });
      } else if (post.platform === 'Instagram') {
        try { const details = await apiJson(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(post.provider_post_id)}?fields=permalink&access_token=${encodeURIComponent(credentials.accessToken)}`); providerUrl ||= String(details.permalink || ''); } catch {}
        await apiJson(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(post.provider_post_id)}?access_token=${encodeURIComponent(credentials.accessToken)}`, { method: 'DELETE' });
      }
      const history = JSON.stringify([{ action: 'Deleted from social account', date: new Date().toISOString() }]);
      const { rows: updated } = await pool.query("UPDATE posts SET status='Deleted',provider_post_url=COALESCE(NULLIF(provider_post_url,''),$1),provider_deleted_at=now(),history=history||$2::jsonb,updated_at=now() WHERE id=$3 RETURNING *", [providerUrl, history, post.id]);
      res.json(updated[0]);
    } catch (error) { next(error); }
  });
  app.post('/api/analytics/refresh', async (req, res, next) => {
    try {
      const accountSql = req.user.role === 'Super Administrator' ? "SELECT * FROM social_accounts WHERE status='Connected'" : "SELECT * FROM social_accounts WHERE status='Connected' AND business_id=ANY($1::text[])";
      const accounts = await pool.query(accountSql, req.user.role === 'Super Administrator' ? [] : [req.user.businesses]);
      const errors = [];
      let updated = 0;
      for (const account of accounts.rows) {
        try {
          const credentials = accountSecret(account, decryptSecret);
          const postSql = 'SELECT id,platform,provider_post_id,business_id,title FROM posts WHERE business_id=$1 AND platform=$2 AND status=$3 AND provider_post_id IS NOT NULL AND published_at>now()-interval \'90 days\' ORDER BY published_at DESC LIMIT 100';
          const posts = await pool.query(postSql, [account.business_id, account.platform, 'Published']);
          if (account.platform === 'LinkedIn') {
            const author = credentials.organizationUrn || account.metadata?.organizationUrn;
            if (!author?.startsWith('urn:li:organization:')) { errors.push({ accountId: account.id, platform: account.platform, error: 'Company analytics require a LinkedIn organization URN and approved read permission.' }); continue; }
            for (const post of posts.rows) {
              try {
                const query = new URLSearchParams({ q: 'organizationalEntity', organizationalEntity: author, shares: `List(${post.provider_post_id})` });
                const result = await apiJson(`https://api.linkedin.com/rest/organizationalEntityShareStatistics?${query}`, { headers: { Authorization: `Bearer ${credentials.accessToken}`, 'LinkedIn-Version': LINKEDIN_VERSION, 'X-Restli-Protocol-Version': '2.0.0' } });
                const raw = result.elements?.[0]?.totalShareStatistics || {};
                const stats = { impressions: Number(raw.impressionCount || 0), reach: Number(raw.uniqueImpressionsCount || 0), clicks: Number(raw.clickCount || 0), likes: Number(raw.likeCount || 0), comments: Number(raw.commentCount || 0), shares: Number(raw.shareCount || 0), engagement: Number(raw.likeCount || 0) + Number(raw.commentCount || 0) + Number(raw.shareCount || 0), engagementRate: Number(raw.engagement || 0) };
                await pool.query('INSERT INTO post_metrics(post_id,platform,stats,source) VALUES($1,$2,$3,$4) ON CONFLICT(post_id) DO UPDATE SET stats=EXCLUDED.stats,fetched_at=now(),source=EXCLUDED.source', [post.id, account.platform, JSON.stringify(stats), 'LinkedIn Organization Share Statistics']);
                updated++;
              } catch (error) { errors.push({ accountId: account.id, postId: post.id, platform: account.platform, error: String(error.message).slice(0, 300) }); }
            }
          } else {
            const metaVersion = META_VERSION;
            const endpoint = `https://graph.facebook.com/${metaVersion}/${encodeURIComponent(credentials.pageId)}/insights`;
            const metrics = account.platform === 'Instagram' ? 'reach,total_interactions' : 'page_impressions,page_post_engagements';
            const params = new URLSearchParams({ metric: metrics, access_token: credentials.accessToken, ...(account.platform === 'Instagram' ? { metric_type: 'total_value', timeframe: 'last_30_days' } : { period: 'day', date_preset: 'last_30d' }) });
            const result = await apiJson(`${endpoint}?${params}`);
            const totals = Object.fromEntries((result.data || []).map(metric => [metric.name, Number(metric.total_value?.value ?? (metric.values || []).reduce((sum, item) => sum + Number(item.value || 0), 0))]));
            const stats = { reach: Number(totals.reach || 0), impressions: Number(totals.page_impressions || 0), engagement: Number(totals.total_interactions || totals.page_post_engagements || 0), likes: 0, comments: 0, shares: 0, clicks: 0 };
            await pool.query('INSERT INTO account_metrics(account_id,stats,source) VALUES($1,$2,$3) ON CONFLICT(account_id) DO UPDATE SET stats=EXCLUDED.stats,fetched_at=now(),source=EXCLUDED.source', [account.id, JSON.stringify(stats), `${account.platform} Insights API · 30 days`]);
            updated++;
          }
        } catch (error) { errors.push({ accountId: account.id, platform: account.platform, error: String(error.message).slice(0, 300) }); }
      }
      res.json({ updated, errors, refreshedAt: new Date().toISOString() });
    } catch (error) { next(error); }
  });

  app.get('/api/analytics/live', async (req, res, next) => {
    try {
      const scope = req.user.role === 'Super Administrator' ? { clause: '', values: [] } : { clause: 'AND p.business_id=ANY($1::text[])', values: [req.user.businesses] };
      const counts = await pool.query(`SELECT status,count(*)::int AS count FROM posts p WHERE true ${scope.clause} GROUP BY status`, scope.values);
      const metrics = await pool.query(`SELECT m.post_id,m.platform,m.stats,m.fetched_at,m.source,p.title,p.business_id FROM post_metrics m JOIN posts p ON m.post_id=p.id WHERE true ${scope.clause} UNION ALL SELECT ('account:'||a.id) AS post_id,a.platform,m.stats,m.fetched_at,m.source,a.name AS title,a.business_id FROM account_metrics m JOIN social_accounts a ON a.id=m.account_id ${req.user.role==='Super Administrator'?'':'WHERE a.business_id=ANY($1::text[])'} ORDER BY fetched_at DESC`, scope.values);
      const stats = metrics.rows.map(row => row.stats || {});
      const sum = key => stats.reduce((total, item) => total + Number(item[key] || 0), 0);
      res.json({ reach: sum('reach'), engagement: sum('engagement'), clicks: sum('clicks'), series: [], counts: Object.fromEntries(counts.rows.map(row => [row.status, row.count])), source: stats.length ? 'Cached metrics from connected provider APIs' : 'No live metrics fetched yet', items: metrics.rows.map(row => ({ postId: row.post_id, platform: row.platform, title: row.title || row.post_id, businessId: row.business_id || '', stats: row.stats, fetchedAt: row.fetched_at, source: row.source })) });
    } catch (error) { next(error); }
  });

  return { publishDue: () => publishDue(pool, { decryptSecret, encryptSecret }) };
}

async function publishById(pool, postId, { decryptSecret, encryptSecret, failIfNotApproved = false } = {}) {
  const client = await pool.connect();
  let post, account;
  try {
    await client.query('BEGIN');
    const found = await client.query("SELECT * FROM posts WHERE id=$1 FOR UPDATE", [postId]);
    post = found.rows[0];
    if (!post) throw Object.assign(new Error('Post not found.'), { status: 404 });
    post.image = canonicalMediaUrl(post.image);
    if (!['Scheduled', 'Approved'].includes(post.status) || (failIfNotApproved && post.status !== 'Approved')) throw Object.assign(new Error('Only approved posts can be published. Schedule approved posts for automatic publishing.'), { status: 409 });
    const selected = await client.query("SELECT * FROM social_accounts WHERE platform=$1 AND status='Connected' AND business_id=$2 ORDER BY id LIMIT 1", [post.platform, post.business_id]);
    account = selected.rows[0];
    if (!account) throw Object.assign(new Error(`No connected ${post.platform} account is assigned to this business.`), { status: 409 });
    post.media_type = post.image ? (await client.query('SELECT type FROM media_assets WHERE url=$1 AND business_id=$2 LIMIT 1', [post.image, post.business_id])).rows[0]?.type || '' : '';
    await client.query("UPDATE posts SET status='Publishing',publish_attempts=publish_attempts+1,last_publish_error='' WHERE id=$1", [post.id]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); client.release(); throw error; }
  client.release();
  try {
    let credentials = accountSecret(account, decryptSecret);
    const text = postText({ ...post, platform: post.platform });
    if (!text) throw Object.assign(new Error('The post has no publishable caption.'), { status: 422 });
    let result;
    if (post.platform === 'Facebook') {
      const mediaUrl = String(post.image || '').trim();
      if (mediaUrl && !post.media_type) throw Object.assign(new Error('Select a saved image or video from this business media library.'), { status: 422 });
      const isVideo = post.media_type === 'Video';
      if (mediaUrl && ['Image', 'Logo'].includes(post.media_type)) {
        // Upload the photo as unpublished media, then create a normal Page Feed post that attaches it.
        const photo = await apiJson(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(credentials.pageId)}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          // Upload unpublished media, then attach it to the immediate Page Feed post below.
          body: new URLSearchParams({ url: mediaUrl, published: 'false', access_token: credentials.accessToken }),
        });
        if (!photo.id) throw new Error('Facebook did not return an uploaded photo ID.');
        result = await apiJson(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(credentials.pageId)}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ message: text, published: 'true', attached_media: JSON.stringify([{ media_fbid: photo.id }]), access_token: credentials.accessToken }),
        });
      } else {
        const endpoint = mediaUrl ? `https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(credentials.pageId)}/${isVideo ? 'videos' : 'feed'}` : `https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(credentials.pageId)}/feed`;
        const form = new URLSearchParams({ access_token: credentials.accessToken, ...(mediaUrl ? { file_url: mediaUrl, description: text, published: 'true' } : { message: text }) });
        result = await apiJson(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form }, isVideo ? 10 * 60_000 : 30_000);
      }
    } else if (post.platform === 'Instagram') {
      if (!post.image || !/^https?:\/\//i.test(post.image)) throw Object.assign(new Error('Instagram feed and Reel publishing requires public media. Upload or generate media first, and set PUBLIC_API_URL to the publicly reachable API origin.'), { status: 422 });
      if (!post.media_type) throw Object.assign(new Error('Select a saved image or video from this business media library.'), { status: 422 });
      const mediaParams = post.media_type === 'Video' ? { video_url: post.image, media_type: 'REELS', caption: text, access_token: credentials.accessToken } : { image_url: await instagramJpegUrl(post.id, post.image), caption: text, access_token: credentials.accessToken };
      const create = await apiJson(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(credentials.pageId)}/media`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(mediaParams) });
      if (post.media_type === 'Video') {
        let ready = false;
        for (let attempt = 0; attempt < 60; attempt++) {
          const state = await apiJson(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(create.id)}?fields=status_code,status&access_token=${encodeURIComponent(credentials.accessToken)}`);
          if (state.status_code === 'FINISHED') { ready = true; break; }
          if (state.status_code === 'ERROR' || state.status_code === 'EXPIRED') throw new Error(state.status || 'Meta could not process the Instagram Reel.');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        if (!ready) throw Object.assign(new Error('Instagram Reel is still processing. Retry publishing when its media container is ready.'), { status: 503 });
      }
      result = await apiJson(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(credentials.pageId)}/media_publish`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ creation_id: create.id, access_token: credentials.accessToken }) });
    } else if (post.platform === 'LinkedIn') {
      if (!credentials.accessToken) throw Object.assign(new Error('Connect the LinkedIn member account before publishing.'), { status: 409 });
      if (credentials.expiresAt && Date.parse(credentials.expiresAt) <= Date.now() + 5 * 60_000 && credentials.refreshToken) {
        const refreshed = await apiJson('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: credentials.refreshToken, client_id: credentials.clientId, client_secret: credentials.clientSecret }) });
        credentials = { ...credentials, accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token || credentials.refreshToken, expiresAt: new Date(Date.now() + Number(refreshed.expires_in || 0) * 1000).toISOString() };
        await pool.query('UPDATE social_accounts SET credentials=$1 WHERE id=$2', [JSON.stringify({ ciphertext: encryptSecret(JSON.stringify(credentials)) }), account.id]);
      }
      if (credentials.expiresAt && Date.parse(credentials.expiresAt) <= Date.now()) throw Object.assign(new Error('LinkedIn authorization expired. Reconnect the LinkedIn account.'), { status: 401 });
      const author = account.metadata?.organizationUrn || credentials.organizationUrn || credentials.personUrn;
      if (!author) throw Object.assign(new Error('LinkedIn OAuth is connected. Enter the company Page URN in Integrations before publishing.'), { status: 409 });
      const postBody = { author, commentary: text, visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false };
      if (post.image) {
        if (post.media_type === 'Video') {
          const videoUrn = await linkedinUploadVideo({ accessToken: credentials.accessToken, owner: author, videoUrl: post.image });
          postBody.content = { media: { title: post.title || 'Social post video', id: videoUrn } };
        } else if (post.media_type === 'Image' || post.media_type === 'Logo') {
          const imageUrn = await linkedinUploadImage({ accessToken: credentials.accessToken, owner: author, imageUrl: post.image });
          postBody.content = { media: { title: post.title || 'Social post image', id: imageUrn, altText: post.title || '' } };
        } else throw Object.assign(new Error('Select a saved image or video from this business media library.'), { status: 422 });
      } else if (post.format !== 'Text') throw Object.assign(new Error('This LinkedIn post format requires an uploaded image or video.'), { status: 422 });
      result = await apiJson('https://api.linkedin.com/rest/posts', { method: 'POST', headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Type': 'application/json', 'LinkedIn-Version': LINKEDIN_VERSION, 'X-Restli-Protocol-Version': '2.0.0' }, body: JSON.stringify(postBody) });
      result.id ||= result._providerId || '';
    } else throw Object.assign(new Error('Unsupported platform.'), { status: 400 });
    const providerId = String(result.post_id || result.id || result._providerId || '');
    if (!providerId) throw new Error('Provider accepted the request without returning a post ID; the app cannot confirm publication.');
    let providerUrl = '';
    if (post.platform === 'LinkedIn') providerUrl = `https://www.linkedin.com/feed/update/${providerId}/`;
    else if (post.platform === 'Facebook') {
      try { const details = await apiJson(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(providerId)}?fields=permalink_url&access_token=${encodeURIComponent(credentials.accessToken)}`); providerUrl = String(details.permalink_url || ''); } catch {}
    } else if (post.platform === 'Instagram') {
      try { const details = await apiJson(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(providerId)}?fields=permalink&access_token=${encodeURIComponent(credentials.accessToken)}`); providerUrl = String(details.permalink || ''); } catch {}
    }
    const { rows } = await pool.query("UPDATE posts SET status='Published',provider_post_id=$1,provider_post_url=$2,provider_deleted_at=NULL,provider_account_id=$4,published_at=now(),last_publish_error='',history=history||$3::jsonb,updated_at=now() WHERE id=$5 RETURNING *", [providerId, providerUrl, JSON.stringify([{ action: 'Published', date: new Date().toISOString() }]), account.id, post.id]);
    await pool.query("UPDATE social_accounts SET last_error='' WHERE id=$1", [account.id]).catch(() => {});
    return rows[0];
  } catch (error) {
    const attempt = Number(post.publish_attempts || 0) + 1;
    const message = String(error.message || 'Publishing failed.').slice(0, 1000);
    const retryable = [408, 425, 429].includes(Number(error.status)) || Number(error.status) >= 500 || /timeout|timed out|fetch failed|econnreset|socket hang up|temporarily unavailable/i.test(message);
    const willRetry = retryable && attempt < 3;
    const delayMs = attempt === 1 ? 60_000 : 5 * 60_000;
    const retryAt = willRetry ? new Date(Date.now() + delayMs) : null;
    const savedMessage = willRetry ? `${message} Automatic retry ${attempt + 1} of 3 scheduled for ${retryAt.toISOString()}.` : message;
    const historyEntry = { action: willRetry ? `Publish attempt ${attempt} failed; retry scheduled` : 'Publish failed', date: new Date().toISOString(), comment: savedMessage.slice(0, 300) };
    await pool.query("UPDATE posts SET status=$1,scheduled_at=COALESCE($2,scheduled_at),last_publish_error=$3,history=history||$4::jsonb,updated_at=now() WHERE id=$5", [willRetry ? 'Scheduled' : 'Failed', retryAt, savedMessage, JSON.stringify([historyEntry]), post.id]).catch(() => {});
    await pool.query('UPDATE social_accounts SET last_error=$1 WHERE id=$2', [savedMessage, account.id]).catch(() => {});
    throw error;
  }
}

async function publishDue(pool, options) {
  const due = await pool.query("SELECT p.id FROM posts p WHERE p.status='Scheduled' AND p.scheduled_at<=now() AND EXISTS (SELECT 1 FROM social_accounts a WHERE a.platform=p.platform AND a.business_id=p.business_id AND a.status='Connected') ORDER BY p.scheduled_at LIMIT 10").catch(() => ({ rows: [] }));
  for (const row of due.rows) await publishById(pool, row.id, options).catch(() => {});
}

