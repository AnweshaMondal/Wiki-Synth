// Background script for Wikipedia Summarizer Chrome Extension

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // Set default settings
        chrome.storage.sync.set({
            defaultStyle: 'wikipedia',
            defaultLength: 'medium',
            autoDetect: true,
            showNotifications: true
        });

        // Open welcome page
        chrome.tabs.create({
            url: chrome.runtime.getURL('welcome.html')
        });
    }

    // Create context menu
    createContextMenus();
});

// Create context menus
function createContextMenus() {
    chrome.contextMenus.removeAll(() => {
        // Context menu for Wikipedia pages
        chrome.contextMenus.create({
            id: 'summarize-page',
            title: 'Summarize this Wikipedia page',
            contexts: ['page'],
            documentUrlPatterns: ['https://*.wikipedia.org/*']
        });

        // Context menu for selected text
        chrome.contextMenus.create({
            id: 'summarize-selection',
            title: 'Search and summarize "%s"',
            contexts: ['selection']
        });

        // Quick summary options
        chrome.contextMenus.create({
            id: 'quick-summary',
            title: 'Quick Summary',
            contexts: ['page'],
            documentUrlPatterns: ['https://*.wikipedia.org/*']
        });
    });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    switch (info.menuItemId) {
        case 'summarize-page':
            summarizeCurrentPage(tab);
            break;
        case 'summarize-selection':
            summarizeSelection(info.selectionText, tab);
            break;
        case 'quick-summary':
            quickSummarizeCurrentPage(tab);
            break;
    }
});

// Handle browser action click
chrome.action.onClicked.addListener((tab) => {
    // Open popup (this is handled automatically by the manifest)
});

// Listen for tab updates to detect Wikipedia pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('wikipedia.org')) {
        // Inject content script if not already injected
        injectContentScript(tabId);
        
        // Update badge to show extension is active
        chrome.action.setBadgeText({
            tabId: tabId,
            text: '✓'
        });
        
        chrome.action.setBadgeBackgroundColor({
            tabId: tabId,
            color: '#10b981'
        });
    } else {
        // Remove badge for non-Wikipedia pages
        chrome.action.setBadgeText({
            tabId: tabId,
            text: ''
        });
    }
});

// Inject content script
async function injectContentScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        });
    } catch (error) {
        console.error('Failed to inject content script:', error);
    }
}

// Summarize current page
async function summarizeCurrentPage(tab) {
    try {
        const title = await extractTitleFromTab(tab);
        if (title) {
            await openSummarizerWithTitle(title);
        }
    } catch (error) {
        console.error('Failed to summarize current page:', error);
        showNotification('Error', 'Failed to summarize the current page');
    }
}

// Quick summarize current page
async function quickSummarizeCurrentPage(tab) {
    try {
        const title = await extractTitleFromTab(tab);
        if (title) {
            await performQuickSummary(title);
        }
    } catch (error) {
        console.error('Failed to quick summarize:', error);
        showNotification('Error', 'Failed to create quick summary');
    }
}

// Summarize selected text
async function summarizeSelection(selectionText, tab) {
    try {
        // Use selection as search term
        await openSummarizerWithTitle(selectionText);
    } catch (error) {
        console.error('Failed to summarize selection:', error);
        showNotification('Error', 'Failed to summarize the selected text');
    }
}

// Extract title from Wikipedia tab
async function extractTitleFromTab(tab) {
    if (!tab.url || !tab.url.includes('wikipedia.org')) {
        throw new Error('Not a Wikipedia page');
    }

    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
                // Extract title from page
                const titleElement = document.querySelector('h1.firstHeading') || 
                                   document.querySelector('.mw-page-title-main') ||
                                   document.querySelector('#firstHeading');
                return titleElement ? titleElement.textContent.trim() : null;
            }
        });

        return results[0]?.result || extractTitleFromUrl(tab.url);
    } catch (error) {
        console.error('Failed to extract title from page:', error);
        return extractTitleFromUrl(tab.url);
    }
}

// Extract title from URL as fallback
function extractTitleFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const title = pathParts[pathParts.length - 1];
        return decodeURIComponent(title).replace(/_/g, ' ');
    } catch (error) {
        console.error('Failed to extract title from URL:', error);
        return null;
    }
}

// Open summarizer popup with pre-filled title
async function openSummarizerWithTitle(title) {
    // Store the title temporarily
    await chrome.storage.local.set({ 'pendingSummary': title });
    
    // Open popup (handled by popup.js)
    chrome.action.openPopup();
}

// Perform quick summary in background
async function performQuickSummary(title) {
    try {
        // Get stored auth
        const auth = await chrome.storage.sync.get(['apiKey', 'token']);
        if (!auth.apiKey) {
            showNotification('Configuration Required', 'Please set up your API key in the extension settings');
            return;
        }

        // Show processing notification
        showNotification('Processing', `Creating quick summary for "${title}"`);

        // Make API request
        const response = await fetch('https://your-api-domain.com/api/summary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`,
                'X-API-Key': auth.apiKey
            },
            body: JSON.stringify({
                title: title,
                style: 'casual',
                length: 'short',
                source: 'quick_summary'
            })
        });

        const result = await response.json();

        if (result.success) {
            // Store the result
            await chrome.storage.local.set({
                'lastQuickSummary': {
                    title: title,
                    summary: result.data.summary,
                    timestamp: new Date().toISOString()
                }
            });

            showNotification('Summary Ready', 'Click to view your quick summary', () => {
                chrome.tabs.create({ url: chrome.runtime.getURL('quick-summary.html') });
            });
        } else {
            showNotification('Error', result.message || 'Failed to generate summary');
        }

    } catch (error) {
        console.error('Quick summary failed:', error);
        showNotification('Error', 'Network error. Please try again.');
    }
}

// Show notification
function showNotification(title, message, clickHandler = null) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: title,
        message: message
    }, (notificationId) => {
        if (clickHandler) {
            chrome.notifications.onClicked.addListener((clickedId) => {
                if (clickedId === notificationId) {
                    clickHandler();
                    chrome.notifications.clear(clickedId);
                }
            });
        }
    });
}

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'summarizePage':
            if (sender.tab) {
                summarizeCurrentPage(sender.tab);
            }
            break;
            
        case 'getPageTitle':
            if (sender.tab) {
                extractTitleFromTab(sender.tab).then(title => {
                    sendResponse({ title });
                });
                return true; // Async response
            }
            break;
            
        case 'updateBadge':
            chrome.action.setBadgeText({
                tabId: sender.tab.id,
                text: request.text || ''
            });
            break;
            
        case 'openOptions':
            chrome.runtime.openOptionsPage();
            break;
    }
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.showNotifications) {
        // Update notification settings
        console.log('Notification settings updated');
    }
});

// Periodic usage stats update
chrome.alarms.create('updateUsage', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'updateUsage') {
        updateUsageStats();
    }
});

// Update usage statistics
async function updateUsageStats() {
    try {
        const auth = await chrome.storage.sync.get(['apiKey', 'token']);
        if (!auth.apiKey) return;

        const response = await fetch('https://your-api-domain.com/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'X-API-Key': auth.apiKey
            }
        });

        const result = await response.json();
        if (result.success) {
            await chrome.storage.local.set({
                'userStats': result.data,
                'lastStatsUpdate': new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Failed to update usage stats:', error);
    }
}

// Extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Wikipedia Summarizer extension started');
});

// Handle extension updates
chrome.runtime.onUpdateAvailable.addListener(() => {
    chrome.runtime.reload();
});
