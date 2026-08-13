const { Telegraf } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.BOT_TOKEN);

const ALIASES = {
  'بیتکوین': 'bitcoin', 'بیت کوین': 'bitcoin', 'btc': 'bitcoin', 'bitcoin': 'bitcoin',
  'اتریوم': 'ethereum', 'eth': 'ethereum', 'ethereum': 'ethereum',
  'تتر': 'tether', 'usdt': 'tether', 'tether': 'tether',
  'ریپل': 'ripple', 'xrp': 'ripple', 'ripple': 'ripple',
  'دوج': 'dogecoin', 'دوج کوین': 'dogecoin', 'doge': 'dogecoin', 'dogecoin': 'dogecoin',
  'گرم': 'the-open-network', 'گرم کوین': 'the-open-network', 'تون': 'the-open-network', 'تون کوین': 'the-open-network', 'ton': 'the-open-network', 'toncoin': 'the-open-network',
  'سولانا': 'solana', 'sol': 'solana', 'solana': 'solana',
  'بایننس کوین': 'binancecoin', 'bnb': 'binancecoin', 'binancecoin': 'binancecoin',
  'کاردانو': 'cardano', 'ada': 'cardano', 'cardano': 'cardano',
  'لایت کوین': 'litecoin', 'لایتکوین': 'litecoin', 'ltc': 'litecoin', 'litecoin': 'litecoin',
  'شیبا': 'shiba-inu', 'شیبا اینو': 'shiba-inu', 'shib': 'shiba-inu', 'shiba': 'shiba-inu',
  'پولکادات': 'polkadot', 'dot': 'polkadot', 'polkadot': 'polkadot',
  'ترون': 'tron', 'trx': 'tron', 'tron': 'tron',
  'ناتکوین': 'notcoin', 'نات کوین': 'notcoin', 'not': 'notcoin', 'notcoin': 'notcoin',
  'داگز': 'dogs', 'dogs': 'dogs',
  'همستر': 'hamster-kombat', 'همستر کامبات': 'hamster-kombat', 'hmstr': 'hamster-kombat', 'hamster': 'hamster-kombat',
  'کاتیزن': 'catizen', 'catizen': 'catizen'
};

const NAMES_FA = {
  'bitcoin': 'بیتکوین', 'ethereum': 'اتریوم', 'tether': 'تتر', 'ripple': 'ریپل',
  'dogecoin': 'دوج‌کوین', 'the-open-network': 'تون‌کوین', 'solana': 'سولانا',
  'binancecoin': 'بایننس‌کوین', 'cardano': 'کاردانو', 'litecoin': 'لایت‌کوین',
  'shiba-inu': 'شیبا اینو', 'polkadot': 'پولکادات', 'tron': 'ترون',
  'notcoin': 'ناتکوین', 'dogs': 'داگز', 'hamster-kombat': 'همستر کامبات', 'catizen': 'کاتیزن'
};

function toEnglishDigits(str) {
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  return str.replace(/[۰-۹]/g, d => fa.indexOf(d));
}

function parseMessage(text) {
  const normalized = toEnglishDigits(text.trim().toLowerCase());
  const amountMatch = normalized.match(/^([\d.]+)\s*/);
  let amount = 1;
  let rest = normalized;

  if (amountMatch) {
    amount = parseFloat(amountMatch[1]);
    rest = normalized.slice(amountMatch[0].length).trim();
  }

  const words = rest.split(/\s+/).filter(Boolean);
  const matchedCoins = [];

  let i = 0;
  while (i < words.length) {
    const twoWord = words.slice(i, i + 2).join(' ');
    if (ALIASES[twoWord]) {
      matchedCoins.push(ALIASES[twoWord]);
      i += 2;
      continue;
    }
    const oneWord = words[i];
    if (ALIASES[oneWord]) {
      matchedCoins.push(ALIASES[oneWord]);
      i += 1;
      continue;
    }
    return null;
  }

  if (matchedCoins.length === 0 || matchedCoins.length > 2) return null;
  return { amount, coins: matchedCoins };
}

