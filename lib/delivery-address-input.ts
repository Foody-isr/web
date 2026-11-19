/** Street and municipality as the guest will see them on the order. */
export type PostalAddress = { address: string; city: string };

const house = String.raw`[0-9]{1,6}(?:[-/][0-9]{1,6})?(?:[a-zא-ת]|\s?(?:bis|ter|quater))?`;
const numberLast = new RegExp(`^(.+?)[ ,]+(${house})$`, 'iu');
const numberFirst = new RegExp(`^(${house})[ ,]+(.+)$`, 'iu');
const key = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const streetKey = (s: string) => key(s.replace(/(?:^|\s)(?:street|st\.?|rue|רחוב)(?=\s|$)/giu, ' '));
const cityAliases: Record<string, string> = {
  herzlya: 'herzliya', hertzlia: 'herzliya', herzlia: 'herzliya', hertzliya: 'herzliya', הרצליה: 'herzliya',
  guivatshmuel: 'givatshmuel', גבעתשמואל: 'givatshmuel', נתניה: 'netanya', netania: 'netanya',
  telavivyafo: 'telaviv', telavivjaffa: 'telaviv', תלאביב: 'telaviv', תלאביביפו: 'telaviv',
};
const cityKey = (s: string) => cityAliases[key(s)] ?? key(s);

function building(address: string, street?: string): string {
  for (const [pattern, nameIndex, numberIndex] of [[numberLast, 1, 2], [numberFirst, 2, 1]] as const) {
    const m = pattern.exec(address.trim());
    if (m && /\p{L}/u.test(streetKey(m[nameIndex])) && (!street || streetKey(m[nameIndex]) === streetKey(street))) return m[numberIndex];
  }
  return '';
}

/** Parses a numbered postal address from one input. Unpunctuated cities must match a known municipality. */
export function enteredPostalAddress(query: string, cities: string[] = []): PostalAddress | undefined {
  const parts = query.trim().split(/\s*,\s*/u);
  if (parts.length === 2 && building(parts[0]) && /\p{L}/u.test(parts[1])) return { address: parts[0], city: parts[1] };
  if (parts.length !== 1) return;
  const words = parts[0].split(/\s+/u);
  const municipalities = new Set(cities.map(cityKey));
  for (let i = 2; i < words.length; i++) {
    const city = words.slice(i).join(' ');
    const address = words.slice(0, i).join(' ');
    if (municipalities.has(cityKey(city)) && building(address)) return { address, city };
  }
}

/** Keeps a building from the chosen label, or from matching typed street and city, when Details omits it. */
export function postalForSelectedStreet(query: string, prediction: PostalAddress, street: string, city: string, resolvedNumber?: string): PostalAddress | undefined {
  if (!city || !street || cityKey(prediction.city) !== cityKey(city)) return;
  const selectedNumber = building(prediction.address, street);
  if (selectedNumber) return key(selectedNumber) === key(resolvedNumber ?? '') ? undefined : { address: prediction.address, city };
  if (resolvedNumber) return;
  if (streetKey(prediction.address) !== streetKey(street)) return;
  const typed = enteredPostalAddress(query, [city]);
  if (typed && cityKey(typed.city) !== cityKey(city)) return;
  const address = typed?.address ?? query.trim();
  if (building(address, street)) return { address, city };
}
