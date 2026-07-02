import type { ContentMessage, ContentResponse, ScanSummary } from '../types';

const DEFAULT_PRESET_ID = 'C';
const IDLE_LABEL = 'Cleanse my eyes';
const CLEANSED_LABEL = 'Cleansed — click to undo';

const cleanseButton = document.getElementById('cleanse-button') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLElement;
const noFailuresStatusEl = document.getElementById('no-failures-status') as HTMLElement;

let cleansed = false;

async function getActiveTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found.');
  return tab.id;
}

function sendContentMessage(tabId: number, message: ContentMessage): Promise<ContentResponse> {
  return chrome.tabs.sendMessage(tabId, message);
}

function setCleansedState(isCleansed: boolean): void {
  cleansed = isCleansed;
  cleanseButton.textContent = isCleansed ? CLEANSED_LABEL : IDLE_LABEL;
  cleanseButton.classList.toggle('is-active', isCleansed);
}

async function cleanse(): Promise<void> {
  statusEl.textContent = 'Scanning page...';
  noFailuresStatusEl.hidden = true;
  const tabId = await getActiveTabId();
  const scanResponse = await sendContentMessage(tabId, { type: 'SQUINT_SCAN_REQUEST' });
  if (scanResponse.type !== 'SQUINT_SCAN_RESULT') return;

  const summary: ScanSummary = scanResponse.summary;
  if (summary.totalFailing === 0) {
    statusEl.textContent = '';
    noFailuresStatusEl.hidden = false;
    return;
  }

  const applyResponse = await sendContentMessage(tabId, {
    type: 'SQUINT_APPLY_PRESET',
    presetId: DEFAULT_PRESET_ID,
  });
  if (applyResponse.type === 'SQUINT_APPLY_RESULT') {
    statusEl.textContent = `Fixed ${applyResponse.appliedCount} elements.`;
    setCleansedState(true);
  }
}

async function unCleanse(): Promise<void> {
  statusEl.textContent = 'Restoring page...';
  const tabId = await getActiveTabId();
  const response = await sendContentMessage(tabId, { type: 'SQUINT_REMOVE_FIXES' });
  if (response.type === 'SQUINT_REMOVE_RESULT') {
    statusEl.textContent = '';
    setCleansedState(false);
  }
}

async function handleToggle(): Promise<void> {
  cleanseButton.disabled = true;
  try {
    if (cleansed) {
      await unCleanse();
    } else {
      await cleanse();
    }
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : 'Something went wrong.';
  } finally {
    cleanseButton.disabled = false;
  }
}

cleanseButton.addEventListener('click', () => {
  void handleToggle();
});
