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

async function syncStateFromTab(): Promise<void> {
  try {
    const tabId = await getActiveTabId();
    const response = await sendContentMessage(tabId, { type: 'SQUINT_STATUS_REQUEST' });
    if (response && response.type === 'SQUINT_STATUS_RESULT') setCleansedState(response.applied);
  } catch {
    // No content script on this page (e.g. chrome:// tabs) — stay in idle state.
  }
}

async function cleanse(): Promise<void> {
  statusEl.textContent = 'Scanning page...';
  noFailuresStatusEl.hidden = true;
  const tabId = await getActiveTabId();
  const scanResponse = await sendContentMessage(tabId, { type: 'SQUINT_SCAN_REQUEST' });
  if (!scanResponse || scanResponse.type !== 'SQUINT_SCAN_RESULT') return;

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
  if (applyResponse && applyResponse.type === 'SQUINT_APPLY_RESULT') {
    statusEl.textContent = `Fixed ${applyResponse.appliedCount} elements.`;
    setCleansedState(true);
  }
}

async function unCleanse(): Promise<void> {
  statusEl.textContent = 'Restoring page...';
  const tabId = await getActiveTabId();
  const response = await sendContentMessage(tabId, { type: 'SQUINT_REMOVE_FIXES' });
  if (!response) {
    statusEl.textContent = 'Undo failed — try reloading the page.';
    return;
  }
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

void syncStateFromTab();

const SIMPLIFY_IDLE_LABEL = 'Simplify page';
const SIMPLIFIED_LABEL = 'Simplified — click to undo';

const simplifyButton = document.getElementById('simplify-button') as HTMLButtonElement;
const simplifyStatusEl = document.getElementById('simplify-status') as HTMLElement;

let simplified = false;

function setSimplifiedState(isSimplified: boolean): void {
  simplified = isSimplified;
  simplifyButton.textContent = isSimplified ? SIMPLIFIED_LABEL : SIMPLIFY_IDLE_LABEL;
  simplifyButton.classList.toggle('is-active', isSimplified);
}

async function syncSimplifyStateFromTab(): Promise<void> {
  try {
    const tabId = await getActiveTabId();
    const response = await sendContentMessage(tabId, { type: 'SQUINT_SIMPLIFY_STATUS_REQUEST' });
    if (response && response.type === 'SQUINT_SIMPLIFY_STATUS_RESULT') setSimplifiedState(response.applied);
  } catch {
    // No content script on this page (e.g. chrome:// tabs) — stay in idle state.
  }
}

async function simplify(): Promise<void> {
  simplifyStatusEl.textContent = 'Scanning page...';
  const tabId = await getActiveTabId();
  const scanResponse = await sendContentMessage(tabId, { type: 'SQUINT_SIMPLIFY_SCAN_REQUEST' });
  if (!scanResponse || scanResponse.type !== 'SQUINT_SIMPLIFY_SCAN_RESULT') return;

  if (scanResponse.summary.totalFlagged === 0) {
    simplifyStatusEl.textContent = 'Nothing to simplify on this page.';
    return;
  }

  const applyResponse = await sendContentMessage(tabId, { type: 'SQUINT_SIMPLIFY_APPLY' });
  if (applyResponse && applyResponse.type === 'SQUINT_SIMPLIFY_APPLY_RESULT') {
    simplifyStatusEl.textContent = `Simplified ${applyResponse.appliedCount} elements.`;
    setSimplifiedState(true);
  }
}

async function unSimplify(): Promise<void> {
  simplifyStatusEl.textContent = 'Restoring page...';
  const tabId = await getActiveTabId();
  const response = await sendContentMessage(tabId, { type: 'SQUINT_SIMPLIFY_REMOVE' });
  if (!response) {
    simplifyStatusEl.textContent = 'Undo failed — try reloading the page.';
    return;
  }
  if (response.type === 'SQUINT_SIMPLIFY_REMOVE_RESULT') {
    simplifyStatusEl.textContent = '';
    setSimplifiedState(false);
  }
}

async function handleSimplifyToggle(): Promise<void> {
  simplifyButton.disabled = true;
  try {
    if (simplified) {
      await unSimplify();
    } else {
      await simplify();
    }
  } catch (error) {
    simplifyStatusEl.textContent = error instanceof Error ? error.message : 'Something went wrong.';
  } finally {
    simplifyButton.disabled = false;
  }
}

simplifyButton.addEventListener('click', () => {
  void handleSimplifyToggle();
});

void syncSimplifyStateFromTab();
