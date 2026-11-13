import React, { useState } from 'react';
import { Cloud, CloudRain, Droplets, MapPin, Plus, Sun, Wind } from 'lucide-react';

interface CityWeather {
  city: string;
  tempF: number;
  condition: 'Sunny' | 'Partly Cloudy' | 'Cloudy' | 'Light Rain';
  humidity: number;
  windMph: number;
  uv: number;
  hourlyF: number[];
  week: Array<{ day: string; hi: number; lo: number; cond: 'Sunny' | 'Partly Cloudy' | 'Cloudy' | 'Light Rain' }>;
}

const DEFAULT_CITIES: CityWeather[] = [
  {
    city: 'San Francisco',
    tempF: 68,
    condition: 'Partly Cloudy',
    humidity: 62,
    windMph: 12,
    uv: 5,
    hourlyF: [61, 63, 66, 68, 67, 64, 60, 57],
    week: [
      { day: 'Today', hi: 68, lo: 54, cond: 'Partly Cloudy' },
      { day: 'Sat', hi: 70, lo: 55, cond: 'Sunny' },
      { day: 'Sun', hi: 72, lo: 56, cond: 'Sunny' },
      { day: 'Mon', hi: 65, lo: 53, cond: 'Cloudy' },
      { day: 'Tue', hi: 63, lo: 52, cond: 'Light Rain' },
      { day: 'Wed', hi: 67, lo: 54, cond: 'Partly Cloudy' },
      { day: 'Thu', hi: 71, lo: 55, cond: 'Sunny' },
    ],
  },
  {
    city: 'New York',
    tempF: 54,
    condition: 'Sunny',
    humidity: 48,
    windMph: 9,
    uv: 4,
    hourlyF: [48, 50, 52, 54, 53, 50, 46, 44],
    week: [
      { day: 'Today', hi: 54, lo: 41, cond: 'Sunny' },
      { day: 'Sat', hi: 58, lo: 43, cond: 'Partly Cloudy' },
      { day: 'Sun', hi: 52, lo: 40, cond: 'Light Rain' },
      { day: 'Mon', hi: 55, lo: 42, cond: 'Sunny' },
      { day: 'Tue', hi: 59, lo: 45, cond: 'Sunny' },
      { day: 'Wed', hi: 57, lo: 44, cond: 'Cloudy' },
      { day: 'Thu', hi: 53, lo: 41, cond: 'Partly Cloudy' },
    ],
  },
  {
    city: 'Tokyo',
    tempF: 61,
    condition: 'Light Rain',
    humidity: 76,
    windMph: 7,
    uv: 2,
    hourlyF: [58, 59, 60, 61, 60, 58, 56, 55],
    week: [
      { day: 'Today', hi: 61, lo: 51, cond: 'Light Rain' },
      { day: 'Sat', hi: 64, lo: 50, cond: 'Partly Cloudy' },
      { day: 'Sun', hi: 67, lo: 52, cond: 'Sunny' },
      { day: 'Mon', hi: 66, lo: 53, cond: 'Sunny' },
      { day: 'Tue', hi: 62, lo: 50, cond: 'Cloudy' },
      { day: 'Wed', hi: 63, lo: 51, cond: 'Partly Cloudy' },
      { day: 'Thu', hi: 65, lo: 52, cond: 'Sunny' },
    ],
  },
];

function generateDeterministicCity(name: string): CityWeather {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 1000;
  const base = 48 + (hash % 36);
  const conds: CityWeather['condition'][] = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain'];
  const cond = conds[hash % conds.length];
  return {
    city: name,
    tempF: base,
    condition: cond,
    humidity: 42 + (hash % 40),
    windMph: 4 + (hash % 15),
    uv: 2 + (hash % 7),
    hourlyF: [-5, -3, -1, 0, -1, -3, -6, -8].map((d) => base + d),
    week: ['Today', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'].map((day, idx) => ({
      day,
      hi: base + ((idx * 3 + hash) % 7) - 3,
      lo: base - 12 + ((idx + hash) % 5),
      cond: conds[(hash + idx) % conds.length],
    })),
  };
}

