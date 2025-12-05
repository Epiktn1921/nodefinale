
const express = require('express');
const soap = require('soap');
const xml2js = require('xml2js');
const cors = require('cors');
const { DateTime } = require('luxon');

const app = express();
const PORT = 3001;
const CBR_WSDL = 'https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx?WSDL';

app.use(cors());
app.use(express.json());


function parseXML(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}


function toCBRDateTime(dateStr) {
  const dt = DateTime.fromFormat(dateStr, 'dd.MM.yyyy');
  if (!dt.isValid) throw new Error('Неверный формат даты. Используйте dd.MM.yaaa');
  return dt.toISO({ includeOffset: false });
}


app.get('/valutes', async (req, res) => {
  try {
    const client = await soap.createClientAsync(CBR_WSDL);

   
    const todayISO = DateTime.local().toISO({ includeOffset: false });

  
    const [enumRes] = await client.EnumValutesXMLAsync({ Seld: false });
    
    const [cursRes] = await client.GetCursOnDateXMLAsync({ On_date: todayISO });

    const enumData = await parseXML(enumRes);
    const cursData = await parseXML(cursRes);

  
    const valutes = (enumData.Vals?.Vvalute || []).reduce((acc, v) => {
      acc[v.Vcode] = v.Vname;
      return acc;
    }, {});

 
    const records = cursData.ValCurs?.Record || [];
    if (!Array.isArray(records)) records = [records];

    const result = records.map(r => ({
      code: r['$'].ID,
      name: valutes[r['$'].ID] || 'Неизвестно',
      value: parseFloat((r.Value || '0').toString().replace(',', '.'))
    }));

    res.json(result);
  } catch (err) {
    console.error('Ошибка в /valutes:', err.message);
    res.status(500).json({ error: 'Не удалось получить валюты', details: err.message });
  }
});


app.get('/valute', async (req, res) => {
  try {
    const { code, fromDate, toDate } = req.query;
    if (!code || !fromDate || !toDate) {
      return res.status(400).json({ error: 'Укажите code, fromDate, toDate (в формате dd.MM.yyyy)' });
    }

    const client = await soap.createClientAsync(CBR_WSDL);

    const fromISO = toCBRDateTime(fromDate);
    const toISO = toCBRDateTime(toDate);

    const [dynamicRes] = await client.GetCursDynamicXMLAsync({
      FromDate: fromISO,
      ToDate: toISO,
      ValutaCode: code
    });

    const parsed = await parseXML(dynamicRes);
    let records = parsed.ValCurs?.Record || [];
    if (!Array.isArray(records)) records = [records];

    const result = records.map(r => ({
      date: r['$'].Date, // ЦБ возвращает в формате dd.MM.yyyy
      value: parseFloat((r.Value || '0').toString().replace(',', '.'))
    }));

    res.json(result);
  } catch (err) {
    console.error('Ошибка в /valute:', err.message);
    res.status(500).json({ error: 'Не удалось получить динамику', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Прокси-сервер запущен на http://localhost:${PORT}`);
  console.log(`→ Список валют: GET /valutes`);
  console.log(`→ Динамика: GET /valute?code=R01235&fromDate=01.03.2023&toDate=15.03.2023`);
});
