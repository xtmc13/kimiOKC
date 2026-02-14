/**
 * 币种搜索组件
 * 支持搜索100+交易对和自定义输入
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Star, TrendingUp, X, ChevronDown, Plus } from 'lucide-react';

interface CoinSearchProps {
  value: string;
  onChange: (symbol: string) => void;
}

// 完整交易对列表 (100+)
const ALL_PAIRS = [
  // 主流币
  { symbol: 'BTCUSDT', name: 'Bitcoin', category: 'major' },
  { symbol: 'ETHUSDT', name: 'Ethereum', category: 'major' },
  { symbol: 'BNBUSDT', name: 'BNB', category: 'major' },
  { symbol: 'XRPUSDT', name: 'Ripple', category: 'major' },
  { symbol: 'ADAUSDT', name: 'Cardano', category: 'major' },
  { symbol: 'SOLUSDT', name: 'Solana', category: 'layer1' },
  { symbol: 'DOTUSDT', name: 'Polkadot', category: 'layer1' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', category: 'meme' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', category: 'layer1' },
  { symbol: 'SHIBUSDT', name: 'Shiba Inu', category: 'meme' },
  { symbol: 'MATICUSDT', name: 'Polygon', category: 'layer2' },
  { symbol: 'LTCUSDT', name: 'Litecoin', category: 'major' },
  { symbol: 'TRXUSDT', name: 'TRON', category: 'layer1' },
  { symbol: 'LINKUSDT', name: 'Chainlink', category: 'defi' },
  { symbol: 'ATOMUSDT', name: 'Cosmos', category: 'layer1' },
  { symbol: 'UNIUSDT', name: 'Uniswap', category: 'defi' },
  { symbol: 'ETCUSDT', name: 'Ethereum Classic', category: 'major' },
  { symbol: 'XLMUSDT', name: 'Stellar', category: 'major' },
  { symbol: 'BCHUSDT', name: 'Bitcoin Cash', category: 'major' },
  { symbol: 'NEARUSDT', name: 'NEAR Protocol', category: 'layer1' },
  // Layer 1
  { symbol: 'APTUSDT', name: 'Aptos', category: 'layer1' },
  { symbol: 'SUIUSDT', name: 'Sui', category: 'layer1' },
  { symbol: 'SEIUSDT', name: 'Sei', category: 'layer1' },
  { symbol: 'INJUSDT', name: 'Injective', category: 'layer1' },
  { symbol: 'TIAUSDT', name: 'Celestia', category: 'layer1' },
  { symbol: 'KASUSDT', name: 'Kaspa', category: 'layer1' },
  { symbol: 'ICPUSDT', name: 'Internet Computer', category: 'layer1' },
  { symbol: 'FILUSDT', name: 'Filecoin', category: 'layer1' },
  { symbol: 'HBARUSDT', name: 'Hedera', category: 'layer1' },
  { symbol: 'VETUSDT', name: 'VeChain', category: 'layer1' },
  { symbol: 'ALGOUSDT', name: 'Algorand', category: 'layer1' },
  { symbol: 'QNTUSDT', name: 'Quant', category: 'layer1' },
  { symbol: 'EOSUSDT', name: 'EOS', category: 'layer1' },
  { symbol: 'FTMUSDT', name: 'Fantom', category: 'layer1' },
  { symbol: 'SANDUSDT', name: 'The Sandbox', category: 'metaverse' },
  { symbol: 'MANAUSDT', name: 'Decentraland', category: 'metaverse' },
  { symbol: 'AXSUSDT', name: 'Axie Infinity', category: 'gaming' },
  { symbol: 'THETAUSDT', name: 'Theta Network', category: 'layer1' },
  { symbol: 'EGLDUSDT', name: 'MultiversX', category: 'layer1' },
  { symbol: 'XTZUSDT', name: 'Tezos', category: 'layer1' },
  // Layer 2
  { symbol: 'ARBUSDT', name: 'Arbitrum', category: 'layer2' },
  { symbol: 'OPUSDT', name: 'Optimism', category: 'layer2' },
  { symbol: 'STRKUSDT', name: 'Starknet', category: 'layer2' },
  { symbol: 'ZKUSDT', name: 'zkSync', category: 'layer2' },
  { symbol: 'METISUSDT', name: 'Metis', category: 'layer2' },
  { symbol: 'IMXUSDT', name: 'Immutable X', category: 'layer2' },
  { symbol: 'LRCUSDT', name: 'Loopring', category: 'layer2' },
  // DeFi
  { symbol: 'AAVEUSDT', name: 'Aave', category: 'defi' },
  { symbol: 'MKRUSDT', name: 'Maker', category: 'defi' },
  { symbol: 'CRVUSDT', name: 'Curve', category: 'defi' },
  { symbol: 'COMPUSDT', name: 'Compound', category: 'defi' },
  { symbol: 'SNXUSDT', name: 'Synthetix', category: 'defi' },
  { symbol: 'SUSHIUSDT', name: 'SushiSwap', category: 'defi' },
  { symbol: '1INCHUSDT', name: '1inch', category: 'defi' },
  { symbol: 'DYDXUSDT', name: 'dYdX', category: 'defi' },
  { symbol: 'LDOUSDT', name: 'Lido DAO', category: 'defi' },
  { symbol: 'RPLETHUSDT', name: 'Rocket Pool', category: 'defi' },
  { symbol: 'GMXUSDT', name: 'GMX', category: 'defi' },
  { symbol: 'PENDLEUSDT', name: 'Pendle', category: 'defi' },
  { symbol: 'RUNEUSDT', name: 'THORChain', category: 'defi' },
  { symbol: 'YFIUSDT', name: 'yearn.finance', category: 'defi' },
  // Meme
  { symbol: 'PEPEUSDT', name: 'Pepe', category: 'meme' },
  { symbol: 'FLOKIUSDT', name: 'Floki', category: 'meme' },
  { symbol: 'BONKUSDT', name: 'Bonk', category: 'meme' },
  { symbol: 'WIFUSDT', name: 'dogwifhat', category: 'meme' },
  { symbol: 'MEMEUSDT', name: 'Memecoin', category: 'meme' },
  { symbol: 'BOMEUSDT', name: 'BOOK OF MEME', category: 'meme' },
  { symbol: '1000SATSUSDT', name: '1000SATS', category: 'meme' },
  { symbol: 'ORDIUSDT', name: 'ORDI', category: 'meme' },
  // AI
  { symbol: 'FETUSDT', name: 'Fetch.ai', category: 'ai' },
  { symbol: 'AGIXUSDT', name: 'SingularityNET', category: 'ai' },
  { symbol: 'OCEANUSDT', name: 'Ocean Protocol', category: 'ai' },
  { symbol: 'RENDERUSDT', name: 'Render', category: 'ai' },
  { symbol: 'RLCUSDT', name: 'iExec RLC', category: 'ai' },
  { symbol: 'ARKMUSDT', name: 'Arkham', category: 'ai' },
  { symbol: 'WLDUSDT', name: 'Worldcoin', category: 'ai' },
  { symbol: 'TAOUSDT', name: 'Bittensor', category: 'ai' },
  // Gaming
  { symbol: 'GABOROUSDT', name: 'GALA', category: 'gaming' },
  { symbol: 'ILVUSDT', name: 'Illuvium', category: 'gaming' },
  { symbol: 'ENJUSDT', name: 'Enjin', category: 'gaming' },
  { symbol: 'YGGUSDT', name: 'Yield Guild', category: 'gaming' },
  { symbol: 'RONUSDT', name: 'Ronin', category: 'gaming' },
  { symbol: 'PIXELUSDT', name: 'Pixels', category: 'gaming' },
  { symbol: 'PORTALUSDT', name: 'Portal', category: 'gaming' },
  // 其他
  { symbol: 'RNDRUSDT', name: 'Render', category: 'infra' },
  { symbol: 'GRTUSDT', name: 'The Graph', category: 'infra' },
  { symbol: 'ARPAUSDT', name: 'Arweave', category: 'infra' },
  { symbol: 'STXUSDT', name: 'Stacks', category: 'infra' },
  { symbol: 'CFXUSDT', name: 'Conflux', category: 'layer1' },
  { symbol: 'FLOWUSDT', name: 'Flow', category: 'layer1' },
  { symbol: 'MINAUSDT', name: 'Mina', category: 'layer1' },
  { symbol: 'KSMUSDT', name: 'Kusama', category: 'layer1' },
  { symbol: 'ZECUSDT', name: 'Zcash', category: 'privacy' },
  { symbol: 'XMRUSDT', name: 'Monero', category: 'privacy' },
  { symbol: 'DASHUSDT', name: 'Dash', category: 'privacy' },
  { symbol: 'ROSEUSDT', name: 'Oasis', category: 'privacy' },
  { symbol: 'IOTAUSDT', name: 'IOTA', category: 'iot' },
  { symbol: 'ZILUSDT', name: 'Zilliqa', category: 'layer1' },
  { symbol: 'ENAUSDT', name: 'Ethena', category: 'defi' },
  { symbol: 'JUPUSDT', name: 'Jupiter', category: 'defi' },
  { symbol: 'PYTHUSDT', name: 'Pyth Network', category: 'infra' },
  { symbol: 'JTOUSDT', name: 'Jito', category: 'defi' },
  { symbol: 'WUSDT', name: 'Wormhole', category: 'infra' },
  { symbol: 'TONUSDT', name: 'Toncoin', category: 'layer1' },
  { symbol: 'NOTUSDT', name: 'Notcoin', category: 'meme' },
];

// 分类
const CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'favorites', label: '收藏' },
  { key: 'major', label: '主流' },
  { key: 'layer1', label: 'L1' },
  { key: 'layer2', label: 'L2' },
  { key: 'defi', label: 'DeFi' },
  { key: 'meme', label: 'Meme' },
  { key: 'ai', label: 'AI' },
  { key: 'gaming', label: '游戏' },
];

export default function CoinSearch({ value, onChange }: CoinSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('favorite_coins');
      return saved ? JSON.parse(saved) : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    } catch {
      return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    }
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 保存收藏
  useEffect(() => {
    localStorage.setItem('favorite_coins', JSON.stringify(favorites));
  }, [favorites]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 过滤交易对
  const filteredPairs = useMemo(() => {
    return ALL_PAIRS.filter(pair => {
      // 搜索过滤
      if (searchQuery) {
        const query = searchQuery.toUpperCase().trim();
        return pair.symbol.includes(query) || pair.name.toUpperCase().includes(query);
      }
      // 分类过滤
      if (category === 'favorites') return favorites.includes(pair.symbol);
      if (category === 'all') return true;
      return pair.category === category;
    });
  }, [searchQuery, category, favorites]);

  // 检查搜索是否可以作为自定义交易对
  const canAddCustom = useMemo(() => {
    if (!searchQuery) return false;
    const query = searchQuery.toUpperCase().trim();
    // 必须以USDT结尾或可以自动补全
    const symbol = query.endsWith('USDT') ? query : query + 'USDT';
    // 检查是否已存在
    return symbol.length >= 6 && !ALL_PAIRS.some(p => p.symbol === symbol);
  }, [searchQuery]);

  const toggleFavorite = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const selectCoin = (symbol: string) => {
    onChange(symbol);
    setIsOpen(false);
    setSearchQuery('');
  };

  const addCustomCoin = () => {
    const query = searchQuery.toUpperCase().trim();
    const symbol = query.endsWith('USDT') ? query : query + 'USDT';
    selectCoin(symbol);
  };

  const currentPair = ALL_PAIRS.find(p => p.symbol === value) || { 
    symbol: value, 
    name: value.replace('USDT', ''), 
    category: 'custom' 
  };

  const getIcon = (symbol: string) => {
    return symbol.replace('USDT', '').charAt(0);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg transition-all shadow-sm"
      >
        <span className="w-7 h-7 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
          {getIcon(value)}
        </span>
        <div className="text-left">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">{value.replace('USDT', '/USDT')}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">{currentPair.name}</div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-96 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* 搜索框 */}
          <div className="p-3 border-b border-gray-200 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索币种 (如: BTC, ETH, SOL...)"
                className="w-full pl-9 pr-8 py-2.5 bg-gray-100 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* 自定义交易对提示 */}
            {canAddCustom && (
              <button
                onClick={addCustomCoin}
                className="mt-2 w-full flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all"
              >
                <Plus className="w-4 h-4" />
                添加自定义交易对: {searchQuery.toUpperCase().trim()}{!searchQuery.toUpperCase().endsWith('USDT') && 'USDT'}
              </button>
            )}
          </div>

          {/* 分类标签 */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-700 flex gap-1 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-all ${
                  category === cat.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                }`}
              >
                {cat.key === 'favorites' && <Star className="w-3 h-3 inline mr-1" />}
                {cat.label}
              </button>
            ))}
          </div>

          {/* 交易对列表 */}
          <div className="max-h-72 overflow-y-auto">
            {filteredPairs.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-slate-500 text-sm">
                <div className="mb-2">没有找到匹配的交易对</div>
                {searchQuery && (
                  <div className="text-xs text-gray-400">
                    提示: 可以直接输入交易对符号添加
                  </div>
                )}
              </div>
            ) : (
              filteredPairs.map(pair => (
                <button
                  key={pair.symbol}
                  onClick={() => selectCoin(pair.symbol)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all border-b border-gray-100 dark:border-slate-700/50 last:border-0 ${
                    value === pair.symbol ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <span className="w-8 h-8 bg-gradient-to-br from-gray-500 to-gray-600 dark:from-slate-500 dark:to-slate-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                    {getIcon(pair.symbol)}
                  </span>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{pair.symbol.replace('USDT', '/USDT')}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">{pair.name}</div>
                  </div>
                  <span className="px-1.5 py-0.5 text-[10px] bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded">
                    {pair.category}
                  </span>
                  <button
                    onClick={(e) => toggleFavorite(pair.symbol, e)}
                    className={`p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 transition-all ${
                      favorites.includes(pair.symbol) ? 'text-yellow-500' : 'text-gray-400 dark:text-slate-500'
                    }`}
                  >
                    <Star className="w-4 h-4" fill={favorites.includes(pair.symbol) ? 'currentColor' : 'none'} />
                  </button>
                  {value === pair.symbol && (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* 底部统计 */}
          <div className="px-3 py-2 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 text-xs text-gray-500 dark:text-slate-500 flex justify-between">
            <span>共 {ALL_PAIRS.length} 个交易对</span>
            <span>显示 {filteredPairs.length} 个</span>
          </div>
        </div>
      )}
    </div>
  );
}
