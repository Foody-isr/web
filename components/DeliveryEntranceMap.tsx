'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { CircleMarker, MapContainer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DeliveryTiles } from './DeliveryTiles';
import { findDeliveryCity } from '@/services/api';
import { useI18n } from '@/lib/i18n';

export type EntrancePoint = { lat: number; lng: number };

const labels = {
  fr: { hint: 'Zoomez sur le bâtiment, puis touchez son entrée.', locate: 'Centrer sur ma position', center: 'Choisir le centre de la carte', denied: 'Position indisponible. Déplacez et zoomez la carte.', marker: 'Entrée indiquée sur la carte' },
  en: { hint: 'Zoom in on the building, then tap its entrance.', locate: 'Centre on my location', center: 'Choose the centre of the map', denied: 'Location unavailable. Pan and zoom the map.', marker: 'Entrance marked on the map' },
  he: { hint: 'הגדילו את המפה והקישו על הכניסה לבניין.', locate: 'מרכוז לפי המיקום שלי', center: 'בחירת מרכז המפה', denied: 'המיקום אינו זמין. הזיזו והגדילו את המפה.', marker: 'הכניסה סומנה על המפה' },
};

function EntranceEvents({ restaurantId, city, enabled, onZoom, onPick }: { restaurantId: string; city: string; enabled: boolean; onZoom: (level: number) => void; onPick: (point: EntrancePoint) => void }) {
  const map = useMap();
  useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
    click: ({ latlng }) => { if (enabled) onPick({ lat: latlng.lat, lng: latlng.lng }); },
  });
  useEffect(() => {
    const controller = new AbortController();
    let interacted = false;
    const interact = () => { interacted = true; };
    map.on('movestart', interact);
    if (city.trim()) void findDeliveryCity(restaurantId, city, controller.signal).then(result => {
      if (!controller.signal.aborted && !interacted && result.found && result.lat != null && result.lng != null) map.setView([result.lat, result.lng], 14);
    }).catch(() => { /* The guest can still move the map or centre it on their device. */ });
    return () => { controller.abort(); map.off('movestart', interact); };
  }, [map, restaurantId, city]);
  return null;
}

/** Lets guests explicitly mark their entrance at building scale. */
export default function DeliveryEntranceMap({ restaurantId, city, point, onPick }: { restaurantId: string; city: string; point: EntrancePoint | null; onPick: (point: EntrancePoint) => void }) {
  const { locale } = useI18n();
  const words = labels[locale as keyof typeof labels] ?? labels.he;
  const map = useRef<LeafletMap | null>(null);
  const [tiles, setTiles] = useState('');
  const [zoom, setZoom] = useState(point ? 18 : 2);
  const [denied, setDenied] = useState(false);
  const enabled = Boolean(tiles && tiles !== 'unavailable' && zoom >= 16);
  const locate = () => {
    if (!navigator.geolocation) { setDenied(true); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (map.current) { setDenied(false); map.current.setView([coords.latitude, coords.longitude], 18); }
    }, () => { if (map.current) setDenied(true); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };
  const chooseCentre = () => {
    if (!map.current || !enabled) return;
    const { lat, lng } = map.current.getCenter();
    onPick({ lat, lng });
  };
  return <div className="space-y-2">
    <p className="text-sm">{words.hint}</p>
    <MapContainer ref={map} className="h-56 w-full rounded-lg" style={{ height: 224 }} center={point ?? [25, 18]} zoom={point ? 18 : 2} scrollWheelZoom={false}>
      <DeliveryTiles restaurantId={restaurantId} onProviderChange={setTiles} />
      <EntranceEvents restaurantId={restaurantId} city={city} enabled={enabled} onZoom={setZoom} onPick={onPick} />
      {point && <CircleMarker center={point} radius={8} pathOptions={{ color: 'white', weight: 3, fillColor: '#1b5274', fillOpacity: 1 }} />}
    </MapContainer>
    <div className="flex flex-wrap gap-x-4"><button type="button" onClick={locate} className="min-h-11 underline">{words.locate}</button>
      <button type="button" onClick={chooseCentre} disabled={!enabled} className="min-h-11 underline disabled:opacity-50">{words.center}</button></div>
    {denied && <p role="status">{words.denied}</p>}
    {point && <p role="status" className="text-sm">{words.marker}</p>}
  </div>;
}