async function fetchPrices(ids) {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}`
  );
  const arr = await res.json();
  const map = {};
  arr.forEach(c => { map[c.id] = c; });
  return map;
}

async function buildChartUrl(id, isUp) {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=1`
    );
    const data = await res.json();
    const points = data.prices || [];
    if (points.length === 0) return null;

    // sample down to ~40 points so the URL doesn't get too long
    const step = Math.max(1, Math.floor(points.length / 40));
    const sampled = points.filter((_, idx) => idx % step === 0).map(p => p[1]);

    const color = isUp ? '#4ADE80' : '#FF6B6B';
    const chartConfig = {
      type: 'line',
      data: {
        labels: sampled.map(() => ''),
        datasets: [{
          data: sampled,
          borderColor: color,
          backgroundColor: color + '22',
          fill: true,
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.3
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } },
        layout: { padding: 0 }
      }
    };

    const encoded = encodeURIComponent(JSON.stringify(chartConfig));
    return `https://quickchart.io/chart?c=${encoded}&width=600&height=300&backgroundColor=%2310152a&devicePixelRatio=2`;
  } catch (e) {
    console.error('Chart build error:', e.message);
    return null;
  }
}

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) return;

  const parsed = parseMessage(text);
  if (!parsed) return;

  const { amount, coins } = parsed;

  try {
    const uniqueIds = [...new Set(coins)];
    const prices = await fetchPrices(uniqueIds);

    if (coins.length === 1) {
      const id = coins[0];
      const data = prices[id];
      if (!data) return;

      const usdValue = amount * data.current_price;
      const change = data.price_change_percentage_24h || 0;
      const isUp = change >= 0;
      const arrow = isUp ? '🟢📈' : '🔴📉';
      const changeStr = (isUp ? '+' : '') + change.toFixed(2) + '%';
      const marketCap = data.market_cap ? `$${Math.round(data.market_cap).toLocaleString()}` : 'نامشخص';
      const volume = data.total_volume ? `$${Math.round(data.total_volume).toLocaleString()}` : 'نامشخص';
      const rank = data.market_cap_rank ? `#${data.market_cap_rank}` : '-';
      const name = NAMES_FA[id] || data.name;

      const caption =
        `💰 <b>${name}</b> (${data.symbol.toUpperCase()}) ${rank}\n\n` +
        `💵 قیمت: <b>$${data.current_price.toLocaleString(undefined, { maximumFractionDigits: 6 })}</b>\n` +
        (amount !== 1 ? `🧮 ${amount} ${name} = <b>$${usdValue.toLocaleString(undefined, { maximumFractionDigits: 6 })}</b>\n` : '') +
        `${arrow} تغییر ۲۴ ساعته: <b>${changeStr}</b>\n` +
        `🏦 ارزش بازار: ${marketCap}\n` +
        `📊 حجم معاملات: ${volume}`;

      const chartUrl = await buildChartUrl(id, isUp);

      if (chartUrl) {
        await ctx.replyWithMediaGroup([
          { type: 'photo', media: data.image, caption, parse_mode: 'HTML' },
          { type: 'photo', media: chartUrl }
        ]);
      } else {
        await ctx.replyWithPhoto(data.image, { caption, parse_mode: 'HTML' });
      }
    } else {
      const [fromId, toId] = coins;
      const fromData = prices[fromId];
      const toData = prices[toId];
      if (!fromData || !toData) return;

      const result = (amount * fromData.current_price) / toData.current_price;
      const fromName = NAMES_FA[fromId] || fromData.name;
      const toName = NAMES_FA[toId] || toData.name;

      const caption =
        `🔄 <b>تبدیل ارز</b>\n\n` +
        `💱 ${amount} ${fromName} = <b>${result.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${toName}</b>\n\n` +
        `💵 هر ${fromName} = $${fromData.current_price.toLocaleString()}\n` +
        `💵 هر ${toName} = $${toData.current_price.toLocaleString()}`;

      await ctx.replyWithPhoto(fromData.image, { caption, parse_mode: 'HTML' });
    }
  } catch (err) {
    console.error('Price fetch error:', err.message);
  }
});

bot.launch();
console.log('Price bot is running...');

const app = express();
app.get('/', (req, res) => res.send('Bot is alive'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HTTP server listening on port ${PORT}`));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
