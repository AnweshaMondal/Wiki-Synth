// Popup JavaScript for Wikipedia Summarizer Chrome Extension

class WikipediaSummarizer {
    constructor() {
        this.apiBaseUrl = 'https://your-api-domain.com/api'; // Replace with your actual API
        this.currentTab = null;
        this.init();
    }

    async init() {
        await this.getCurrentTab();
        this.setupEventListeners();
        this.loadStoredData();
        this.updateUsageStats();
        this.detectWikipediaPage();
    }

    async getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tab;
        } catch (error) {
            console.error('Error getting current tab:', error);
        }
    }

    setupEventListeners() {
        // Main summarize button
        document.getElementById('summarizeBtn').addEventListener('click', () => {
            this.summarizeArticle();
        });

        // Quick summary button
        document.getElementById('quickSummary').addEventListener('click', () => {
            this.quickSummarize();
        });

        // Auto-detect current page button
        document.getElementById('detectBtn').addEventListener('click', () => {
            this.detectWikipediaPage();
        });

        // Copy button
        document.getElementById('copyBtn').addEventListener('click', () => {
            this.copySummary();
        });

        // Save button
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveSummary();
        });

        // Retry button
        document.getElementById('retryBtn').addEventListener('click', () => {
            this.summarizeArticle();
        });

        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettings();
        });

        // Footer links
        document.getElementById('historyLink').addEventListener('click', () => {
            this.openHistory();
        });

        document.getElementById('helpLink').addEventListener('click', () => {
            this.openHelp();
        });

        document.getElementById('upgradeLink').addEventListener('click', () => {
            this.openUpgrade();
        });

        // Input validation
        document.getElementById('wikipediaInput').addEventListener('input', (e) => {
            this.validateInput(e.target.value);
        });

        // Enter key support
        document.getElementById('wikipediaInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.summarizeArticle();
            }
        });
    }

    async detectWikipediaPage() {
        if (!this.currentTab) {
            await this.getCurrentTab();
        }

        if (this.currentTab && this.currentTab.url.includes('wikipedia.org')) {
            // Extract article title from Wikipedia URL
            const url = new URL(this.currentTab.url);
            const pathParts = url.pathname.split('/');
            const title = pathParts[pathParts.length - 1];
            
            if (title && title !== 'wikipedia.org') {
                const decodedTitle = decodeURIComponent(title).replace(/_/g, ' ');
                document.getElementById('wikipediaInput').value = decodedTitle;
                this.validateInput(decodedTitle);
                
                // Visual feedback
                const detectBtn = document.getElementById('detectBtn');
                detectBtn.style.background = '#10b981';
                setTimeout(() => {
                    detectBtn.style.background = '#667eea';
                }, 1000);
            }
        } else {
            this.showToast('Please navigate to a Wikipedia page first', 'warning');
        }
    }

    validateInput(input) {
        const summarizeBtn = document.getElementById('summarizeBtn');
        const quickBtn = document.getElementById('quickSummary');
        
        if (input.trim().length > 0) {
            summarizeBtn.disabled = false;
            quickBtn.disabled = false;
            summarizeBtn.style.opacity = '1';
            quickBtn.style.opacity = '1';
        } else {
            summarizeBtn.disabled = true;
            quickBtn.disabled = true;
            summarizeBtn.style.opacity = '0.6';
            quickBtn.style.opacity = '0.6';
        }
    }

    async summarizeArticle(isQuick = false) {
        const input = document.getElementById('wikipediaInput').value.trim();
        if (!input) {
            this.showToast('Please enter a Wikipedia article title or URL', 'error');
            return;
        }

        const style = isQuick ? 'casual' : document.getElementById('summaryStyle').value;
        const length = isQuick ? 'short' : document.getElementById('summaryLength').value;

        this.showLoading();
        
        try {
            // Check authentication
            const auth = await this.getStoredAuth();
            if (!auth || !auth.apiKey) {
                this.showError('Please configure your API key in settings');
                return;
            }

            // Prepare request data
            const requestData = {
                title: this.extractWikipediaTitle(input),
                style: style,
                length: length,
                source: 'chrome_extension'
            };

            // Make API request
            const response = await this.makeApiRequest('/summary', 'POST', requestData, auth);
            
            if (response.success) {
                this.showResults(response.data);
                await this.updateUsageStats();
                await this.saveSummaryToHistory(input, response.data);
            } else {
                this.showError(response.message || 'Failed to generate summary');
            }

        } catch (error) {
            console.error('Summarization error:', error);
            this.showError(error.message || 'Network error. Please try again.');
        }
    }

    async quickSummarize() {
        await this.summarizeArticle(true);
    }

    extractWikipediaTitle(input) {
        // Handle both URLs and plain titles
        if (input.includes('wikipedia.org')) {
            const url = new URL(input);
            const pathParts = url.pathname.split('/');
            return decodeURIComponent(pathParts[pathParts.length - 1]).replace(/_/g, ' ');
        }
        return input;
    }

    async makeApiRequest(endpoint, method, data, auth) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`,
                'X-API-Key': auth.apiKey
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        return await response.json();
    }

    showLoading() {
        this.hideAllSections();
        document.getElementById('loadingSection').style.display = 'block';
        
        // Simulate progress
        let progress = 0;
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        const progressMessages = [
            'Analyzing article...',
            'Processing content...',
            'Generating summary...',
            'Finalizing results...'
        ];

        const progressInterval = setInterval(() => {
            progress += Math.random() * 25;
            if (progress > 90) progress = 90;
            
            progressFill.style.width = `${progress}%`;
            
            const messageIndex = Math.floor(progress / 25);
            if (progressMessages[messageIndex]) {
                progressText.textContent = progressMessages[messageIndex];
            }
        }, 500);

        // Store interval for cleanup
        this.progressInterval = progressInterval;
    }

    showResults(data) {
        this.hideAllSections();
        clearInterval(this.progressInterval);
        
        document.getElementById('resultsSection').style.display = 'block';
        document.getElementById('summaryContent').innerHTML = this.formatSummary(data.summary);
        
        // Show stats
        const stats = document.getElementById('summaryStats');
        stats.innerHTML = `
            <span>Processed in ${data.processingTime || '2.3'}s</span>
            <span>Tokens: ${data.tokensUsed || 'N/A'}</span>
        `;
    }

    formatSummary(summary) {
        // Basic HTML formatting for better readability
        return summary
            .split('\n\n')
            .map(paragraph => `<p>${paragraph.trim()}</p>`)
            .join('');
    }

    showError(message) {
        this.hideAllSections();
        clearInterval(this.progressInterval);
        
        document.getElementById('errorSection').style.display = 'block';
        document.getElementById('errorMessage').textContent = message;
    }

    hideAllSections() {
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('loadingSection').style.display = 'none';
        document.getElementById('errorSection').style.display = 'none';
    }

    async copySummary() {
        const summaryContent = document.getElementById('summaryContent').textContent;
        try {
            await navigator.clipboard.writeText(summaryContent);
            this.showToast('Summary copied to clipboard!', 'success');
        } catch (error) {
            console.error('Copy failed:', error);
            this.showToast('Failed to copy to clipboard', 'error');
        }
    }

    async saveSummary() {
        const summaryContent = document.getElementById('summaryContent').innerHTML;
        const input = document.getElementById('wikipediaInput').value;
        
        try {
            const saved = await this.getStoredData('savedSummaries') || [];
            saved.unshift({
                id: Date.now(),
                title: input,
                summary: summaryContent,
                timestamp: new Date().toISOString(),
                style: document.getElementById('summaryStyle').value,
                length: document.getElementById('summaryLength').value
            });
            
            // Keep only last 50 summaries
            if (saved.length > 50) saved.splice(50);
            
            await this.setStoredData('savedSummaries', saved);
            this.showToast('Summary saved successfully!', 'success');
        } catch (error) {
            console.error('Save failed:', error);
            this.showToast('Failed to save summary', 'error');
        }
    }

    async saveSummaryToHistory(title, data) {
        try {
            const history = await this.getStoredData('summaryHistory') || [];
            history.unshift({
                id: Date.now(),
                title: title,
                summary: data.summary,
                style: data.style,
                length: data.length,
                timestamp: new Date().toISOString(),
                tokensUsed: data.tokensUsed,
                processingTime: data.processingTime
            });
            
            // Keep only last 100 history items
            if (history.length > 100) history.splice(100);
            
            await this.setStoredData('summaryHistory', history);
        } catch (error) {
            console.error('Failed to save to history:', error);
        }
    }

    async updateUsageStats() {
        try {
            const auth = await this.getStoredAuth();
            if (!auth) return;

            const response = await this.makeApiRequest('/auth/me', 'GET', null, auth);
            if (response.success) {
                const user = response.data;
                document.getElementById('apiCallsCount').textContent = user.monthlyApiCalls || 0;
                
                // Calculate reset time
                const resetDate = new Date(user.monthlyResetDate || Date.now());
                const now = new Date();
                const timeDiff = resetDate - now;
                
                if (timeDiff > 0) {
                    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                    document.getElementById('resetTime').textContent = `${hours}h ${minutes}m`;
                }
            }
        } catch (error) {
            console.error('Failed to update usage stats:', error);
        }
    }

    openSettings() {
        chrome.runtime.openOptionsPage();
    }

    openHistory() {
        chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
    }

    openHelp() {
        chrome.tabs.create({ url: 'https://your-help-url.com' });
    }

    openUpgrade() {
        chrome.tabs.create({ url: 'https://your-upgrade-url.com' });
    }

    showToast(message, type = 'info') {
        // Create and show a toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    async loadStoredData() {
        try {
            const auth = await this.getStoredAuth();
            if (auth && auth.apiKey) {
                document.getElementById('connectionStatus').innerHTML = `
                    <span class="status-dot"></span>
                    <span class="status-text">Connected</span>
                `;
            } else {
                document.getElementById('connectionStatus').innerHTML = `
                    <span class="status-dot" style="background: #ef4444;"></span>
                    <span class="status-text">Not configured</span>
                `;
            }
        } catch (error) {
            console.error('Failed to load stored data:', error);
        }
    }

    async getStoredAuth() {
        const result = await chrome.storage.sync.get(['apiKey', 'token']);
        return result.apiKey ? result : null;
    }

    async getStoredData(key) {
        const result = await chrome.storage.local.get([key]);
        return result[key];
    }

    async setStoredData(key, value) {
        await chrome.storage.local.set({ [key]: value });
    }
}

// Initialize the extension when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WikipediaSummarizer();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
