// Content script for Wikipedia Summarizer Chrome Extension
// Runs on all Wikipedia pages to provide enhanced functionality

class WikipediaContentScript {
    constructor() {
        this.isInjected = false;
        this.widget = null;
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        if (this.isInjected) return;
        this.isInjected = true;

        // Only run on Wikipedia articles
        if (!this.isWikipediaArticle()) return;

        // Add floating summarizer widget
        this.createFloatingWidget();
        
        // Add article enhancements
        this.enhanceArticle();
        
        // Listen for messages from popup
        this.setupMessageListeners();
        
        console.log('Wikipedia Summarizer content script loaded');
    }

    isWikipediaArticle() {
        return window.location.hostname.includes('wikipedia.org') && 
               document.querySelector('#mw-content-text') !== null;
    }

    createFloatingWidget() {
        // Create floating widget container
        this.widget = document.createElement('div');
        this.widget.id = 'wiki-summarizer-widget';
        this.widget.innerHTML = `
            <div class="widget-content">
                <div class="widget-header">
                    <img src="${chrome.runtime.getURL('icons/icon32.png')}" alt="Summarizer">
                    <span>Summarize</span>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="widget-body">
                    <div class="summary-options">
                        <select id="widget-style">
                            <option value="wikipedia">Wikipedia Style</option>
                            <option value="academic">Academic</option>
                            <option value="casual">Casual</option>
                            <option value="technical">Technical</option>
                        </select>
                        <select id="widget-length">
                            <option value="short">Short</option>
                            <option value="medium" selected>Medium</option>
                            <option value="long">Long</option>
                        </select>
                    </div>
                    <div class="widget-actions">
                        <button id="widget-summarize" class="btn-primary">Summarize</button>
                        <button id="widget-quick" class="btn-secondary">Quick</button>
                    </div>
                    <div class="widget-result" id="widget-result" style="display: none;">
                        <div class="result-header">
                            <span>Summary</span>
                            <div class="result-actions">
                                <button id="widget-copy" title="Copy">📋</button>
                                <button id="widget-save" title="Save">💾</button>
                                <button id="widget-expand" title="Expand">⛶</button>
                            </div>
                        </div>
                        <div class="result-content" id="widget-summary"></div>
                    </div>
                    <div class="widget-loading" id="widget-loading" style="display: none;">
                        <div class="loading-spinner"></div>
                        <span>Generating summary...</span>
                    </div>
                </div>
            </div>
        `;

        // Add to page
        document.body.appendChild(this.widget);

        // Setup widget event listeners
        this.setupWidgetListeners();

        // Make widget draggable
        this.makeDraggable();
    }

    setupWidgetListeners() {
        // Close button
        this.widget.querySelector('.close-btn').addEventListener('click', () => {
            this.hideWidget();
        });

        // Summarize button
        this.widget.querySelector('#widget-summarize').addEventListener('click', () => {
            this.summarizeFromWidget();
        });

        // Quick summarize button
        this.widget.querySelector('#widget-quick').addEventListener('click', () => {
            this.summarizeFromWidget(true);
        });

        // Copy button
        this.widget.querySelector('#widget-copy').addEventListener('click', () => {
            this.copyWidgetSummary();
        });

        // Save button
        this.widget.querySelector('#widget-save').addEventListener('click', () => {
            this.saveWidgetSummary();
        });

        // Expand button
        this.widget.querySelector('#widget-expand').addEventListener('click', () => {
            this.expandSummary();
        });
    }