export const WeatherApp: React.FC = () => {
  const [cities, setCities] = useState<CityWeather[]>(DEFAULT_CITIES);
  const [activeCity, setActiveCity] = useState(DEFAULT_CITIES[0].city);
  const [unit, setUnit] = useState<'F' | 'C'>('F');
  const [newCity, setNewCity] = useState('');

  const cur = cities.find((c) => c.city === activeCity) || cities[0];
  const fmt = (f: number) => (unit === 'F' ? `${f}°` : `${Math.round(((f - 32) * 5) / 9)}°`);

  const renderIcon = (cond: CityWeather['condition'], cls = 'w-5 h-5') => {
    if (cond === 'Sunny') return <Sun className={`${cls} text-amber-300`} />;
    if (cond === 'Light Rain') return <CloudRain className={`${cls} text-sky-300`} />;
    return <Cloud className={`${cls} text-slate-200`} />;
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-gradient-to-br from-[#0c4a6e] via-[#075985] to-[#0f172a] text-white">
      {/* City List Sidebar */}
      <div className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-white/15 bg-black/20 p-3 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = newCity.trim();
            if (!trimmed) return;
            if (!cities.some((c) => c.city.toLowerCase() === trimmed.toLowerCase())) {
              const generated = generateDeterministicCity(trimmed);
              setCities((prev) => [...prev, generated]);
              setActiveCity(generated.city);
            }
            setNewCity('');
          }}
          className="flex gap-1"
        >
          <input
            type="text"
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            placeholder="Add city..."
            className="flex-1 min-w-0 px-2.5 py-1 text-xs bg-white/10 border border-white/20 outline-none placeholder:text-white/50"
          />
          <button type="submit" className="p-1.5 bg-[#0078D7] hover:bg-[#106EBE] cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="flex md:flex-col gap-1.5 overflow-x-auto">
          {cities.map((c) => (
            <button
              key={c.city}
              onClick={() => setActiveCity(c.city)}
              className={`flex items-center justify-between gap-3 px-3 py-2 text-xs text-left shrink-0 cursor-pointer ${
                c.city === cur.city ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              <span className="truncate font-medium">{c.city}</span>
              <span className="tabular-nums font-semibold">{fmt(c.tempF)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Forecast */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-white/80">
              <MapPin className="w-4 h-4" />
              <span>{cur.city}</span>
            </div>
            <div className="text-6xl font-light tabular-nums mt-2">{fmt(cur.tempF)}</div>
            <div className="flex items-center gap-2 text-sm mt-1">
              {renderIcon(cur.condition, 'w-5 h-5')}
              <span>{cur.condition}</span>
            </div>
          </div>

          <div className="flex border border-white/25 text-xs">
            <button
              onClick={() => setUnit('F')}
              className={`px-3 py-1 cursor-pointer ${unit === 'F' ? 'bg-white text-slate-900 font-semibold' : ''}`}
            >
              °F
            </button>
            <button
              onClick={() => setUnit('C')}
              className={`px-3 py-1 cursor-pointer ${unit === 'C' ? 'bg-white text-slate-900 font-semibold' : ''}`}
            >
              °C
            </button>
          </div>
        </div>

        {/* Metrics Strip */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-white/10 border border-white/15">
            <div className="flex items-center gap-1.5 text-white/70">
              <Droplets className="w-3.5 h-3.5" /> Humidity
            </div>
            <div className="text-lg font-medium tabular-nums mt-1">{cur.humidity}%</div>
          </div>
          <div className="p-3 bg-white/10 border border-white/15">
            <div className="flex items-center gap-1.5 text-white/70">
              <Wind className="w-3.5 h-3.5" /> Wind
            </div>
            <div className="text-lg font-medium tabular-nums mt-1">{cur.windMph} mph</div>
          </div>
          <div className="p-3 bg-white/10 border border-white/15">
            <div className="flex items-center gap-1.5 text-white/70">
              <Sun className="w-3.5 h-3.5" /> UV Index
            </div>
            <div className="text-lg font-medium tabular-nums mt-1">{cur.uv} Moderate</div>
          </div>
        </div>

        {/* Hourly Trend */}
        <div className="p-4 bg-white/10 border border-white/15">
          <div className="text-xs font-semibold mb-3">Hourly Forecast</div>
          <div className="grid grid-cols-8 gap-2 text-center text-xs tabular-nums">
            {cur.hourlyF.map((tf, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-white/70">{(9 + i * 2) % 24}:00</span>
                {renderIcon(cur.condition, 'w-4 h-4')}
                <span className="font-medium">{fmt(tf)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 7-Day Forecast */}
        <div className="p-4 bg-white/10 border border-white/15 space-y-2">
          <div className="text-xs font-semibold mb-2">7-Day Forecast</div>
          {cur.week.map((d) => (
            <div key={d.day} className="flex items-center justify-between text-xs py-1 border-b border-white/10 last:border-b-0">
              <span className="w-16 font-medium">{d.day}</span>
              <span className="flex items-center gap-2 text-white/85">
                {renderIcon(d.cond, 'w-4 h-4')}
                <span className="hidden sm:inline">{d.cond}</span>
              </span>
              <span className="tabular-nums">
                <strong>{fmt(d.hi)}</strong> <span className="text-white/60">/ {fmt(d.lo)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
