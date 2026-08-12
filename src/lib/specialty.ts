/** Maps a case's condition category to a hospital specialty tag (deterministic keyword map). */
export function specialtyFor(text: string): string {
  const t = text.toLowerCase();
  const map: Array<[string, string[]]> = [
    ["Cardiology", ["chest pain", "palpitation", "heart", "cardiac"]],
    ["Pulmonology", ["breath", "breathing", "cough", "wheeze", "spo2", "oxygen", "asthma", "respirat"]],
    ["Pediatrics", ["child", "infant", "baby", "newborn"]],
    ["Obstetrics", ["pregnan", "labour", "labor", "postnatal"]],
    ["Orthopaedics", ["fracture", "bone", "sprain", "joint", "fall"]],
    ["Dermatology", ["rash", "wound", "burn", "skin", "boil", "ulcer"]],
    ["ENT", ["ear", "throat", "sinus", "nose"]],
    ["Emergency", ["unconscious", "seizure", "bleeding", "accident", "trauma"]],
  ];
  for (const [tag, keys] of map) if (keys.some((k) => t.includes(k))) return tag;
  return "General Medicine";
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Sample village coordinates used as the clinic origin for the MVP. */
export const CLINIC_ORIGIN = { lat: 26.8467, lng: 80.9462 };
