/**
 * Shop domain map for edge middleware and client — backed by src/config/shopRegistry.ts.
 * shops.config.json is kept in sync via scripts/validate-shops.ts (prebuild).
 */
import {
  buildRegistryDomainMap,
  getShopsConfigFromRegistry,
  type ShopRegistryEntry,
  type ShopsConfigFile,
} from '../src/config/shopRegistry'

export type ShopConfigEntry = ShopRegistryEntry

export { type ShopsConfigFile }

export function getShopsConfigFile(): ShopsConfigFile {
  return getShopsConfigFromRegistry()
}

/** Flat hostname → shopSlug map from SHOP_REGISTRY */
export function getBaseShopDomainMap(config: ShopsConfigFile = getShopsConfigFile()): Record<string, string> {
  return buildRegistryDomainMap(config.shops)
}

/** All configured hostnames (normalized), for build-time Vercel domain checks */
export function getConfiguredShopHostnames(config: ShopsConfigFile = getShopsConfigFile()): Set<string> {
  return new Set(Object.keys(getBaseShopDomainMap(config)))
}
