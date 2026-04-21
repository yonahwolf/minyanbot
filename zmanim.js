import axios from 'axios';
import config from './config.js';

const { zip, timezone: TZ } = config.location;
const cache = new Map();

function toDateString(date) {
  return date.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
}

async function fetchZmanim(date) {
  const key = toDateString(date);
  if (cache.has(key)) return cache.get(key);
  const { data } = await axios.get(`https://www.hebcal.com/zmanim?cfg=json&zip=${zip}&date=${key}`);
  cache.set(key, data.times);
  return data.times;
}

export async function getSunset(date) {
  const times = await fetchZmanim(date);
  return new Date(times.sunset);
}

export async function getCandleLighting(fridayDate) {
  const sunset = await getSunset(fridayDate);
  return new Date(sunset.getTime() - config.candle_lighting.minutes_before_sunset * 60 * 1000);
}
