import React from 'react';
import { Moon, Sun, RefreshCw, X, TrendingUp, TrendingDown, ExternalLink, Users, Cpu } from 'lucide-react';

// Main App Component
const App = () => {
    // State Management
    const [isDark, setIsDark] = React.useState(true);
    const [selectedMarket, setSelectedMarket] = React.useState(null);
    const [marketData, setMarketData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [aiInsight, setAiInsight] = React.useState('');
    const [isInsightLoading, setIsInsightLoading] = React.useState(false);

    // Refs for canvas and animation
    const canvasRef = React.useRef(null);
    const animationRef = React.useRef(null);
    const bubblesRef = React.useRef([]);
    const interactionTimeoutRef = React.useRef(null);

    // Color palette for different market categories
    const categoryColors = {
        politics: '#FF6B6B', // Coral Red
        crypto: '#4D96FF',   // Bright Blue
        tech: '#42E695',     // Neon Green
        economy: '#FFD166',  // Sunglow Yellow
        sports: '#FC9F5B',   // Orange Soda
        events: '#9B5DE5',   // Lavender Purple
        earnings: '#F15BB5', // Magenta Crayola
        default: '#ced4da' // A default color for uncategorized markets
    };
    
    // --- Data Fetching and Processing ---

    // Fetches and processes data from the Polymarket API
    const fetchPolymarketData = React.useCallback(async () => {
        setLoading(true);
        try {
            // Using a CORS proxy to bypass browser restrictions for client-side fetching
            const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
            const apiUrl = 'https://gamma-api.polymarket.com/markets?limit=100&closed=false&min_liquidity=1000';
            const response = await fetch(proxyUrl + apiUrl);

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            // Initializing categories
            const categorized = {
                politics: [], crypto: [], tech: [], economy: [], 
                sports: [], events: [], earnings: []
            };

            // Processing each market from the API response
            data.data.forEach(market => {
                const marketInfo = {
                    id: market.id,
                    title: market.question,
                    odds: Math.round(parseFloat(market.outcomes[0].price) * 100),
                    volume: parseFloat(market.volume),
                    traders: parseInt(market.participant_count),
                    description: market.description,
                    url: `https://polymarket.com/event/${market.slug}`,
                    // Mocking trend data as the API doesn't provide it directly
                    trend: Math.random() > 0.5 ? 'up' : 'down',
                    change: (Math.random() * 5).toFixed(1)
                };

                const question = market.question.toLowerCase();
                const tags = market.tags.map(t => t.toLowerCase());
                
                // Categorization logic based on keywords and tags
                let assignedCategory = 'events'; // Default category
                if (tags.includes('politics') || question.includes('election') || question.includes('trump') || question.includes('biden')) assignedCategory = 'politics';
                else if (tags.includes('crypto') || question.includes('bitcoin') || question.includes('ethereum')) assignedCategory = 'crypto';
                else if (tags.includes('technology') || question.includes('ai') || question.includes('apple')) assignedCategory = 'tech';
                else if (tags.includes('finance') || tags.includes('economics') || question.includes('fed') || question.includes('recession')) assignedCategory = 'economy';
                else if (tags.includes('sports') || question.includes('nfl') || question.includes('nba')) assignedCategory = 'sports';
                else if (tags.includes('earnings') || question.includes('stock')) assignedCategory = 'earnings';
                
                if (categorized[assignedCategory].length < 10) {
                     categorized[assignedCategory].push({ ...marketInfo, category: assignedCategory });
                }
            });

            // Calculate max volume for each category for relative sizing
            const maxVolumes = {};
            Object.keys(categorized).forEach(category => {
                const volumes = categorized[category].map(m => m.volume);
                maxVolumes[category] = Math.max(...volumes, 1); // Avoid division by zero
            });
            
            setMarketData({ categorized, maxVolumes });
            setError(null);
        } catch (err) {
            console.error('Failed to fetch Polymarket data:', err);
            setError('Could not fetch live data. Please try again later.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Effect to fetch data on component mount and set an interval for updates
    React.useEffect(() => {
        fetchPolymarketData();
        const interval = setInterval(fetchPolymarketData, 60000); // Refresh every 60 seconds
        return () => clearInterval(interval);
    }, [fetchPolymarketData]);

    // --- Gemini AI Insight Generation ---
    
    const getAiInsight = async (market) => {
        if (!market) return;
        setIsInsightLoading(true);
        setAiInsight('');

        const systemPrompt = `
            You are a sharp, insightful market analyst for PolyFutures.xyz.
            Your role is to provide a concise, data-driven, and neutral insight into a prediction market.
            Analyze the provided market data and generate a short, analytical summary (2-3 sentences).
            Focus on the potential drivers behind the current odds and what factors could influence future movements.
            Do not give financial advice. Keep the tone professional but engaging.
        `;
        const userQuery = `
            Market Title: "${market.title}"
            Description: "${market.description}"
            Current Odds: ${market.odds}%
            Trading Volume: $${market.volume.toLocaleString()}
        `;
        
        try {
            const apiKey = ""; // API key will be injected by the environment
            const apiUrl = `https://generativelace.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

            const payload = {
                contents: [{ parts: [{ text: userQuery }] }],
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                setAiInsight(text);
            } else {
                throw new Error("No content in Gemini response.");
            }
        } catch (error) {
            console.error("Error fetching AI insight:", error);
            setAiInsight("Unable to generate AI insight at this time. Please check the market details manually.");
        } finally {
            setIsInsightLoading(false);
        }
    };
    
    // --- Canvas Bubble Animation ---

    const getBubbleSize = (volume, maxVolume) => {
        const minSize = 50;
        const maxSize = 150;
        if (maxVolume === 0) return minSize;
        // Scale size logarithmically to better handle wide ranges in volume
        const scale = Math.log10(volume + 1) / Math.log10(maxVolume + 1);
        return minSize + (scale * (maxSize - minSize));
    };

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !marketData) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const updateCanvasSize = () => {
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.scale(dpr, dpr);
        };

        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);

        const allMarkets = Object.values(marketData.categorized).flat();
        
        bubblesRef.current = allMarkets.map((market, i) => {
            const maxVolume = marketData.maxVolumes[market.category];
            const size = getBubbleSize(market.volume, maxVolume);
            return {
                ...market,
                x: Math.random() * (window.innerWidth - size) + size / 2,
                y: Math.random() * (window.innerHeight - size) + size / 2,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                radius: size / 2,
                targetRadius: size / 2,
                scale: 1,
            };
        });

        const animate = (time) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            bubblesRef.current.forEach((bubble, i) => {
                // Movement physics
                bubble.x += bubble.vx;
                bubble.y += bubble.vy;

                // Wall collision
                if (bubble.x - bubble.radius < 0 || bubble.x + bubble.radius > window.innerWidth) bubble.vx *= -0.9;
                if (bubble.y - bubble.radius < 0 || bubble.y + bubble.radius > window.innerHeight) bubble.vy *= -0.9;
                
                // Keep bubbles within bounds
                bubble.x = Math.max(bubble.radius, Math.min(window.innerWidth - bubble.radius, bubble.x));
                bubble.y = Math.max(bubble.radius, Math.min(window.innerHeight - bubble.radius, bubble.y));


                // Bubble-to-bubble collision
                for (let j = i + 1; j < bubblesRef.current.length; j++) {
                    const other = bubblesRef.current[j];
                    const dx = other.x - bubble.x;
                    const dy = other.y - bubble.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const minDistance = bubble.radius + other.radius;

                    if (distance < minDistance) {
                        // Resolve overlap
                        const angle = Math.atan2(dy, dx);
                        const overlap = (minDistance - distance) / 2;
                        bubble.x -= overlap * Math.cos(angle);
                        bubble.y -= overlap * Math.sin(angle);
                        other.x += overlap * Math.cos(angle);
                        other.y += overlap * Math.sin(angle);

                        // Elastic collision response
                        const angleCollision = Math.atan2(other.y - bubble.y, other.x - bubble.x);
                        const speed1 = Math.sqrt(bubble.vx * bubble.vx + bubble.vy * bubble.vy);
                        const speed2 = Math.sqrt(other.vx * other.vx + other.vy * other.vy);
                        const direction1 = Math.atan2(bubble.vy, bubble.vx);
                        const direction2 = Math.atan2(other.vy, other.vx);
                        const newVelX1 = speed2 * Math.cos(direction2 - angleCollision) * Math.cos(angleCollision) + speed1 * Math.sin(direction1 - angleCollision) * Math.cos(angleCollision + Math.PI / 2);
                        const newVelY1 = speed2 * Math.cos(direction2 - angleCollision) * Math.sin(angleCollision) + speed1 * Math.sin(direction1 - angleCollision) * Math.sin(angleCollision + Math.PI / 2);
                        const newVelX2 = speed1 * Math.cos(direction1 - angleCollision) * Math.cos(angleCollision) + speed2 * Math.sin(direction2 - angleCollision) * Math.cos(angleCollision + Math.PI / 2);
                        const newVelY2 = speed1 * Math.cos(direction1 - angleCollision) * Math.sin(angleCollision) + speed2 * Math.sin(direction2 - angleCollision) * Math.sin(angleCollision + Math.PI / 2);
                        bubble.vx = newVelX1 * 0.9; bubble.vy = newVelY1 * 0.9;
                        other.vx = newVelX2 * 0.9; other.vy = newVelY2 * 0.9;
                    }
                }
                
                // Slow down bubbles over time
                bubble.vx *= 0.998;
                bubble.vy *= 0.998;

                // Drawing the bubble
                const color = categoryColors[bubble.category] || categoryColors.default;

                // Pulsing glow effect
                const glowSize = bubble.radius * (1.2 + Math.sin(time / 500 + i) * 0.1);
                const glowGradient = ctx.createRadialGradient(bubble.x, bubble.y, 0, bubble.x, bubble.y, glowSize);
                glowGradient.addColorStop(0, color + '33');
                glowGradient.addColorStop(1, color + '00');
                ctx.fillStyle = glowGradient;
                ctx.beginPath();
                ctx.arc(bubble.x, bubble.y, glowSize, 0, Math.PI * 2);
                ctx.fill();

                // Main bubble body with gradient
                const bubbleGradient = ctx.createRadialGradient(bubble.x - bubble.radius * 0.3, bubble.y - bubble.radius * 0.3, 0, bubble.x, bubble.y, bubble.radius);
                bubbleGradient.addColorStop(0, `${color}ff`);
                bubbleGradient.addColorStop(1, `${color}cc`);
                ctx.fillStyle = bubbleGradient;
                ctx.beginPath();
                ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,0.2)';
                ctx.shadowBlur = 15;
                ctx.shadowOffsetY = 5;
                ctx.fill();
                ctx.restore();


                // Text inside the bubble
                ctx.fillStyle = '#FFFFFF';
                const fontSize = Math.max(bubble.radius / 2.2, 16);
                ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${bubble.odds}%`, bubble.x, bubble.y - bubble.radius * 0.15);
                
                const titleFontSize = Math.max(bubble.radius / 7, 10);
                ctx.font = `${titleFontSize}px 'Inter', sans-serif`;
                const title = bubble.title.length > 20 ? bubble.title.substring(0, 20) + '...' : bubble.title;
                ctx.fillText(title, bubble.x, bubble.y + bubble.radius * 0.35);
            });

            animationRef.current = requestAnimationFrame(animate);
        };

        animate(0);

        return () => {
            window.removeEventListener('resize', updateCanvasSize);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isDark, marketData]);

    const handleCanvasClick = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Find the topmost bubble that was clicked
        let clickedBubble = null;
        for (const bubble of [...bubblesRef.current].reverse()) {
            const dx = x - bubble.x;
            const dy = y - bubble.y;
            if (Math.sqrt(dx * dx + dy * dy) < bubble.radius) {
                clickedBubble = bubble;
                break;
            }
        }
        
        if (clickedBubble) {
            setSelectedMarket(clickedBubble);
            getAiInsight(clickedBubble);
        }
    };
    
    // --- Render Method ---

    return (
        <div className={`relative min-h-screen overflow-hidden ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'} font-['Inter',_sans-serif]`}>
            {/* Loading Overlay */}
            {loading && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm">
                    <RefreshCw className="w-10 h-10 animate-spin text-purple-400 mb-4" />
                    <p className="text-lg font-semibold">Loading PolyFutures...</p>
                    <p className="text-sm text-gray-400">Fetching the latest market data.</p>
                </div>
            )}
            {/* Error Message */}
            {error && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4">
                    <div className="text-center bg-gray-800 p-6 rounded-lg shadow-xl">
                        <p className="text-lg font-semibold text-red-400 mb-2">An Error Occurred</p>
                        <p className="text-sm text-gray-300">{error}</p>
                         <button onClick={fetchPolymarketData} className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold transition-colors">
                            Try Again
                         </button>
                    </div>
                 </div>
            )}
            
            {/* Header */}
            <header className={`fixed top-0 left-0 right-0 z-40 bg-clip-padding backdrop-filter ${isDark ? 'bg-gray-900/60 backdrop-blur-lg' : 'bg-gray-100/60 backdrop-blur-lg'} border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between px-5 py-3 max-w-7xl mx-auto">
                    <h1 className="text-xl font-bold tracking-tighter">PolyFutures.xyz</h1>
                    <button onClick={() => setIsDark(!isDark)} className={`p-2 rounded-full transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'}`}>
                        {isDark ? <Sun className="w-5 h-5 text-yellow-300" /> : <Moon className="w-5 h-5 text-gray-700" />}
                    </button>
                </div>
            </header>

            {/* Canvas for bubbles */}
            <canvas ref={canvasRef} onClick={handleCanvasClick} className="absolute inset-0 w-full h-full cursor-pointer" />

            {/* Selected Market Detail Panel */}
            {selectedMarket && (
                <div className="fixed inset-0 z-50" style={{'--accent-color': categoryColors[selectedMarket.category]}}>
                    <div className={`absolute inset-0 ${isDark ? 'bg-black/70' : 'bg-gray-900/70'} backdrop-blur-sm`} onClick={() => setSelectedMarket(null)} />
                    <div className={`absolute inset-x-0 bottom-0 rounded-t-3xl shadow-2xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'} animate-slide-up`}>
                        <div className="h-2 bg-[var(--accent-color)]" />
                        <div className="p-5 overflow-y-auto max-h-[85vh]">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold text-white bg-[var(--accent-color)] uppercase tracking-wider">{selectedMarket.category}</span>
                                    <h2 className={`text-xl font-bold mt-3 mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedMarket.title}</h2>
                                </div>
                                <button onClick={() => setSelectedMarket(null)} className={`p-2 rounded-full ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                             <div className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Current Odds</p>
                                        <p className={`text-4xl font-bold`}>{selectedMarket.odds}%</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Volume</p>
                                        <p className="text-xl font-bold">${(selectedMarket.volume / 1000000).toFixed(1)}M</p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* AI Insight Section */}
                            <div className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                <h3 className="flex items-center gap-2 text-sm font-semibold mb-2 text-[var(--accent-color)]">
                                    <Cpu size={16} />
                                    <span>AI Insight</span>
                                </h3>
                                {isInsightLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0s'}}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                                    </div>
                                ) : (
                                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{aiInsight}</p>
                                )}
                            </div>


                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <InfoCard icon={Users} label="Traders" value={`${(selectedMarket.traders / 1000).toFixed(1)}K`} isDark={isDark} />
                                <InfoCard icon={selectedMarket.trend === 'up' ? TrendingUp : TrendingDown} label="24h Change" value={`${selectedMarket.trend === 'up' ? '+' : '-'}${selectedMarket.change}%`} trend={selectedMarket.trend} isDark={isDark} />
                            </div>

                            <a href={selectedMarket.url} target="_blank" rel="noopener noreferrer" className="w-full py-3 mt-2 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-[0.98] bg-[var(--accent-color)]">
                                Trade on Polymarket <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// A small component for displaying info cards in the detail panel
const InfoCard = ({ icon: Icon, label, value, trend, isDark }) => (
    <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
        <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{label}</p>
        </div>
        <p className={`text-xl font-bold ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : ''}`}>{value}</p>
    </div>
);

export default App;

