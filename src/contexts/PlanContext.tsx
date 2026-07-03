import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchShopPlanState } from '../lib/planService'
import { SHOP_ID } from '../lib/supabase'
import { SHOP_UPDATED_EVENT } from '../lib/shopLogo'
import {
  canAccessFeature,
  requiredPlanForFeature,
  PLAN_LABELS,
  type PlanFeature,
  type ShopPlan,
  type ShopPlanState,
} from '../types/plan'

export interface PlanContextValue extends ShopPlanState {
  loading: boolean
  can: (feature: PlanFeature) => boolean
  requiredPlan: (feature: PlanFeature) => ShopPlan
  planLabel: string
  reload: () => Promise<void>
}

const PlanContext = createContext<PlanContextValue | null>(null)

export function PlanProvider({ shopId = SHOP_ID, children }: { shopId?: string; children: ReactNode }) {
  const [state, setState] = useState<ShopPlanState>({
    plan: 'starter',
    addonStripe: false,
    addonSms: false,
    addonWebsite: false,
    addonReports: false,
    featureOverrides: {},
    smsEnabled: false,
    smsPackage: 'none',
  })
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const planState = await fetchShopPlanState(shopId)
    setState(planState)
  }, [shopId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchShopPlanState(shopId).then(planState => {
      if (cancelled) return
      setState(planState)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [shopId])

  useEffect(() => {
    const onUpdated = () => {
      void reload()
    }
    window.addEventListener(SHOP_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(SHOP_UPDATED_EVENT, onUpdated)
  }, [reload])

  const value = useMemo<PlanContextValue>(() => {
    const can = (feature: PlanFeature) => canAccessFeature(state, feature)
    return {
      ...state,
      loading,
      can,
      requiredPlan: (feature: PlanFeature) => requiredPlanForFeature(feature, state),
      planLabel: PLAN_LABELS[state.plan],
      reload,
    }
  }, [state, loading, reload])

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext)
  if (!ctx) {
    throw new Error('usePlan must be used within PlanProvider')
  }
  return ctx
}
