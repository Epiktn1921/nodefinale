const express = require('express');
const soap = require('soap');
const xml2js = require('xml2js');
const { DateTime } = require('luxon');

const app = express();
const PORT = 3001;


const CBR_WSDL_URL = 'https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx?WSDL';


function parseXML(xml) {
  return new Promise((resolve,reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}


function formatDate(date) {
  return DateTime.fromJSDate(date).toISO({ includeOffset: false }) + '.000Z';
}


function extractValutes(enumXml, cursXml) {
  const valutesList = enumXml.ValutaData.Valuta;
  const cursList = cursXml.ValCurs.Record;

  const codeToName = {};
  for (const v of valutesList) {
    codeToName[v.Vcode] = v.Vname;
  }

  const result = [];
  for (const r of cursList) {
    result.push({
      code: r['$'].ID,
      name: codeToName[r['$'].ID] || 'Неизвестно',
      value: parseFloat(r.Value.replace(',', '.'))
    });
  }

  return result;
}


function extractDynamic(cursDynamicXml) {
  const records = cursDynamicXml.ValCurs.Record;
  if (!Array.isArray(records)) return [];

  return records.map(r => ({
    date: r['$'].Date,
    value: parseFloat(r.Value.replace(',', '.'))
  }));
}


const service = {
  ValuteService: {
    ValutePort: {
      getValutes: async function(args, callback) {
        try {
          const client = await soap.createClientAsync(CBR_WSDL_URL);
          
         
          const today = new Date();
          const onDateStr = formatDate(today);
          const enumResult = await client.EnumValutesXMLAsync({ Seld: false });
          const cursResult = await client.GetCursOnDateXMLAsync({ On_date: onDateStr });

          const enumData = await parseXML(enumResult[0]);
          const cursData = await parseXML(cursResult[0]);

          const valutes = extractValutes(enumData, cursData);

          callback({ valutes: JSON.stringify(valutes) });
        } catch (err) {
          console.error('getValutes error:', err);
          callback({ fault: { faultstring: 'Ошибка при получении списка валют' } });
        }
      },

      getValute: async function(args, callback) {
        try {
          const { code, fromDate, toDate } = args;

      
          const startDate = DateTime.fromFormat(fromDate, 'dd.MM.yyyy').toJSDate();
          const endDate = DateTime.fromFormat(toDate, 'dd.MM.yyyy').toJSDate();

          const client = await soap.createClientAsync(CBR_WSDL_URL);

          const result = await client.GetCursDynamicXMLAsync({
            FromDate: formatDate(startDate),
            ToDate: formatDate(endDate),
            ValutaCode: code
          });

          const parsed = await parseXML(result[0]);
          const dynamic = extractDynamic(parsed);

          callback({ dynamic: JSON.stringify(dynamic) });
        } catch (err) {
          console.error('getValute error:', err);
          callback({ fault: { faultstring: 'Ошибка при получении динамики курса' } });
        }
      }
    }
  }
};

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions name="ValuteService"
  targetNamespace="http://tempuri.org/"
  xmlns:tns="http://tempuri.org/"
  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/"
  xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"
  xmlns="http://schemas.xmlsoap.org/wsdl/">

  <message name="GetValutesRequest"/>
  <message name="GetValutesResponse">
    <part name="valutes" type="xsd:string"/>
  </message>

  <message name="GetValuteRequest">
    <part name="code" type="xsd:string"/>
    <part name="fromDate" type="xsd:string"/>
    <part name="toDate" type="xsd:string"/>
  </message>
  <message name="GetValuteResponse">
    <part name="dynamic" type="xsd:string"/>
  </message>

  <portType name="ValutePortType">
    <operation name="getValutes">
      <input message="tns:GetValutesRequest"/>
      <output message="tns:GetValutesResponse"/>
    </operation>
    <operation name="getValute">
      <input message="tns:GetValuteRequest"/>
      <output message="tns:GetValuteResponse"/>
    </operation>
  </portType>

  <binding name="ValuteBinding" type="tns:ValutePortType">
    <soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="getValutes">
      <soap:operation soapAction="http://tempuri.org/getValutes"/>
      <input><soap:body use="encoded" namespace="http://tempuri.org/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></input>
      <output><soap:body use="encoded" namespace="http://tempuri.org/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></output>
    </operation>
    <operation name="getValute">
      <soap:operation soapAction="http://tempuri.org/getValute"/>
      <input><soap:body use="encoded" namespace="http://tempuri.org/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></input>
      <output><soap:body use="encoded" namespace="http://tempuri.org/" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/></output>
    </operation>
  </binding>

  <service name="ValuteService">
    <port name="ValutePort" binding="tns:ValuteBinding">
      <soap:address location="http://localhost:3001/valute"/>
    </port>
  </service>
</definitions>`;

app.use('/valute', soap.listen(soap.parse(xml), service));

app.listen(PORT, () => {
  console.log(`🔥 Прокси-сервер запущен на http://localhost:${PORT}/valute`);
});
