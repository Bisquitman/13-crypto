import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fetchAndStoreData, fetchValidTickers } from './modules/dataModule.js';
import { startServer } from './modules/server.module.js';

const PORT = process.env.PORT || 3000;
const TICKERS_FILE = process.env.TICKERS_FILE;

try {
  const validTickers = await fetchValidTickers();
  const fileData = await readFile(TICKERS_FILE, 'utf-8');
  const tickers = JSON.parse(fileData);

  const server = startServer(tickers, validTickers);

  server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
  });

  setInterval(() => {
    fetchAndStoreData(tickers);
  }, 5000);
} catch (error) {
  console.error(`Ошибка при чтении данных из файла: ${error.message}`);
}
