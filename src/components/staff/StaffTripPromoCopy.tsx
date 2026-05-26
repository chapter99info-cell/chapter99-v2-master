import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Tour } from '../../types/tour'
import {
  buildPhotoTripPromoFromTour,
  buildScarcityTripPromoFromTour,
  buildTripPromoFromTour,
  tourSeatsLeft,
} from '../../lib/tripPromoCaption'

type PromoTemplate = 'classic' | 'photo' | 'scarcity'

interface StaffTripPromoCopyProps {
  tour: Tour
}

export default function StaffTripPromoCopy({ tour }: StaffTripPromoCopyProps) {
  const [template, setTemplate] = useState<PromoTemplate>('photo')
  const [emotionalHook, setEmotionalHook] = useState('')
  const [location, setLocation] = useState('')
  const [region, setRegion] = useState('')
  const [tripLabel, setTripLabel] = useState('')
  const [seatsOverride, setSeatsOverride] = useState('')
  const [description, setDescription] = useState('')
  const [route, setRoute] = useState('')
  const [dayHighlights, setDayHighlights] = useState('')
  const [copied, setCopied] = useState(false)

  const seatsComputed = tourSeatsLeft(tour)

  useEffect(() => {
    setEmotionalHook('')
    setLocation('')
    setRegion('')
    setTripLabel('')
    setSeatsOverride('')
    setDescription('')
    setRoute('')
    setDayHighlights('')
    setCopied(false)
    if (tour.destination === 'Sydney' || tour.trip_code.toUpperCase().includes('MEL')) {
      setTemplate('photo')
    } else {
      setTemplate('classic')
    }
  }, [tour.id, tour.destination, tour.trip_code])

  const promoText = useMemo(() => {
    const hook = emotionalHook.trim() || undefined
    const loc = location.trim() || undefined
    const seatsParsed = seatsOverride.trim()
    const seatsLeft = seatsParsed ? Math.max(0, parseInt(seatsParsed, 10) || 0) : undefined

    if (template === 'scarcity') {
      return buildScarcityTripPromoFromTour(tour, {
        feelingLine: hook,
        location: loc,
        regionLabel: region.trim() || undefined,
        tripLabel: tripLabel.trim() || undefined,
        seatsLeft,
      })
    }

    if (template === 'photo') {
      return buildPhotoTripPromoFromTour(tour, {
        hook,
        location: loc,
        route: route.trim() || undefined,
        description: description.trim() || undefined,
        dayHighlights: dayHighlights.trim() || undefined,
      })
    }

    return buildTripPromoFromTour(tour, {
      emotionalHook: hook,
      location: loc,
    })
  }, [
    tour,
    template,
    emotionalHook,
    location,
    region,
    tripLabel,
    seatsOverride,
    description,
    route,
    dayHighlights,
  ])

  const copyPromo = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(promoText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy trip promo:', promoText)
    }
  }, [promoText])

  const textareaRows =
    template === 'photo' ? 18 : template === 'scarcity' ? 6 : 14

  return (
    <div className="staff-terminal__panel p-4 border-amber-500/25">
      <p className="staff-terminal__th text-amber-400 mb-1">FB / IG TRIP PROMO</p>
      <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
        เลือกรูปแบบโพสต์ → แก้ข้อความ → copy ไปโพสต์
      </p>

      <div className="flex gap-1 mb-3 p-0.5 rounded-lg bg-neutral-950 border border-neutral-800">
        {(
          [
            ['photo', 'Photo route'],
            ['scarcity', 'Seats left'],
            ['classic', 'Classic'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTemplate(id)}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition ${
              template === id
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'text-neutral-500 border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 mb-3">
        <label className="block text-xs sm:col-span-2">
          <span className="text-neutral-500">
            {template === 'scarcity' ? 'One line feeling' : 'Hook — ความรู้สึก 1 ประโยค'}
          </span>
          <input
            type="text"
            value={emotionalHook}
            onChange={(e) => setEmotionalHook(e.target.value)}
            placeholder="คำพูดติดหู…"
            className="mt-1 w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-neutral-200"
          />
        </label>
        <label className="block text-xs">
          <span className="text-neutral-500">Location</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={
              template === 'scarcity'
                ? 'Melbourne'
                : template === 'photo'
                  ? 'Twelve Apostles'
                  : tour.destination
            }
            className="mt-1 w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-neutral-200"
          />
        </label>
        {template === 'scarcity' && (
          <>
            <label className="block text-xs">
              <span className="text-neutral-500">Region</span>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Victoria"
                className="mt-1 w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-neutral-200"
              />
            </label>
            <label className="block text-xs">
              <span className="text-neutral-500">Trip name</span>
              <input
                type="text"
                value={tripLabel}
                onChange={(e) => setTripLabel(e.target.value)}
                placeholder="Melbourne Trip"
                className="mt-1 w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-neutral-200"
              />
            </label>
            <label className="block text-xs">
              <span className="text-neutral-500">
                Seats left (ว่าง {seatsComputed} จาก DB)
              </span>
              <input
                type="number"
                min={0}
                value={seatsOverride}
                onChange={(e) => setSeatsOverride(e.target.value)}
                placeholder={String(seatsComputed)}
                className="mt-1 w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-neutral-200 font-mono"
              />
            </label>
          </>
        )}
        {template === 'photo' && (
          <label className="block text-xs">
            <span className="text-neutral-500">Route</span>
            <input
              type="text"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              placeholder="Sydney → Melbourne"
              className="mt-1 w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-neutral-200"
            />
          </label>
        )}
      </div>

      {template === 'photo' && (
        <div className="grid gap-2 mb-3">
          <label className="block text-xs">
            <span className="text-neutral-500">Description (2–3 ประโยค)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="เล่าความรู้สึก + จุดขาย…"
              className="mt-1 w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-neutral-200 resize-none"
            />
          </label>
          <label className="block text-xs">
            <span className="text-neutral-500">Day-by-day highlights</span>
            <textarea
              value={dayHighlights}
              onChange={(e) => setDayHighlights(e.target.value)}
              rows={4}
              placeholder={'Day 1 · …\nDay 2 · …'}
              className="mt-1 w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm text-neutral-200 resize-none font-mono"
            />
          </label>
        </div>
      )}

      <textarea
        readOnly
        value={promoText}
        rows={textareaRows}
        className="w-full text-xs font-mono bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-neutral-300 resize-none leading-relaxed"
      />
      <button
        type="button"
        onClick={() => void copyPromo()}
        className="mt-2 w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wide bg-amber-500/15 text-amber-400 border border-amber-500/40"
      >
        {copied ? 'Copied ✓' : 'Copy trip promo for FB / IG'}
      </button>
    </div>
  )
}
