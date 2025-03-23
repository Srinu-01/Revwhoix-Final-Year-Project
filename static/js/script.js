document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const keywordInput = document.getElementById('keywordInput');
    const searchButton = document.getElementById('searchButton');
    const exampleChips = document.querySelectorAll('.example-chip');
    const loadingElement = document.getElementById('loading');
    const resultsElement = document.getElementById('results');
    const noResultsElement = document.getElementById('noResults');
    const errorElement = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');
    const domainsGrid = document.getElementById('domainsGrid');
    const searchKeywordElement = document.getElementById('searchKeyword');
    const domainCountElement = document.getElementById('domainCount');
    const copyAllButton = document.getElementById('copyAll');
    const exportCSVButton = document.getElementById('exportCSV');
    const filterInput = document.getElementById('filterInput');
    const prevPageButton = document.getElementById('prevPage');
    const nextPageButton = document.getElementById('nextPage');
    const pageIndicator = document.getElementById('pageIndicator');
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    // Benefits section animations
    const benefitsSection = document.getElementById('benefits');
    const benefitCards = document.querySelectorAll('.benefit-card');
    
    // Intersection Observer for benefits section
    const benefitsSectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                benefitsSection.classList.add('visible');
                animateBenefitCards();
                benefitsSectionObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });
    
    if (benefitsSection) {
        benefitsSectionObserver.observe(benefitsSection);
    }
    
    function animateBenefitCards() {
        benefitCards.forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('animate');
            }, 200 * index);
        });
    }
    
    // Add 3D tilt effect to benefit cards
    benefitCards.forEach(card => {
        card.addEventListener('mousemove', handleTilt);
        card.addEventListener('mouseleave', resetTilt);
    });
    
    function handleTilt(e) {
        const card = this;
        const cardRect = card.getBoundingClientRect();
        const cardCenterX = cardRect.left + cardRect.width / 2;
        const cardCenterY = cardRect.top + cardRect.height / 2;
        const mouseX = e.clientX - cardCenterX;
        const mouseY = e.clientY - cardCenterY;
        
        // Limit the tilt range
        const tiltX = (mouseY / cardRect.height * 10).toFixed(2);
        const tiltY = -(mouseX / cardRect.width * 10).toFixed(2);
        
        card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-10px)`;
    }
    
    function resetTilt() {
        this.style.transform = '';
    }
    
    // State
    let allDomains = [];
    let filteredDomains = [];
    let currentPage = 1;
    const domainsPerPage = 30;
    
    // Event Listeners
    searchButton.addEventListener('click', performSearch);
    keywordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    exampleChips.forEach(chip => {
        chip.addEventListener('click', function() {
            const keyword = this.getAttribute('data-keyword');
            keywordInput.value = keyword;
            performSearch();
        });
    });
    
    copyAllButton.addEventListener('click', copyAllDomains);
    exportCSVButton.addEventListener('click', exportDomainsAsCSV);
    filterInput.addEventListener('input', handleFilter);
    prevPageButton.addEventListener('click', goToPrevPage);
    nextPageButton.addEventListener('click', goToNextPage);
    
    // Functions
    function performSearch() {
        const keyword = keywordInput.value.trim();
        
        if (!keyword) {
            showNotification('Please enter a keyword', 'error');
            keywordInput.focus();
            return;
        }
        
        // Reset state
        resetState();
        
        // Show loading
        hideAllContainers();
        loadingElement.style.display = 'flex';
        
        // Make API request
        fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ keyword })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.message || `HTTP error ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            // Hide loading
            loadingElement.style.display = 'none';
            
            if (data.status === 'success' && data.domains && data.domains.length > 0) {
                // Update state
                allDomains = data.domains;
                filteredDomains = [...allDomains];
                
                // Update UI
                searchKeywordElement.textContent = data.keyword;
                domainCountElement.textContent = data.count.toLocaleString();
                
                // Render domains
                renderDomains();
                
                // Show results
                resultsElement.style.display = 'block';
                
                // Scroll to results with smooth animation
                resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
            } else if (data.status === 'success' && (!data.domains || data.domains.length === 0)) {
                // No results
                noResultsElement.style.display = 'block';
            } else {
                // Error
                errorMessage.textContent = data.message || 'An error occurred while fetching domains.';
                errorElement.style.display = 'block';
            }
        })
        .catch(error => {
            // Hide loading
            loadingElement.style.display = 'none';
            
            // Show error
            console.error('Error:', error);
            errorMessage.textContent = error.message || 'An error occurred while fetching domains.';
            errorElement.style.display = 'block';
        });
    }
    
    function resetState() {
        allDomains = [];
        filteredDomains = [];
        currentPage = 1;
        filterInput.value = '';
    }
    
    function hideAllContainers() {
        resultsElement.style.display = 'none';
        noResultsElement.style.display = 'none';
        errorElement.style.display = 'none';
        loadingElement.style.display = 'none';
    }
    
    function renderDomains() {
        // Clear grid
        domainsGrid.innerHTML = '';
        
        // Calculate pagination
        const totalPages = Math.ceil(filteredDomains.length / domainsPerPage);
        const startIndex = (currentPage - 1) * domainsPerPage;
        const endIndex = Math.min(startIndex + domainsPerPage, filteredDomains.length);
        
        // Update pagination controls
        pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
        prevPageButton.disabled = currentPage === 1;
        nextPageButton.disabled = currentPage === totalPages;
        
        // Render domains for current page
        for (let i = startIndex; i < endIndex; i++) {
            const domain = filteredDomains[i];
            const domainCard = createDomainCard(domain);
            domainsGrid.appendChild(domainCard);
        }
        
        // If no domains to show after filtering
        if (filteredDomains.length === 0) {
            const noDomainsEl = document.createElement('div');
            noDomainsEl.className = 'no-domains-message';
            noDomainsEl.textContent = 'No domains match your filter criteria.';
            noDomainsEl.style.gridColumn = '1 / -1';
            noDomainsEl.style.padding = '2rem 0';
            noDomainsEl.style.textAlign = 'center';
            noDomainsEl.style.color = 'var(--light-text)';
            domainsGrid.appendChild(noDomainsEl);
        }
        
        // Add staggered animation to domain cards
        const cards = document.querySelectorAll('.domain-card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.05}s`;
            card.classList.add('fade-in');
        });
    }
    
    function createDomainCard(domain) {
        const card = document.createElement('div');
        card.className = 'domain-card';
        
        const domainName = document.createElement('div');
        domainName.className = 'domain-name';
        domainName.textContent = domain;
        
        const actions = document.createElement('div');
        actions.className = 'domain-actions';
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'domain-action-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.title = 'Copy domain';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(domain)
                .then(() => showNotification(`Copied ${domain} to clipboard`))
                .catch(() => showNotification('Failed to copy to clipboard', 'error'));
        });
        
        const visitBtn = document.createElement('button');
        visitBtn.className = 'domain-action-btn';
        visitBtn.innerHTML = '<i class="fas fa-external-link-alt"></i>';
        visitBtn.title = 'Visit domain';
        visitBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(`https://${domain}`, '_blank');
        });
        
        actions.appendChild(copyBtn);
        actions.appendChild(visitBtn);
        
        card.appendChild(domainName);
        card.appendChild(actions);
        
        // Main card click opens the domain
        card.addEventListener('click', () => {
            window.open(`https://${domain}`, '_blank');
        });
        
        return card;
    }
    
    function handleFilter() {
        const filterValue = filterInput.value.toLowerCase();
        
        if (filterValue) {
            filteredDomains = allDomains.filter(domain => 
                domain.toLowerCase().includes(filterValue)
            );
        } else {
            filteredDomains = [...allDomains];
        }
        
        // Reset to first page when filtering
        currentPage = 1;
        renderDomains();
    }
    
    function goToPrevPage() {
        if (currentPage > 1) {
            currentPage--;
            renderDomains();
            // Smooth scroll to top of results
            resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    
    function goToNextPage() {
        const totalPages = Math.ceil(filteredDomains.length / domainsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderDomains();
            // Smooth scroll to top of results
            resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    
    function copyAllDomains() {
        if (filteredDomains.length === 0) {
            showNotification('No domains to copy', 'warning');
            return;
        }
        
        navigator.clipboard.writeText(filteredDomains.join('\n'))
            .then(() => showNotification(`Copied ${filteredDomains.length} domains to clipboard`))
            .catch(() => showNotification('Failed to copy to clipboard', 'error'));
    }
    
    function exportDomainsAsCSV() {
        if (filteredDomains.length === 0) {
            showNotification('No domains to export', 'warning');
            return;
        }
        
        const csvContent = 'data:text/csv;charset=utf-8,' + filteredDomains.join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `revwhoix-domains-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification(`Exported ${filteredDomains.length} domains as CSV`);
    }
    
    function showNotification(message, type = 'success') {
        // Set notification color based on type
        notification.style.background = type === 'success' 
            ? 'var(--success)' 
            : type === 'warning' 
                ? 'var(--warning)' 
                : 'var(--error)';
        
        // Update icon based on type
        const iconElement = notification.querySelector('i');
        iconElement.className = type === 'success' 
            ? 'fas fa-check-circle' 
            : type === 'warning' 
                ? 'fas fa-exclamation-circle' 
                : 'fas fa-times-circle';
        
        // Set message
        notificationText.textContent = message;
        
        // Show notification
        notification.classList.add('show');
        
        // Hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // Add these styles to make the animations work
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .fade-in {
            animation: fadeIn 0.5s ease forwards;
            opacity: 0;
        }
        
        .domain-card {
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .domain-card:hover {
            transform: translateY(-5px) scale(1.02);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        
        .domain-card:active {
            transform: translateY(-2px) scale(0.98);
        }
    `;
    document.head.appendChild(style);
});
