// Run against an isolated staging copy using the same S3 permissions as production.
const { TEAMOS_STAGING_URL: url, TEAMOS_STAGING_COOKIE: cookie, TEAMOS_STAGING_TEAM: team, TEAMOS_STAGING_GOAL: goal } = process.env;
if (!url || !cookie || !team || !goal) throw new Error('Set TEAMOS_STAGING_URL, TEAMOS_STAGING_COOKIE, TEAMOS_STAGING_TEAM and TEAMOS_STAGING_GOAL.');
const base = new URL(url);
if (base.protocol !== 'https:' || base.hostname === 'sb.uselinxa.com') throw new Error('Use an isolated HTTPS staging environment, not production.');
if (!/^[a-zA-Z0-9_-]{1,80}$/.test(team) || !/^[a-zA-Z0-9_-]{1,80}$/.test(goal)) throw new Error('Invalid staging team or goal ID.');
async function get(path) {
  const response = await fetch(new URL(path, base), { headers: { Cookie: cookie }, redirect: 'error', signal: AbortSignal.timeout(30000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${body.error || 'request failed'}`);
  return body;
}
const me = await get('/api/me');
const workspace = me.teams?.find((item) => item.id === team);
if (!me.user || !workspace?.orgId || !me.orgs?.some((org) => org.id === workspace.orgId)) throw new Error('Staging profile or organization migration failed.');
const state = await get(`/api/teams/${team}/state`);
if (state.team?.id !== team || !state.goals?.some((item) => item.id === goal)) throw new Error('Staging workspace or legacy goal migration failed.');
console.log('Authenticated staging profile, organization and goal checks passed.');
