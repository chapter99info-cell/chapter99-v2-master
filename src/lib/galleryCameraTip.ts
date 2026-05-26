/** Thai tip from EXIF-style settings string (e.g. "f/8 · ISO 3200 · 15s") */

const DEFAULT_TIP = 'ลองถ่ายหลายช็อต แล้วเลือกภาพที่แสงและอารมณ์ชัดที่สุด'

function parseShutterSeconds(settings: string): number | null {
  const frac = settings.match(/(\d+)\s*\/\s*(\d+)\s*s/i)
  if (frac) {
    const denom = Number(frac[2])
    if (denom > 0) return Number(frac[1]) / denom
  }
  const sec = settings.match(/(\d+(?:\.\d+)?)\s*s\b/i)
  if (sec) return Number(sec[1])
  return null
}

function parseIso(settings: string): number | null {
  const m = settings.match(/ISO\s*(\d+)/i)
  return m ? Number(m[1]) : null
}

function parseFStop(settings: string): number | null {
  const m = settings.match(/f\s*\/\s*([\d.]+)/i)
  return m ? Number(m[1]) : null
}

export function getCameraTipFromSettings(settings: string): string {
  if (!settings?.trim()) return DEFAULT_TIP

  const shutter = parseShutterSeconds(settings)
  if (shutter != null && shutter >= 10) {
    return 'ใช้ Tripod + ชัตเตอร์ช้า เก็บแสงได้นุ่มนวล'
  }

  const iso = parseIso(settings)
  if (iso != null && iso >= 1600) {
    return 'ถ่ายกลางคืน ISO สูง ดึงแสงดาวออกมา'
  }

  const fStop = parseFStop(settings)
  if (fStop != null && fStop >= 8) {
    return 'Depth of field กว้าง ทุกอย่างคมชัด'
  }

  return DEFAULT_TIP
}

export const TRIP2TALK_FACEBOOK_URL = 'https://www.facebook.com/TriptoTalk'
