/**
 * XTMC 币种搜索组件
 */

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Star } from 'lucide-react';

interface CoinSearchProps {
  value: string;
  onChange: (symbol: string) => void;
}

const POPULAR_COINS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', price: 0 },
  { symbol: 'ETHUSDT', name: 'Ethereum', price: 0 },
  { symbol: 'BNBUSDT', name: 'BNB', price: 0 },
  { symbol: 'SOLUSDT', name: 'Solana', price: 0 },
  { symbol: 'XRPUSDT', name: 'XRP', price: 0 },
  { symbol: 'ADAUSDT', name: 'Cardano', price: 0 },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', price: 0 },
  { symbol: 'AVAXUSDT', name: 'Avalanche', price: 0 },
  { symbol: 'DOTUSDT', name: 'Polkadot', price: 0 },
  { symbol: 'MATICUSDT', name: 'Polygon', price: 0 },
  { symbol: 'LINKUSDT', name: 'Chainlink', price: 0 },
  { symbol: 'ATOMUSDT', name: 'Cosmos', price: 0 },
  { symbol: 'LTCUSDT', name: 'Litecoin', price: 0 },
  { symbol: 'UNIUSDT', name: 'Uniswap', price: 0 },
  { symbol: 'APTUSDT', name: 'Aptos', price: 0 },
  { symbol: 'ARBUSDT', name: 'Arbitrum', price: 0 },
  { symbol: 'OPUSDT', name: 'Optimism', price: 0 },
  { symbol: 'FILUSDT', name: 'Filecoin', price: 0 },
  { symbol: 'NEARUSDT', name: 'NEAR Protocol', price: 0 },
  { symbol: 'AAVEUSDT', name: 'Aave', price: 0 },
];

export default function CoinSearch({ value, onChange }: CoinSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('xtmc_fav_coins') || '[]');
    } catch { return []; }
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFavorite = (symbol: string) => {
    const newFavs = favorites.includes(symbol)
      ? favorites.filter(f => f !== symbol)
      : [...favorites, symbol];
    setFavorites(newFavs);
    localStorage.setItem('xtmc_fav_coins', JSON.stringify(newFavs));
  };

  const filtered = POPULAR_COINS.filter(c =>
    c.symbol.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const favCoins = filtered.filter(c => favorites.includes(c.symbol));
  const otherCoins = filtered.filter(c => !favorites.includes(c.symbol));

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
      >
        <span className="text-sm font-bold text-gray-900 dark:text-white">{value}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* 搜索 */}
          <div className="p-2 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-slate-700/50 rounded-lg">
              <Search className="w-4 h-4 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索交易对..."
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none"
                autoFocus
              />
            </div>
          </div>

          {/* 列表 */}
          <div className="max-h-[300px] overflow-y-auto">
            {favCoins.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase">收藏</div>
                {favCoins.map(coin => (
                  <CoinItem
                    key={coin.symbol}
                    coin={coin}
                    isActive={coin.symbol === value}
                    isFavorite={true}
                    onSelect={() => { onChange(coin.symbol); setIsOpen(false); }}
                    onToggleFavorite={() => toggleFavorite(coin.symbol)}
                  />
                ))}
              </>
            )}
            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase">全部</div>
            {otherCoins.map(coin => (
              <CoinItem
                key={coin.symbol}
                coin={coin}
                isActive={coin.symbol === value}
                isFavorite={false}
                onSelect={() => { onChange(coin.symbol); setIsOpen(false); }}
                onToggleFavorite={() => toggleFavorite(coin.symbol)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-400 dark:text-slate-500">无匹配结果</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CoinItem({ coin, isActive, isFavorite, onSelect, onToggleFavorite }: {
  coin: { symbol: string; name: string };
  isActive: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/20'
          : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className="text-gray-300 dark:text-slate-600 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors"
        >
          <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        </button>
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">{coin.symbol}</div>
          <div className="text-[10px] text-gray-400 dark:text-slate-500">{coin.name}</div>
        </div>
      </div>
    </div>
  );
}
