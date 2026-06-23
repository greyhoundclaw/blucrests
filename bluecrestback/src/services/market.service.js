const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

async function fetchJson(url) {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'User-Agent': 'BlueCrest/1.0'
        },
        signal: AbortSignal.timeout(7000)
    });

    if (!response.ok) {
        throw new Error(`Market provider returned ${response.status}`);
    }

    return response.json();
}

async function getMarketSnapshot(currency = 'USD') {
    const targetCurrency = String(currency).toUpperCase();
    const cached = cache.get(targetCurrency);

    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.data;
    }

    const forexPromise = targetCurrency === 'USD'
        ? Promise.resolve({ rates: { USD: 1 } })
        : fetchJson('https://open.er-api.com/v6/latest/USD');

    const [forex, bitcoin] = await Promise.all([
        forexPromise,
        fetchJson(
            'https://api.coingecko.com/api/v3/simple/price' +
            '?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
        )
    ]);

    const usdRate = Number(forex?.rates?.[targetCurrency]);
    const bitcoinUsd = Number(bitcoin?.bitcoin?.usd);
    const bitcoinChange24h = Number(bitcoin?.bitcoin?.usd_24h_change);

    if (!Number.isFinite(usdRate) || !Number.isFinite(bitcoinUsd)) {
        throw new Error('Market provider returned incomplete pricing data');
    }

    const data = {
        targetCurrency,
        usdRate,
        bitcoinUsd,
        bitcoinChange24h: Number.isFinite(bitcoinChange24h)
            ? bitcoinChange24h
            : null,
        updatedAt: new Date().toISOString()
    };

    cache.set(targetCurrency, {
        cachedAt: Date.now(),
        data
    });

    return data;
}

module.exports = {
    getMarketSnapshot
};
