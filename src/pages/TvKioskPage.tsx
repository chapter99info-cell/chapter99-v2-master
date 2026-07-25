/**
 * @deprecated Legacy TV kiosk display — route now redirects via TvToSignageRedirect.
 * Kept as a thin re-export so any deep imports do not break the build.
 *
 * TODO: Reconnect "Generate AI Banner" (Claude → canvas → Storage →
 * admin_upsert_signage_asset) against signage_assets when product wants it.
 */
export { default } from './signage/TvToSignageRedirect'
