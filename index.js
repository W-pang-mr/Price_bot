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
  // TON ecosystem jettons
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
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
  );
  return res.json();
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

      const usdValue = amount * data.usd;
      const change = data.usd_24h_change;
      const arrow = change >= 0 ? '📈' : '📉';
      const changeStr = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
      const marketCap = data.usd_market_cap ? `$${Math.round(data.usd_market_cap).toLocaleString()}` : 'نامشخص';

      const amountLabel = amount === 1 ? '' : `${amount} `;

      await ctx.reply(
        `💰 ${NAMES_FA[id] || id}\n\n` +
        `قیمت: $${data.usd.toLocaleString(undefined, { maximumFractionDigits: 6 })}\n` +
        (amount !== 1 ? `${amountLabel}${NAMES_FA[id]} = $${usdValue.toLocaleString(undefined, { maximumFractionDigits: 6 })}\n` : '') +
        `تغییر ۲۴ ساعته: ${arrow} ${changeStr}\n` +
        `ارزش بازار: ${marketCap}`
      );
    } else {
      const [fromId, toId] = coins;
      const fromData = prices[fromId];
      const toData = prices[toId];
      if (!fromData || !toData) return;

      const result = (amount * fromData.usd) / toData.usd;

      await ctx.reply(
        `🔄 تبدیل ارز\n\n` +
        `${amount} ${NAMES_FA[fromId]} = ${result.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${NAMES_FA[toId]}\n\n` +
        `(بر اساس قیمت لحظه‌ای: هر ${NAMES_FA[fromId]} = $${fromData.usd.toLocaleString()}, هر ${NAMES_FA[toId]} = $${toData.usd.toLocaleString()})`
      );
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
