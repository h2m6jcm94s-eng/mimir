import { capturePageData, captureSelectionData, isExtensionPage } from './extract';
import type { CaptureData, CaptureMode, ExtensionMessage } from './types';

function sendCaptured(mode: CaptureMode, data: CaptureData): void {
  if (!data.text.trim()) {
    return;
  }
  const message: ExtensionMessage = {
    type: 'PAGE_CAPTURED',
    mode,
    data,
  };
  void chrome.runtime.sendMessage(message).catch(() => {
    // background may not be listening; ignore
  });
}

function handleMessage(message: ExtensionMessage): true {
  if (message.type === 'CAPTURE_PAGE') {
    const data = capturePageData(document);
    if (isExtensionPage(data.url)) return true;
    sendCaptured('page', data);
  }

  if (message.type === 'CAPTURE_SELECTION') {
    const data = captureSelectionData(document);
    if (isExtensionPage(data.url)) return true;
    sendCaptured('selection', data);
  }

  return true;
}

chrome.runtime.onMessage.addListener(handleMessage);
