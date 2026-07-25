/**
 * @deprecated Old TV Signage staff manager (tv_playlist_items).
 * Staff dashboard now uses DigitalSignageStaffPanel → /admin/signage-manager/:shopId.
 *
 * TODO: Reconnect "Generate AI Banner" / Claude copy pipeline here or in
 * SignageManager — generate a static banner image, upload to Supabase Storage,
 * then call admin_upsert_signage_asset. Do not revive tv_playlist_items / kiosk_content.
 */

export { default } from './DigitalSignageStaffPanel'
