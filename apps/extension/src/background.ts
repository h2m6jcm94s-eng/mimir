import { postCapture } from './api';
import { formatCapture } from './extract';
import type { CaptureData, CaptureMode, ExtensionMessage } from './types';

const CONTEXT_MENU_PAGE_ID = 'mimir-capture-page';
const CONTEXT_MENU_SELECTION_ID = 'mimir-capture-selection';

function createContextMenus(): void {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_PAGE_ID,
    title: 'Capture page to Mimir',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: CONTEXT_MENU_SELECTION_ID,
    title: 'Capture selection to Mimir',
    contexts: ['selection'],
  });
}

chrome.runtime.onInstalled.addListener(createContextMenus);

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendCaptureToTab(mode: CaptureMode, tabId: number): Promise<void> {
  const message: ExtensionMessage = {
    type: mode === 'page' ? 'CAPTURE_PAGE' : 'CAPTURE_SELECTION',
  };
  await chrome.tabs.sendMessage(tabId, message);
}

async function captureFromActiveTab(mode: CaptureMode): Promise<void> {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  await sendCaptureToTab(mode, tab.id);
}

async function showBadge(success: boolean): Promise<void> {
  await chrome.action.setBadgeText({ text: success ? '✓' : '✕' });
  await chrome.action.setBadgeBackgroundColor({ color: success ? '#10b981' : '#ef4444' });
  setTimeout(() => {
    void chrome.action.setBadgeText({ text: '' });
  }, 2000);
}

async function handleCapturedData(mode: CaptureMode, data: CaptureData): Promise<void> {
  try {
    const payload = formatCapture(mode, data);
    await postCapture(payload);
    await showBadge(true);
  } catch {
    await showBadge(false);
  }
}

chrome.action.onClicked.addListener(() => {
  void captureFromActiveTab('page');
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-page') {
    void captureFromActiveTab('page');
  }
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === CONTEXT_MENU_PAGE_ID) {
    void captureFromActiveTab('page');
  } else if (info.menuItemId === CONTEXT_MENU_SELECTION_ID) {
    void captureFromActiveTab('selection');
  }
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === 'PAGE_CAPTURED' && message.mode && message.data && 'url' in message.data) {
    void handleCapturedData(message.mode, message.data as CaptureData);
  }
  return true;
});
