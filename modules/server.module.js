import http from 'node:http';
import url from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';

const NOT_FOUND_MESSAGE = 'Не найдено';
const SERVER_ERROR_MESSAGE = 'Внутренняя ошибка сервера';
const SUCCESS_ADD_MESSAGE = 'Валюта успешно добавлена';
const SUCCESS_DELETE_MESSAGE = 'Валюта успешно удалена';
const INVALID_REQUEST_MESSAGE = 'Неверный запрос';
const QUOTES_FILE = process.env.QUOTES_FILE;
const TICKERS_FILE = process.env.TICKERS_FILE;

const handleStepQuery = (response, quotesData, queryStep) => {
  const step = parseInt(queryStep);
  if (step && step > 0) {
    const lastValuesData = {};

    Object.keys(quotesData).forEach(ticker => {
      const values = quotesData[ticker];
      const slicedValues = values.slice(-step);
      lastValuesData[ticker] = step < values.length ? slicedValues : values;
    });

    response.end(JSON.stringify(lastValuesData));
    return;
  }
  response.end(JSON.stringify(quotesData));
};

const handleCryptoRequest = async (response, query) => {
  try {
    const fileData = await readFile(QUOTES_FILE, 'utf-8');

    response.writeHead(200, { 'Content-Type': 'application/json' });

    const quotesData = JSON.parse(fileData);

    if (query.tickers) {
      const tickers = query.tickers.toUpperCase().split(',');
      const filteredData = {};
      tickers.forEach(ticker => {
        if (Object.prototype.hasOwnProperty.call(quotesData, ticker)) {
          filteredData[ticker] = quotesData[ticker];
        }
      });
      return handleStepQuery(response, filteredData, query.step);
    }
    handleStepQuery(response, quotesData, query.step);
  } catch (error) {
    console.error(`Ошибка при чтении файла ${error.message}`);
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ message: SERVER_ERROR_MESSAGE }));
  }
};

const handleAddTickers = (request, response, tickers, validTickers) => {
  const lengthTickers = tickers.length;
  let body = '';
  request.addListener('data', chunk => {
    body += chunk;
  });
  request.addListener('end', async () => {
    const userTickers = [];
    const data = JSON.parse(body.toUpperCase());

    if (typeof data === 'string') {
      userTickers.push(data);
    }

    if (Array.isArray(data)) {
      userTickers.push(...data);
    }

    userTickers.forEach(ticker => {
      if (validTickers.includes(ticker) && !tickers.includes(ticker)) {
        tickers.push(ticker);
      }
    });

    if (tickers.length !== lengthTickers) {
      try {
        await writeFile(TICKERS_FILE, JSON.stringify(tickers));
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ message: SUCCESS_ADD_MESSAGE }));
      } catch (error) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ message: SERVER_ERROR_MESSAGE }));
      }
    } else {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ message: INVALID_REQUEST_MESSAGE }));
    }
  });
};

const handleRemoveTickers = async (response, tickers, query) => {
  const tickersLength = tickers.length;
  try {
    if (!query.tickers) {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ message: INVALID_REQUEST_MESSAGE }));
      return;
    }

    const removeTicker = query.tickers.toUpperCase().split(',');
    const quotesFileData = await readFile(QUOTES_FILE, 'utf-8');
    const quotesData = JSON.parse(quotesFileData);

    removeTicker.forEach(ticker => {
      const index = tickers.indexOf(ticker);

      if (index > -1) {
        tickers.splice(index, 1);
        delete quotesData[ticker];
      }
    });

    if (tickers.length !== tickersLength) {
      await writeFile(TICKERS_FILE, JSON.stringify(tickers));
      await writeFile(QUOTES_FILE, JSON.stringify(quotesData));

      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ message: SUCCESS_DELETE_MESSAGE }));
    } else {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ message: INVALID_REQUEST_MESSAGE }));
    }
  } catch (error) {
    console.error(`Ошибка пр иудалении данных: ${error.message}`);
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ message: SERVER_ERROR_MESSAGE }));
  }
};

export const startServer = (tickers, validTickers) => {
  const server = http.createServer((request, response) => {
    const { pathname, query } = url.parse(request.url, true);

    if (pathname.startsWith('/crypto') && request.method === 'GET') {
      handleCryptoRequest(response, query);
      return;
    }

    if (pathname.startsWith('/crypto') && request.method === 'POST') {
      handleAddTickers(request, response, tickers, validTickers);
      return;
    }

    if (pathname.startsWith('/crypto') && request.method === 'DELETE') {
      handleRemoveTickers(response, tickers, query);
      return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ message: NOT_FOUND_MESSAGE }));
  });

  return server;
};
