import { getConfig, saveConfig } from './api';
import { DEFAULT_API_URL } from './extract';

const form = document.getElementById('options') as HTMLFormElement;
const input = document.getElementById('apiUrl') as HTMLInputElement;
const status = document.getElementById('status') as HTMLParagraphElement;

async function load() {
  const config = await getConfig();
  input.value = config.baseUrl || DEFAULT_API_URL;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveConfig({ baseUrl: input.value.trim() });
  status.textContent = 'Saved.';
  setTimeout(() => {
    status.textContent = '';
  }, 2000);
});

void load();