    makeDraggable() {
        const header = this.widget.querySelector('.widget-header');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('close-btn')) return;
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            this.widget.style.transform = `translate(${currentX}px, ${currentY}px)`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'grab';
        });
    }

    enhanceArticle() {
        // Add summarize button to article header
        const articleHeader = document.querySelector('.mw-page-title-main') || 
                             document.querySelector('h1.firstHeading') ||
                             document.querySelector('#firstHeading');

        if (articleHeader) {
            const summaryBtn = document.createElement('button');
            summaryBtn.id = 'article-summary-btn';
            summaryBtn.innerHTML = `
                <img src="${chrome.runtime.getURL('icons/icon16.png')}" alt="">
                Summarize
            `;
            summaryBtn.addEventListener('click', () => this.showWidget());

            // Insert after the title
            articleHeader.parentNode.insertBefore(summaryBtn, articleHeader.nextSibling);
        }

        // Add section summary buttons
        this.addSectionSummaryButtons();

        // Highlight key sentences (optional feature)
        this.highlightKeySentences();
    }

    addSectionSummaryButtons() {
        const sections = document.querySelectorAll('.mw-headline');
        sections.forEach((section, index) => {
            if (index === 0) return; // Skip the main title

            const summaryBtn = document.createElement('button');
            summaryBtn.className = 'section-summary-btn';
            summaryBtn.innerHTML = '📄';
            summaryBtn.title = 'Summarize this section';
            summaryBtn.addEventListener('click', () => {
                this.summarizeSection(section);
            });

            section.appendChild(summaryBtn);
        });
    }

    highlightKeySentences() {
        // Simple algorithm to highlight potentially important sentences
        const paragraphs = document.querySelectorAll('#mw-content-text p');
        
        paragraphs.forEach(paragraph => {
            const sentences = paragraph.textContent.split(/[.!?]+/);
            const text = paragraph.innerHTML;
            
            // Look for sentences with key indicators
            sentences.forEach(sentence => {
                if (this.isKeySentence(sentence.trim())) {
                    const highlightedText = text.replace(
                        sentence.trim(),
                        `<span class="key-sentence" title="Key information">${sentence.trim()}</span>`
                    );
                    paragraph.innerHTML = highlightedText;
                }
            });
        });
    }

    isKeySentence(sentence) {
        const keyPhrases = [
            'is a', 'was a', 'are', 'were',
            'founded', 'established', 'created',
            'known for', 'famous for',
            'first', 'last', 'most',
            'important', 'significant',
            'located', 'situated'
        ];

        return keyPhrases.some(phrase => 
            sentence.toLowerCase().includes(phrase)
        ) && sentence.length > 50 && sentence.length < 200;
    }

    showWidget() {
        this.widget.classList.add('visible');
        
        // Auto-detect current article
        const title = this.getCurrentArticleTitle();
        if (title) {
            // Could pre-fill options based on article type
            this.optimizeOptionsForArticle(title);
        }
    }

    hideWidget() {
        this.widget.classList.remove('visible');
        
        // Hide result if showing
        document.getElementById('widget-result').style.display = 'none';
        document.getElementById('widget-loading').style.display = 'none';
    }

    getCurrentArticleTitle() {
        const titleElement = document.querySelector('.mw-page-title-main') || 
                           document.querySelector('h1.firstHeading') ||
                           document.querySelector('#firstHeading');
        return titleElement ? titleElement.textContent.trim() : null;
    }

    optimizeOptionsForArticle(title) {
        // Simple heuristics to suggest optimal summary settings
        const style = document.getElementById('widget-style');
        const length = document.getElementById('widget-length');

        // Check if it's a person, place, or concept
        if (this.isPersonArticle()) {
            style.value = 'casual';
            length.value = 'medium';
        } else if (this.isScientificArticle()) {
            style.value = 'technical';
            length.value = 'long';
        } else if (this.isHistoricalArticle()) {
            style.value = 'academic';
            length.value = 'medium';
        }
    }

    isPersonArticle() {
        const infobox = document.querySelector('.infobox');
        return infobox && (
            infobox.textContent.includes('Born') ||
            infobox.textContent.includes('Died') ||
            document.querySelector('.infobox-person')
        );
    }

    isScientificArticle() {
        const categories = document.querySelectorAll('#mw-normal-catlinks a');
        const scientificTerms = ['science', 'physics', 'chemistry', 'biology', 'mathematics'];
        
        return Array.from(categories).some(cat => 
            scientificTerms.some(term => 
                cat.textContent.toLowerCase().includes(term)
            )
        );
    }

    isHistoricalArticle() {
        const text = document.body.textContent.toLowerCase();
        const historicalTerms = ['century', 'ancient', 'medieval', 'war', 'empire', 'kingdom'];
        
        return historicalTerms.some(term => text.includes(term));
    }

    async summarizeFromWidget(isQuick = false) {
        const title = this.getCurrentArticleTitle();
        if (!title) {
            this.showWidgetError('Could not detect article title');
            return;
        }

        const style = isQuick ? 'casual' : document.getElementById('widget-style').value;
        const length = isQuick ? 'short' : document.getElementById('widget-length').value;

        this.showWidgetLoading();

        try {
            // Send message to background script
            const response = await chrome.runtime.sendMessage({
                action: 'summarizeArticle',
                title: title,
                style: style,
                length: length
            });

            if (response && response.success) {
                this.showWidgetResult(response.data);
            } else {
                this.showWidgetError(response?.message || 'Failed to generate summary');
            }
        } catch (error) {
            console.error('Widget summarization error:', error);
            this.showWidgetError('Network error. Please try again.');
        }
    }

    showWidgetLoading() {
        document.getElementById('widget-result').style.display = 'none';
        document.getElementById('widget-loading').style.display = 'block';
    }

    showWidgetResult(data) {
        document.getElementById('widget-loading').style.display = 'none';
        
        const resultDiv = document.getElementById('widget-result');
        const summaryDiv = document.getElementById('widget-summary');
        
        summaryDiv.innerHTML = this.formatSummary(data.summary);
        resultDiv.style.display = 'block';
        
        // Store current summary for actions
        this.currentSummary = data;
    }

    showWidgetError(message) {
        document.getElementById('widget-loading').style.display = 'none';
        
        const resultDiv = document.getElementById('widget-result');
        const summaryDiv = document.getElementById('widget-summary');
        
        summaryDiv.innerHTML = `<div class="error">❌ ${message}</div>`;
        resultDiv.style.display = 'block';
    }

    formatSummary(summary) {
        return summary
            .split('\n\n')
            .map(paragraph => `<p>${paragraph.trim()}</p>`)
            .join('');
    }

    async copyWidgetSummary() {
        if (!this.currentSummary) return;
        
        try {
            await navigator.clipboard.writeText(this.currentSummary.summary);
            this.showWidgetToast('Summary copied to clipboard!');
        } catch (error) {
            console.error('Copy failed:', error);
        }
    }

    async saveWidgetSummary() {
        if (!this.currentSummary) return;
        
        try {
            await chrome.runtime.sendMessage({
                action: 'saveSummary',
                data: {
                    title: this.getCurrentArticleTitle(),
                    summary: this.currentSummary.summary,
                    timestamp: new Date().toISOString()
                }
            });
            this.showWidgetToast('Summary saved!');
        } catch (error) {
            console.error('Save failed:', error);
        }
    }

    expandSummary() {
        // Open full summary in popup
        chrome.runtime.sendMessage({
            action: 'openFullSummary',
            data: this.currentSummary
        });
    }

    showWidgetToast(message) {
        const toast = document.createElement('div');
        toast.className = 'widget-toast';
        toast.textContent = message;
        
        this.widget.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    summarizeSection(sectionHeader) {
        // Get section content
        const sectionContent = this.getSectionContent(sectionHeader);
        console.log('Section content for summary:', sectionContent);
        
        // For now, just show a placeholder
        this.showWidgetToast(`Section "${sectionHeader.textContent}" selected for summary`);
    }

    getSectionContent(sectionHeader) {
        const content = [];
        let element = sectionHeader.closest('.mw-headline').parentElement.nextElementSibling;
        
        while (element && !element.querySelector('.mw-headline')) {
            if (element.tagName === 'P') {
                content.push(element.textContent);
            }
            element = element.nextElementSibling;
        }
        
        return content.join('\n\n');
    }

    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'getArticleTitle':
                    sendResponse({ title: this.getCurrentArticleTitle() });
                    break;
                    
                case 'showSummaryWidget':
                    this.showWidget();
                    break;
                    
                case 'hideSummaryWidget':
                    this.hideWidget();
                    break;
            }
        });
    }
}

// Initialize content script
if (!window.wikipediaSummarizerContentScript) {
    window.wikipediaSummarizerContentScript = new WikipediaContentScript();
}
