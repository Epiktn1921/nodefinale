const soap = require('soap');

const PROXY_URL = 'http://localhost:3001/valute?wsdl';

async function testGetValutes() {
  const client = await soap.createClientAsync(PROXY_URL);
  const result = await client.getValutesAsync({});
  console.log('Список валют:', JSON.parse(result.valutes));
}

async function testGetValute() {
  const client = await soap.createClientAsync(PROXY_URL);
  const result = await client.getValuteAsync({
    code: 'R01235', // USD
    fromDate: '01.03.2023',
    toDate: '15.03.2023'
  });
  console.log('Динамика USD:', JSON.parse(result.dynamic));
}


(async () => {
  console.log('--- Получение списка валют ---');
  await testGetValutes();

  console.log('\n--- Получение динамики курса ---');
  await testGetValute();
})();
