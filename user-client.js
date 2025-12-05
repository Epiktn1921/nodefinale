
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function getValutes() {
  try {
    const res = await axios.get(`${BASE_URL}/valutes`);
    console.log('💱 Список валют:');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('❌ Ошибка при получении валют:', err.response?.data || err.message);
  }
}

async function getValuteHistory(code, from, to) {
  try {
    const res = await axios.get(`${BASE_URL}/valute`, {
      params: { code, fromDate: from, toDate: to }
    });
    console.log(`📈 Динамика ${code} (${from} – ${to}):`);
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('❌ Ошибка при получении динамики:', err.response?.data || err.message);
  }
}

(async () => {
  await getValutes();
  console.log('\n');
  await getValuteHistory('R01235', '01.03.2023', '15.03.2023'); // USD
})();
