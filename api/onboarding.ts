/**
 * Onboarding API handlers — used by /api/onboarding/[step] routes.
 * Requires x-admin-session header matching SUPER_ADMIN_SESSION_SECRET.
 */
export {
  onboardingHandlers,
  checkDomains,
  registerShopInRegistry,
  createShopInDb,
  triggerDeploy,
  generateShopIdFromName,
  generateShopSlug,
  type OnboardingPayload,
} from './onboardingHandlers'
