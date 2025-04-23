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
    
    // New elements for domain details
    const domainDetailsModal = document.createElement('div');
    domainDetailsModal.id = 'domainDetailsModal';
    domainDetailsModal.className = 'modal';
    document.body.appendChild(domainDetailsModal);
    
    // Functions
    function performSearch(tryAlternative = false) {
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
            body: JSON.stringify({ 
                keyword,
                try_alternative: tryAlternative 
            })
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    // Custom handling for "not found" errors
                    return response.json().then(data => {
                        throw new Error(data.message || 'No domains found');
                    });
                }
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
                
                // If there's a note about alternative search, show notification
                if (data.note) {
                    showNotification(data.note, 'info');
                }
                
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
            
            if (!tryAlternative && error.message && 
                (error.message.includes('No domains found') || 
                 error.message.includes('not found'))) {
                // Try again with alternative search methods
                performSearch(true);
                return;
            }
            
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
        
        const detailsBtn = document.createElement('button');
        detailsBtn.className = 'domain-action-btn';
        detailsBtn.innerHTML = '<i class="fas fa-info-circle"></i>';
        detailsBtn.title = 'View domain details';
        detailsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showDomainDetails(domain);
        });
        
        actions.appendChild(copyBtn);
        actions.appendChild(visitBtn);
        actions.appendChild(detailsBtn);
        
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
        notification.style.background = 
            type === 'success' ? 'var(--success)' : 
            type === 'warning' ? 'var(--warning)' : 
            type === 'info' ? 'var(--primary)' :
            'var(--error)';
        
        // Update icon based on type
        const iconElement = notification.querySelector('i');
        iconElement.className = 
            type === 'success' ? 'fas fa-check-circle' : 
            type === 'warning' ? 'fas fa-exclamation-circle' :
            type === 'info' ? 'fas fa-info-circle' :
            'fas fa-times-circle';
        
        // Set message
        notificationText.textContent = message;
        
        // Show notification
        notification.classList.add('show');
        
        // Hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    function showDomainDetails(domain) {
        // Create modal content
        domainDetailsModal.innerHTML = `
            <div class="modal-content">
                <span class="modal-close">&times;</span>
                <h2 class="modal-title">Domain Details: ${domain}</h2>
                <div class="domain-details-content">
                    <div class="loading-indicator">
                        <div class="spinner"></div>
                        <p>Fetching domain information...</p>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="modal-action-btn visit-btn">
                        <i class="fas fa-external-link-alt"></i> Visit Site
                    </button>
                    <button class="modal-action-btn whois-btn">
                        <i class="fas fa-search"></i> WHOIS Lookup
                    </button>
                </div>
            </div>
        `;
        
        // Show modal
        domainDetailsModal.style.display = 'block';
        
        // Add event listeners
        const closeBtn = domainDetailsModal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => {
            domainDetailsModal.style.display = 'none';
        });
        
        // Close on click outside
        window.addEventListener('click', (e) => {
            if (e.target === domainDetailsModal) {
                domainDetailsModal.style.display = 'none';
            }
        });
        
        const visitBtn = domainDetailsModal.querySelector('.visit-btn');
        visitBtn.addEventListener('click', () => {
            window.open(`https://${domain}`, '_blank');
        });
        
        const whoisBtn = domainDetailsModal.querySelector('.whois-btn');
        whoisBtn.addEventListener('click', () => {
            window.open(`https://whois.domaintools.com/${domain}`, '_blank');
        });
        
        // Fetch domain information
        fetchDomainInfo(domain);
    }
    
    function fetchDomainInfo(domain) {
        const detailsContent = domainDetailsModal.querySelector('.domain-details-content');
        
        fetch(`/api/domain-info?domain=${encodeURIComponent(domain)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch domain information');
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'success') {
                    renderDomainInfo(detailsContent, data.info, domain);
                } else {
                    throw new Error(data.message || 'Failed to fetch domain information');
                }
            })
            .catch(error => {
                detailsContent.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>${error.message || 'An error occurred while fetching domain information'}</p>
                    </div>
                    <div class="domain-info-basic">
                        <div class="info-item">
                            <span class="info-label">Domain:</span>
                            <span class="info-value">${domain}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Status:</span>
                            <span class="info-value">Unable to fetch details</span>
                        </div>
                    </div>
                `;
            });
    }
    
    function renderDomainInfo(container, info, domain) {
        // Format dates
        const formatDate = (dateStr) => {
            if (!dateStr) return 'Not available';
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr; // If date parsing fails, just return original string
            return date.toLocaleString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };
        
        // Get information from the domain info object
        const created = info.created ? formatDate(info.created) : 'Unknown';
        const updated = info.updated ? formatDate(info.updated) : 'Unknown';
        const expires = info.expires ? formatDate(info.expires) : 'Unknown';
        const registrar = info.registrar || 'Unknown';
        const nameservers = info.nameservers || [];
        const statuses = info.statuses || [];
        const ipAddress = info.ip_address || 'Unknown';
        const geolocation = info.geolocation || {};
        const dnsRecords = info.dns_records || {};
        
        // Format contacts
        const formatContact = (contact) => {
            if (!contact || (!contact.name && !contact.organization && !contact.email)) {
                return '<p class="no-data">Contact information not available or protected</p>';
            }
            
            let html = '<div class="contact-details">';
            
            if (contact.name) {
                html += `<div class="contact-item"><span>Name:</span> ${contact.name}</div>`;
            }
            
            if (contact.organization) {
                html += `<div class="contact-item"><span>Organization:</span> ${contact.organization}</div>`;
            }
            
            if (contact.email) {
                html += `<div class="contact-item"><span>Email:</span> ${contact.email}</div>`;
            }
            
            if (contact.phone) {
                html += `<div class="contact-item"><span>Phone:</span> ${contact.phone}</div>`;
            }
            
            // Location information
            let location = [];
            if (contact.city) location.push(contact.city);
            if (contact.state) location.push(contact.state);
            if (contact.country) location.push(contact.country);
            
            if (location.length > 0) {
                html += `<div class="contact-item"><span>Location:</span> ${location.join(', ')}</div>`;
            }
            
            html += '</div>';
            return html;
        };
        
        // Format nameservers
        let nameserversHtml = '<p class="no-data">No nameservers found</p>';
        if (nameservers && nameservers.length > 0) {
            nameserversHtml = '<ul class="nameservers-list">';
            nameservers.forEach(ns => {
                nameserversHtml += `<li>${ns}</li>`;
            });
            nameserversHtml += '</ul>';
        }
        
        // Format statuses
        let statusesHtml = '<p class="no-data">No status information available</p>';
        if (statuses && statuses.length > 0) {
            statusesHtml = '<ul class="status-list">';
            statuses.forEach(status => {
                statusesHtml += `<li>${status}</li>`;
            });
            statusesHtml += '</ul>';
        }
        
        // Format geolocation
        let locationHtml = '<p class="no-data">Location information not available</p>';
        if (geolocation && (geolocation.country || geolocation.city)) {
            locationHtml = '<div class="geolocation-details">';
            
            if (geolocation.city || geolocation.region || geolocation.country) {
                let location = [];
                if (geolocation.city) location.push(geolocation.city);
                if (geolocation.region) location.push(geolocation.region);
                if (geolocation.country) location.push(geolocation.country);
                
                locationHtml += `<div class="geo-item"><span>Location:</span> ${location.join(', ')}</div>`;
            }
            
            if (geolocation.latitude && geolocation.longitude) {
                locationHtml += `<div class="geo-item"><span>Coordinates:</span> ${geolocation.latitude}, ${geolocation.longitude}</div>`;
            }
            
            if (geolocation.org) {
                locationHtml += `<div class="geo-item"><span>Organization:</span> ${geolocation.org}</div>`;
            }
            
            if (geolocation.asn) {
                locationHtml += `<div class="geo-item"><span>ASN:</span> ${geolocation.asn}</div>`;
            }
            
            locationHtml += '</div>';
        }
        
        // Format DNS records
        let dnsRecordsHtml = '';
        
        // A records
        if (dnsRecords.a && dnsRecords.a.length > 0) {
            dnsRecordsHtml += '<div class="dns-section"><h5>A Records (IPv4)</h5><ul class="dns-list">';
            dnsRecords.a.forEach(record => {
                dnsRecordsHtml += `<li>${record}</li>`;
            });
            dnsRecordsHtml += '</ul></div>';
        }
        
        // AAAA records
        if (dnsRecords.aaaa && dnsRecords.aaaa.length > 0) {
            dnsRecordsHtml += '<div class="dns-section"><h5>AAAA Records (IPv6)</h5><ul class="dns-list">';
            dnsRecords.aaaa.forEach(record => {
                dnsRecordsHtml += `<li>${record}</li>`;
            });
            dnsRecordsHtml += '</ul></div>';
        }
        
        // MX records
        if (dnsRecords.mx && dnsRecords.mx.length > 0) {
            dnsRecordsHtml += '<div class="dns-section"><h5>MX Records (Mail)</h5><ul class="dns-list">';
            dnsRecords.mx.forEach(record => {
                dnsRecordsHtml += `<li>Priority ${record.preference}: ${record.exchange}</li>`;
            });
            dnsRecordsHtml += '</ul></div>';
        }
        
        // TXT records
        if (dnsRecords.txt && dnsRecords.txt.length > 0) {
            dnsRecordsHtml += '<div class="dns-section"><h5>TXT Records</h5><ul class="dns-list">';
            dnsRecords.txt.forEach(record => {
                dnsRecordsHtml += `<li>${record}</li>`;
            });
            dnsRecordsHtml += '</ul></div>';
        }
        
        // NS records
        if (dnsRecords.ns && dnsRecords.ns.length > 0) {
            dnsRecordsHtml += '<div class="dns-section"><h5>NS Records</h5><ul class="dns-list">';
            dnsRecords.ns.forEach(record => {
                dnsRecordsHtml += `<li>${record}</li>`;
            });
            dnsRecordsHtml += '</ul></div>';
        }
        
        // CNAME records
        if (dnsRecords.cname && dnsRecords.cname.length > 0) {
            dnsRecordsHtml += '<div class="dns-section"><h5>CNAME Records</h5><ul class="dns-list">';
            dnsRecords.cname.forEach(record => {
                dnsRecordsHtml += `<li>${record}</li>`;
            });
            dnsRecordsHtml += '</ul></div>';
        }
        
        // If no DNS records, show a message
        if (!dnsRecordsHtml) {
            dnsRecordsHtml = '<p class="no-data">No DNS records found</p>';
        }
        
        // Build the complete HTML
        container.innerHTML = `
            <div class="domain-info-container">
                <div class="domain-info-section">
                    <h3>Registration Information</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Domain Name:</span>
                            <span class="info-value">${domain}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">IP Address:</span>
                            <span class="info-value">${ipAddress}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Created:</span>
                            <span class="info-value">${created}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Last Updated:</span>
                            <span class="info-value">${updated}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Expires:</span>
                            <span class="info-value">${expires}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Registrar:</span>
                            <span class="info-value">${registrar}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">DNSSEC:</span>
                            <span class="info-value">${info.dnssec || 'Not available'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="domain-info-tabs">
                    <div class="tab-header">
                        <button class="tab-btn active" data-tab="registrant">Registrant</button>
                        <button class="tab-btn" data-tab="admin">Admin</button>
                        <button class="tab-btn" data-tab="tech">Technical</button>
                        <button class="tab-btn" data-tab="nameservers">Name Servers</button>
                        <button class="tab-btn" data-tab="status">Status</button>
                        <button class="tab-btn" data-tab="location">Location</button>
                        <button class="tab-btn" data-tab="dns">DNS Records</button>
                    </div>
                    
                    <div class="tab-content">
                        <div class="tab-pane active" id="tab-registrant">
                            <h4>Registrant Information</h4>
                            ${formatContact(info.registrant)}
                        </div>
                        
                        <div class="tab-pane" id="tab-admin">
                            <h4>Administrative Contact</h4>
                            ${formatContact(info.admin)}
                        </div>
                        
                        <div class="tab-pane" id="tab-tech">
                            <h4>Technical Contact</h4>
                            ${formatContact(info.tech)}
                        </div>
                        
                        <div class="tab-pane" id="tab-nameservers">
                            <h4>Name Servers</h4>
                            ${nameserversHtml}
                        </div>
                        
                        <div class="tab-pane" id="tab-status">
                            <h4>Domain Status</h4>
                            ${statusesHtml}
                        </div>
                        
                        <div class="tab-pane" id="tab-location">
                            <h4>Server Location</h4>
                            ${locationHtml}
                        </div>
                        
                        <div class="tab-pane" id="tab-dns">
                            <h4>DNS Records</h4>
                            ${dnsRecordsHtml}
                        </div>
                    </div>
                </div>
                
                ${info.rawText ? 
                  `<div class="raw-whois">
                      <h4>Raw WHOIS Data</h4>
                      <button class="toggle-raw-btn">Show Raw Data</button>
                      <pre class="raw-whois-data" style="display: none;">${info.rawText}</pre>
                   </div>` : ''}
            </div>
        `;
        
        // Add tab functionality
        const tabBtns = container.querySelectorAll('.tab-btn');
        const tabPanes = container.querySelectorAll('.tab-pane');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Deactivate all buttons and panes
                tabBtns.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));
                
                // Activate the clicked button and corresponding pane
                btn.classList.add('active');
                const tabId = `tab-${btn.getAttribute('data-tab')}`;
                document.getElementById(tabId).classList.add('active');
            });
        });
        
        // Add raw WHOIS toggle functionality
        const toggleRawBtn = container.querySelector('.toggle-raw-btn');
        const rawWhoisData = container.querySelector('.raw-whois-data');
        
        if (toggleRawBtn && rawWhoisData) {
            toggleRawBtn.addEventListener('click', () => {
                if (rawWhoisData.style.display === 'none') {
                    rawWhoisData.style.display = 'block';
                    toggleRawBtn.textContent = 'Hide Raw Data';
                } else {
                    rawWhoisData.style.display = 'none';
                    toggleRawBtn.textContent = 'Show Raw Data';
                }
            });
        }
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

    // Add these styles to make the modal and animations work
    const modalStyle = document.createElement('style');
    modalStyle.textContent = `
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            overflow: auto;
        }
        
        .modal-content {
            background: var(--card-bg);
            margin: 10% auto;
            max-width: 600px;
            border-radius: 12px;
            box-shadow: 0 5px 30px rgba(0,0,0,0.3);
            position: relative;
            animation: modalFadeIn 0.3s ease;
            overflow: hidden;
        }
        
        @keyframes modalFadeIn {
            from { opacity: 0; transform: translateY(-30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .modal-close {
            position: absolute;
            top: 15px;
            right: 20px;
            color: var(--light-text);
            font-size: 24px;
            font-weight: bold;
            cursor: pointer;
        }
        
        .modal-title {
            padding: 20px;
            margin: 0;
            background: linear-gradient(to right, var(--primary), var(--secondary));
            color: white;
            font-size: 18px;
        }
        
        .domain-details-content {
            padding: 20px;
            min-height: 200px;
        }
        
        .loading-indicator {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 150px;
        }
        
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(99, 102, 241, 0.1);
            border-left-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        .domain-info {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .info-section h3 {
            margin-bottom: 15px;
            font-size: 16px;
            color: var(--primary);
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        
        .info-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .info-label {
            color: var(--light-text);
            font-size: 12px;
        }
        
        .info-value {
            font-weight: 500;
        }
        
        .nameservers-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .nameservers-list li {
            padding: 8px 12px;
            background: rgba(99, 102, 241, 0.1);
            border-radius: 4px;
            font-size: 14px;
        }
        
        .error-message {
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--error);
            margin-bottom: 20px;
        }
        
        .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 15px 20px;
            background: rgba(0,0,0,0.03);
            border-top: 1px solid var(--border);
        }
        
        .modal-action-btn {
            padding: 8px 16px;
            border-radius: 6px;
            border: none;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .visit-btn {
            background: var(--primary);
            color: white;
        }
        
        .visit-btn:hover {
            background: var(--primary-dark);
        }
        
        .whois-btn {
            background: var(--bg);
            color: var(--text);
            border: 1px solid var(--border);
        }
        
        .whois-btn:hover {
            background: var(--border);
        }
        
        @media (max-width: 768px) {
            .modal-content {
                width: 90%;
                margin: 20% auto;
            }
            
            .info-grid {
                grid-template-columns: 1fr;
            }
        }
    `;
    document.head.appendChild(modalStyle);

    // Add these styles for domain details
    const detailsStyle = document.createElement('style');
    detailsStyle.textContent = `
        /* ...existing modal styles... */
        
        .domain-info-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .tab-pane {
            display: none;
            padding: 15px 0;
        }
        
        .tab-pane.active {
            display: block;
            animation: fadeIn 0.3s ease;
        }
        
        .tab-header {
            display: flex;
            border-bottom: 1px solid var(--border);
            overflow-x: auto;
            scrollbar-width: thin;
        }
        
        .tab-btn {
            padding: 10px 15px;
            background: transparent;
            border: none;
            border-bottom: 2px solid transparent;
            cursor: pointer;
            font-weight: 500;
            color: var(--light-text);
            transition: all 0.2s ease;
        }
        
        .tab-btn.active {
            border-bottom: 2px solid var(--primary);
            color: var(--primary);
        }
        
        .tab-btn:hover:not(.active) {
            color: var(--text);
            background-color: rgba(99, 102, 241, 0.05);
        }
        
        .contact-details {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .contact-item {
            display: flex;
            flex-direction: column;
        }
        
        .contact-item span {
            color: var(--light-text);
            font-size: 0.8rem;
        }
        
        .nameservers-list, .status-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .nameservers-list li, .status-list li {
            padding: 8px 12px;
            background: rgba(99, 102, 241, 0.05);
            border-radius: 4px;
        }
        
        .raw-whois {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid var(--border);
        }
        
        .toggle-raw-btn {
            padding: 5px 10px;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8rem;
        }
        
        .raw-whois-data {
            margin-top: 10px;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.8rem;
            max-height: 200px;
            overflow: auto;
            white-space: pre-wrap;
            word-break: break-all;
        }
        
        .no-data {
            color: var(--light-text);
            font-style: italic;
            margin: 5px 0;
        }
    `;
    document.head.appendChild(detailsStyle);
});
