/**
 * G-Milestone Core Workflow Implementation
 */

const app = {
    // Database Simulation
    projects: [],
    transactions: [],
    currentProjectViewId: null,
    currentCheckoutMilestoneIdx: null,
    pendingTxnId: null, 
    
    // View Management
    currentViewId: 'view-wallet',
    history: [],

    // Wizard State
    currentWizardStep: 1,
    totalWizardSteps: 5,

    // Status Enums 
    STATUS: {
        DRAFT: { text: "Draft", class: "bg-draft" },
        PAYMENT_REQUESTED: { text: "Payment Requested", class: "bg-requested" },
        PARTIALLY_PAID: { text: "Partially Paid", class: "bg-progress" },
        IN_PROGRESS: { text: "In Progress", class: "bg-progress" },
        READY: { text: "Ready", class: "bg-ready" },
        FINAL_PAYMENT_REQUESTED: { text: "Final Request Sent", class: "bg-requested" },
        COMPLETED: { text: "Completed", class: "bg-completed" }
    },

    init() {
        this.setupNavigation();
        this.seedData();
        this.updateDashboard();
        this.renderProjectsList();
        this.renderTransactions();
    },

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = item.getAttribute('data-target');
                if (!targetId) return;
                
                this.history = []; // Clear history on top-level navigation
                this.navigateTo(targetId);
            });
        });
    },

    navigateTo(viewId, isBack = false, skipHistory = false) {
        if (!isBack && !skipHistory && this.currentViewId && this.currentViewId !== viewId) {
            this.history.push(this.currentViewId);
        }
        
        this.currentViewId = viewId;

        // UI State Updates for Navigation Active Classes
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        document.querySelectorAll(`.nav-item[data-target="${viewId}"]`).forEach(activeNav => {
            activeNav.classList.add('active');
        });
        
        this.switchView(viewId);
    },
    
    navigateBack() {
        if (this.history.length > 0) {
            const prevView = this.history.pop();
            this.navigateTo(prevView, true);
        } else {
            this.navigateTo('view-wallet', true);
        }
    },

    switchView(viewId) {
            // Hide all views
            document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
            const target = document.getElementById(viewId);
            if (target) target.classList.remove('hidden');

            // Manage UI headers/footers based on the view
            const isSubView = target && target.classList.contains('sub-view');
            const header = document.getElementById('appHeader');
            const backBtn = document.getElementById('globalBackBtn');
            const mobileNav = document.getElementById('mobileNav');
            const title = document.getElementById('headerTitle');

            if (viewId === 'view-wallet') {
                // Hide the entire top header exclusively on the Dashboard
                if (header) header.style.display = 'none'; 
                if (mobileNav) mobileNav.style.display = 'flex';
            } else {
                // Restore and configure the top header for all other pages
                if (header) {
                    header.style.display = 'flex';
                    header.classList.add('sub-header');
                }
                if (title) title.style.display = 'flex'; 
                if (mobileNav) mobileNav.style.display = isSubView ? 'none' : 'flex';
                
                if (this.history.length > 0) {
                    backBtn.classList.remove('hidden');
                } else {
                    backBtn.classList.add('hidden');
                }
                
                // Set contextual header titles
                if(viewId === 'view-projects-list') title.innerText = 'Projects';
                if(viewId === 'view-transactions') title.innerText = 'Payment History';
                if(viewId === 'view-project-create') title.innerText = 'New Project';
                if(viewId === 'view-project-detail') title.innerText = 'Project Details';
                if(viewId === 'view-checkout') title.innerText = 'Payment';
            }

            // Fire rendering logic
            if(viewId === 'view-wallet') this.updateDashboard();
            if(viewId === 'view-projects-list') this.renderProjectsList();
            if(viewId === 'view-transactions') this.renderTransactions();
        },

    formatMoney(amount) {
        return parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    // --- Core Logic: Dashboard ---
    updateDashboard() {
        let totalValue = 0, collected = 0, activeCount = 0;

        this.projects.forEach(p => {
            totalValue += p.total;
            let pPaid = p.milestones.filter(m => m.paid).reduce((sum, m) => sum + m.amount, 0);
            collected += pPaid;
            
            if (p.status !== 'COMPLETED' && p.status !== 'DRAFT') {
                activeCount++;
            }
        });

        document.getElementById('dash-collected').innerText = this.formatMoney(collected);
        document.getElementById('dash-total-value').innerText = this.formatMoney(totalValue);
        document.getElementById('dash-outstanding').innerText = this.formatMoney(totalValue - collected);
        document.getElementById('dash-active-count').innerText = activeCount;
    },

    // --- Core Logic: Wizard Flow & Create Project ---
    showCreateProject() {
        document.getElementById('create-project-form').reset();
        document.getElementById('milestones-container').innerHTML = '';
        this.currentWizardStep = 1;
        this.updateWizardUI();
        this.navigateTo('view-project-create');
    },

    updateWizardUI() {
        for (let i = 1; i <= this.totalWizardSteps; i++) {
            document.getElementById(`wizard-step-${i}`).classList.remove('active');
            const indicator = document.getElementById(`indicator-step-${i}`);
            indicator.classList.remove('active', 'completed');
            
            if (i < this.currentWizardStep) {
                indicator.classList.add('completed');
            } else if (i === this.currentWizardStep) {
                indicator.classList.add('active');
                indicator.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
        
        document.getElementById(`wizard-step-${this.currentWizardStep}`).classList.add('active');

        if (this.currentWizardStep === 3) this.generateMilestones();
        if (this.currentWizardStep === 5) this.populateReviewStep();
    },

    validateCurrentStep() {
        const stepEl = document.getElementById(`wizard-step-${this.currentWizardStep}`);
        const inputs = stepEl.querySelectorAll('input[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.checkValidity()) {
                input.reportValidity();
                isValid = false;
            }
        });

        if (this.currentWizardStep === 3) {
            const totalInput = parseFloat(document.getElementById('projTotal').value) || 0;
            const amtInputs = document.querySelectorAll('.m-amt');
            let currentSum = 0;
            amtInputs.forEach(inp => { currentSum += (parseFloat(inp.value) || 0); });
            
            if (Math.abs(currentSum - totalInput) > 0.02 && totalInput > 0) {
                document.getElementById('milestone-warning').style.display = 'block';
                isValid = false;
            }
        }

        return isValid;
    },

    nextWizardStep(stepCalledFrom) {
        if (this.currentWizardStep !== stepCalledFrom) return;
        if (!this.validateCurrentStep()) return;

        if (this.currentWizardStep < this.totalWizardSteps) {
            this.currentWizardStep++;
            this.updateWizardUI();
        }
    },

    prevWizardStep(stepCalledFrom) {
        if (this.currentWizardStep !== stepCalledFrom) return;

        if (this.currentWizardStep > 1) {
            this.currentWizardStep--;
            this.updateWizardUI();
        }
    },

    generateMilestones() {
        const total = parseFloat(document.getElementById('projTotal').value) || 0;
        let count = parseInt(document.getElementById('projMilestoneCount').value) || 1;
        if (count < 1) count = 1;

        const type = document.getElementById('projMilestoneType').value || 'equal';
        const isReadonly = type === 'equal' ? 'readonly tabindex="-1"' : '';

        const container = document.getElementById('milestones-container');
        container.innerHTML = '';
        
        const splitAmount = total / count;
        let today = new Date().toISOString().split('T')[0];
        let expDate = document.getElementById('projDate').value || '';
        
        for (let i = 1; i <= count; i++) {
            let defaultName = `Milestone ${i}`;
            let defaultDate = '';

            if (count === 1) {
                defaultName = "Full Payment";
                defaultDate = today;
            } else if (i === 1) {
                defaultName = "Downpayment";
                defaultDate = today;
            } else if (i === count) {
                defaultName = "Final Payment";
                defaultDate = expDate;
            }

            const row = document.createElement('div');
            row.className = 'milestone-row';
            row.innerHTML = `
                <div class="milestone-field name-field">
                    <label>Name</label>
                    <input type="text" class="form-control m-name" placeholder="Milestone Name" value="${defaultName}" required>
                </div>
                <div class="milestone-field amt-field">
                    <label>Amount (₱)</label>
                    <input type="number" class="form-control m-amt" placeholder="Amount" value="${splitAmount.toFixed(2)}" step="0.01" min="1" required ${isReadonly} oninput="app.validateMilestonesSum()">
                </div>
                <div class="milestone-field date-field">
                    <label>Due Date</label>
                    <input type="date" class="form-control m-date" value="${defaultDate}" min="${today}" ${expDate ? `max="${expDate}"` : ''} required>
                </div>
            `;
            container.appendChild(row);
        }

        document.getElementById('milestone-total-target').innerText = `₱${this.formatMoney(total)}`;
        this.validateMilestonesSum();
    },

    validateMilestonesSum() {
        const totalInput = parseFloat(document.getElementById('projTotal').value) || 0;
        const amtInputs = document.querySelectorAll('.m-amt');
        let currentSum = 0;
        
        amtInputs.forEach(inp => { currentSum += (parseFloat(inp.value) || 0); });
        
        document.getElementById('milestone-allocated').innerText = `₱${this.formatMoney(currentSum)}`;
        const warning = document.getElementById('milestone-warning');
        const btnNext = document.getElementById('btn-next-step-3');

        if (Math.abs(currentSum - totalInput) > 0.02 && totalInput > 0) {
            warning.style.display = 'block';
            if (btnNext) btnNext.disabled = true;
        } else {
            warning.style.display = 'none';
            if (btnNext) btnNext.disabled = false;
        }
    },

    populateReviewStep() {
        const custName = document.getElementById('custName').value;
        const custMobile = document.getElementById('custMobile').value;
        const custEmail = document.getElementById('custEmail').value || 'Not provided';
        
        document.getElementById('rev-cust').innerHTML = `
            <strong>Customer:</strong> ${custName} <br>
            <strong>Mobile:</strong> ${custMobile} <br>
            <strong>Email:</strong> ${custEmail}
        `;

        const projName = document.getElementById('projName').value;
        const projTotal = document.getElementById('projTotal').value;
        const projDate = document.getElementById('projDate').value;
        
        document.getElementById('rev-order').innerHTML = `
            <strong>Order:</strong> ${projName} <br>
            <strong>Amount:</strong> ₱${this.formatMoney(projTotal)} <br>
            <strong>Target:</strong> ${projDate ? new Date(projDate).toLocaleDateString() : ''}
        `;

        const mNames = document.querySelectorAll('.m-name');
        const mAmts = document.querySelectorAll('.m-amt');
        const mDates = document.querySelectorAll('.m-date');
        
        let msHtml = `<ul style="margin:0; padding-left: 16px; margin-top: 8px;">`;
        for (let i = 0; i < mNames.length; i++) {
            let d = mDates[i].value ? new Date(mDates[i].value).toLocaleDateString() : 'TBD';
            msHtml += `<li style="margin-bottom: 4px;"><strong>${mNames[i].value}:</strong> ₱${this.formatMoney(mAmts[i].value)} <span class="text-muted">(${d})</span></li>`;
        }
        msHtml += `</ul>`;
        document.getElementById('rev-milestones').innerHTML = msHtml;

        const penaltyType = document.getElementById('projPenaltyType').value;
        const penaltyVal = document.getElementById('projPenaltyValue').value;
        const penaltyWhen = document.getElementById('projPenaltyWhen').value;
        
        if (penaltyVal && parseFloat(penaltyVal) > 0) {
            let pAmtStr = penaltyType === 'percent' ? `${penaltyVal}% of remaining balance` : `₱${this.formatMoney(penaltyVal)}`;
            document.getElementById('rev-penalty').innerHTML = `
                <strong>Penalty:</strong> ${pAmtStr} <br>
                <strong>Trigger:</strong> ${penaltyWhen || 'Not specified'}
            `;
        } else {
            document.getElementById('rev-penalty').innerHTML = `<em>No penalty fee configured.</em>`;
        }
    },

    handleCreateProject(e) {
        if(e) e.preventDefault();
        if (!this.validateCurrentStep()) return;

        const btn = document.getElementById('btn-save-project');
        if (btn.disabled) return; 
        
        btn.disabled = true;

        document.getElementById('createStateLoading').classList.remove('hidden');
        document.getElementById('createStateSuccess').classList.add('hidden');
        document.getElementById('createStateError').classList.add('hidden');
        document.getElementById('creationFeedbackModal').classList.remove('hidden');

        setTimeout(() => {
            const isSuccess = true; 
            if (isSuccess) {
                document.getElementById('createStateLoading').classList.add('hidden');
                document.getElementById('createStateSuccess').classList.remove('hidden');
                setTimeout(() => {
                    this.finalizeProjectCreation();
                    document.getElementById('creationFeedbackModal').classList.add('hidden');
                    btn.disabled = false;
                }, 1800); 
            } else {
                document.getElementById('createStateLoading').classList.add('hidden');
                document.getElementById('createStateError').classList.remove('hidden');
            }
        }, 1500); 
    },

    closeCreationModal() {
        document.getElementById('creationFeedbackModal').classList.add('hidden');
        document.getElementById('btn-save-project').disabled = false;
    },

    finalizeProjectCreation() {
        const mNames = document.querySelectorAll('.m-name');
        const mAmts = document.querySelectorAll('.m-amt');
        const mDates = document.querySelectorAll('.m-date');
        const milestones = [];
        
        for (let i = 0; i < mNames.length; i++) {
            milestones.push({
                name: mNames[i].value,
                amount: parseFloat(mAmts[i].value),
                date: mDates[i].value,
                requested: false,
                paid: false,
                paidDate: null
            });
        }

        const penaltyType = document.getElementById('projPenaltyType').value;
        const penaltyVal = parseFloat(document.getElementById('projPenaltyValue').value) || 0;
        const penaltyWhen = document.getElementById('projPenaltyWhen').value;

        const newProj = {
            id: 'PRJ-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
            customer: {
                name: document.getElementById('custName').value,
                mobile: document.getElementById('custMobile').value,
                email: document.getElementById('custEmail').value
            },
            name: document.getElementById('projName').value,
            total: parseFloat(document.getElementById('projTotal').value),
            expectedDate: document.getElementById('projDate').value,
            status: 'DRAFT',
            milestones: milestones,
            penalty: { type: penaltyType, amount: penaltyVal, when: penaltyWhen },
            createdAt: new Date().toISOString()
        };

        this.projects.unshift(newProj);
        this.history = ['view-wallet'];
        this.currentViewId = 'view-projects-list'; 
        this.openProjectDetail(newProj.id);
    },

    // --- Core Logic: Project Listing & Detail ---
    renderProjectsList() {
        const grid = document.getElementById('projects-grid');
        grid.innerHTML = '';

        if(this.projects.length === 0) {
            grid.innerHTML = `<div class="empty-state">No projects found. Create one to get started.</div>`;
            return;
        }

        const paymentRequested = this.projects.filter(p => p.status === 'PAYMENT_REQUESTED' || p.status === 'FINAL_PAYMENT_REQUESTED');
        const inProgress = this.projects.filter(p => p.status === 'DRAFT' || p.status === 'IN_PROGRESS' || p.status === 'PARTIALLY_PAID' || p.status === 'READY');
        const completed = this.projects.filter(p => p.status === 'COMPLETED');

        const renderCard = (p) => {
            const paidAmt = p.milestones.filter(m => m.paid).reduce((s, m) => s + m.amount, 0);
            const pct = p.total > 0 ? Math.round((paidAmt / p.total) * 100) : 0;
            const statusObj = this.STATUS[p.status];

            return `
                <div class="project-card" onclick="app.openProjectDetail('${p.id}')">
                    <div class="project-header">
                        <div style="min-width: 0;">
                            <div class="project-title">${p.name}</div>
                            <div class="project-cust">${p.customer.name}</div>
                        </div>
                        <span class="status-badge ${statusObj.class}">${statusObj.text}</span>
                    </div>
                    <div>
                        <div class="flex-row justify-between text-xs mb-8 font-600 color-main">
                            <span>₱${this.formatMoney(paidAmt)} Paid</span>
                            <span>₱${this.formatMoney(p.total)}</span>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: ${pct}%"></div>
                        </div>
                    </div>
                </div>
            `;
        };

        let html = '';
        if (paymentRequested.length > 0) {
            html += `<div class="project-divider"><span>Action Required</span></div>`;
            paymentRequested.forEach(p => { html += renderCard(p); });
        }
        if (inProgress.length > 0) {
            html += `<div class="project-divider"><span>In Progress</span></div>`;
            inProgress.forEach(p => { html += renderCard(p); });
        }
        if (completed.length > 0) {
            html += `<div class="project-divider"><span>Completed</span></div>`;
            completed.forEach(p => { html += renderCard(p); });
        }

        grid.innerHTML = html;
    },

    openProjectDetail(id) {
        this.currentProjectViewId = id;
        const p = this.projects.find(x => x.id === id);
        if (!p) return;

        document.getElementById('det-name').innerText = p.name;
        document.getElementById('det-customer').innerText = p.customer.name;
        document.getElementById('det-mobile').innerText = p.customer.mobile;
        
        const statusObj = this.STATUS[p.status];
        const badge = document.getElementById('det-status-badge');
        badge.className = `badge ${statusObj.class}`;
        badge.innerText = statusObj.text;

        document.getElementById('det-id').innerText = p.id;
        document.getElementById('det-date').innerText = p.expectedDate ? new Date(p.expectedDate).toLocaleDateString() : 'N/A';
        document.getElementById('det-status-text').innerText = statusObj.text;

        const paidAmt = p.milestones.filter(m => m.paid).reduce((s, m) => s + m.amount, 0);
        const remAmt = p.total - paidAmt;
        const pct = p.total > 0 ? Math.round((paidAmt / p.total) * 100) : 0;

        document.getElementById('det-total').innerText = `₱${this.formatMoney(p.total)}`;
        document.getElementById('det-paid').innerText = `₱${this.formatMoney(paidAmt)}`;
        document.getElementById('det-remaining').innerText = `₱${this.formatMoney(remAmt)}`;
        document.getElementById('det-progress-fill').style.width = `${pct}%`;
        document.getElementById('det-progress-text').innerText = `${pct}% PAID`;

        const tl = document.getElementById('det-milestones');
        tl.innerHTML = '';
        
        p.milestones.forEach((m, idx) => {
            let stateClass = '';
            let metaText = m.date ? new Date(m.date).toLocaleDateString() : 'TBD';
            let actionsHtml = '';

            if (m.paid) {
                stateClass = 'paid';
                metaText += ` • Paid on ${new Date(m.paidDate).toLocaleDateString()}`;
            } else if (m.requested) {
                stateClass = 'active';
                metaText += ' • Payment Requested';
                actionsHtml = `<button class="btn-primary btn-sm" onclick="app.openCheckout('${p.id}', ${idx})">Simulate GCash Pay</button>`;
            } else {
                actionsHtml = `<button class="btn-outline btn-sm" onclick="app.sendPaymentRequest('${p.id}', ${idx})">Request</button>`;
            }

            tl.innerHTML += `
                <div class="timeline-item ${stateClass}">
                    <div class="tl-content">
                        <div class="tl-info">
                            <div class="tl-title">${m.name}</div>
                            <div class="tl-meta">${metaText}</div>
                        </div>
                        <div class="tl-action-group">
                            <div class="tl-amount">₱${this.formatMoney(m.amount)}</div>
                            <div class="tl-actions">${actionsHtml}</div>
                        </div>
                    </div>
                </div>
            `;
        });

        const readyCard = document.getElementById('ready-action-card');
        if ((p.status === 'IN_PROGRESS' || p.status === 'PARTIALLY_PAID') && p.milestones.some(m => !m.paid)) {
            readyCard.style.display = 'block';
        } else {
            readyCard.style.display = 'none';
        }

        this.navigateTo('view-project-detail');
    },

    // --- State Machine Automation & Payment Handling ---
    openCheckout(projId, milestoneIdx) {
        this.currentProjectViewId = projId;
        this.currentCheckoutMilestoneIdx = milestoneIdx;
        
        const p = this.projects.find(x => x.id === projId);
        const m = p.milestones[milestoneIdx];
        
        const breakdown = document.getElementById('checkout-breakdown');
        breakdown.innerHTML = `
            <div class="flex-row justify-between mb-8"><span class="text-muted">Project:</span> <strong>${p.name}</strong></div>
            <div class="flex-row justify-between mb-8"><span class="text-muted">Customer:</span> <strong>${p.customer.name}</strong></div>
            <div class="flex-row justify-between"><span class="text-muted">Milestone:</span> <strong>${m.name}</strong></div>
        `;
        
        document.getElementById('checkout-amount-input').value = m.amount;
        this.navigateTo('view-checkout');
    },

    processPayment() {
        const paymentAmount = parseFloat(document.getElementById('checkout-amount-input').value);
        if (!paymentAmount || paymentAmount <= 0) {
            alert("Please enter a valid payment amount.");
            return;
        }

        const btn = document.getElementById('btn-authorize-pay');
        if (btn.disabled) return;
        btn.disabled = true;

        document.getElementById('paymentStateLoading').classList.remove('hidden');
        document.getElementById('paymentStateSuccess').classList.add('hidden');
        document.getElementById('paymentStateError').classList.add('hidden');
        document.getElementById('paymentFeedbackModal').classList.remove('hidden');

        setTimeout(() => {
            const isSuccess = true; 
            if (isSuccess) {
                document.getElementById('paymentStateLoading').classList.add('hidden');
                document.getElementById('paymentStateSuccess').classList.remove('hidden');
                this.simulateCustomerPay(this.currentProjectViewId, this.currentCheckoutMilestoneIdx);
                btn.disabled = false;
            } else {
                document.getElementById('paymentStateLoading').classList.add('hidden');
                document.getElementById('paymentStateError').classList.remove('hidden');
                btn.disabled = false;
            }
        }, 1500);
    },

    sendPaymentRequest(projId, milestoneIdx) {
        const p = this.projects.find(x => x.id === projId);
        if(!p) return;

        p.milestones[milestoneIdx].requested = true;
        if(p.status === 'DRAFT') p.status = 'PAYMENT_REQUESTED';

        alert(`Payment Request for ₱${this.formatMoney(p.milestones[milestoneIdx].amount)} successfully sent to ${p.customer.mobile}.`);
        this.openProjectDetail(projId);
    },

    simulateCustomerPay(projId, milestoneIdx) {
        const p = this.projects.find(x => x.id === projId);
        if(!p) return;
        
        const m = p.milestones[milestoneIdx];
        m.paid = true;
        m.paidDate = new Date().toISOString();

        const newTxnId = 'TXN-' + Math.random().toString(36).substring(2, 9).toUpperCase();
        this.transactions.unshift({
            id: newTxnId,
            projName: p.name,
            customerName: p.customer.name,
            milestoneName: m.name,
            amount: m.amount,
            date: m.paidDate
        });

        const allPaid = p.milestones.every(x => x.paid);
        const anyPaid = p.milestones.some(x => x.paid);

        if (allPaid) p.status = 'COMPLETED';
        else if (p.status === 'PAYMENT_REQUESTED' || p.status === 'DRAFT') p.status = 'IN_PROGRESS';
        else if (p.status === 'IN_PROGRESS' && anyPaid) p.status = 'PARTIALLY_PAID';

        this.pendingTxnId = newTxnId;
        document.getElementById('successModalAmount').innerText = `₱${this.formatMoney(m.amount)}`;
    },

    closePaymentSuccessModal() {
        document.getElementById('paymentFeedbackModal').classList.add('hidden');
        this.history = [];
        this.currentViewId = 'view-wallet'; 
        this.navigateTo('view-transactions', false, true); 
        
        if (this.pendingTxnId) {
            this.openInvoiceModal(this.pendingTxnId);
            this.pendingTxnId = null; 
        }
    },

    closePaymentModalError() {
        document.getElementById('paymentFeedbackModal').classList.add('hidden');
    },

    markOrderReady() {
        const projId = this.currentProjectViewId;
        const p = this.projects.find(x => x.id === projId);
        if(!p) return;

        p.status = 'READY';

        const nextMilestoneIdx = p.milestones.findIndex(m => !m.paid && !m.requested);
        if (nextMilestoneIdx !== -1) {
            p.milestones[nextMilestoneIdx].requested = true;
            p.status = 'FINAL_PAYMENT_REQUESTED';
            alert(`Order marked READY. Final payment request sent to ${p.customer.mobile}.`);
        } else {
             alert(`Order marked READY.`);
        }
        this.openProjectDetail(projId);
    },

    // --- Ledger / History ---
    renderTransactions() {
            const listDiv = document.getElementById('ledger-list');
            listDiv.innerHTML = '';
            
            if (this.transactions.length === 0) {
                listDiv.innerHTML = '<p class="empty-state">No recorded payments yet.</p>';
                return;
            }

            this.transactions.forEach(t => {
                // Each transaction is now its own standalone card
                listDiv.innerHTML += `
                    <div class="card p-20 mb-16 flex-row justify-between align-center gap-12">
                        <div class="flex-1 min-w-0 pr-12">
                            <span class="font-600 color-main block mb-4 text-truncate text-lg">${t.projName}</span>
                            <span class="text-xs text-muted block line-height-15">${t.milestoneName} • Ref: ${t.id}</span>
                            <span class="text-xs text-muted block mt-8">${new Date(t.date).toLocaleString()}</span>
                        </div>
                        <div class="flex-column flex-shrink-0" style="align-items: flex-end; gap: 12px;">
                            <span class="font-700 color-success text-lg">₱${this.formatMoney(t.amount)}</span>
                            <button class="btn-outline btn-sm" onclick="app.openInvoiceModal('${t.id}')">Invoice</button>
                        </div>
                    </div>
                `;
            });
        },

    // --- Invoice Modal Functions ---
    openInvoiceModal(txnId) {
        const t = this.transactions.find(x => x.id === txnId);
        if (!t) return;

        const body = document.getElementById('invoiceBody');
        body.innerHTML = `
            <div class="invoice-brand">
                <div class="invoice-brand-name">G-Milestone E-Receipt</div>
                <div class="text-muted text-sm mt-8">Official Payment Confirmation</div>
            </div>
            <div class="invoice-row"><span>Transaction ID:</span> <strong>${t.id}</strong></div>
            <div class="invoice-row"><span>Date:</span> <strong>${new Date(t.date).toLocaleString()}</strong></div>
            <div class="invoice-divider"></div>
            <div class="invoice-row"><span>Customer:</span> <strong>${t.customerName || 'N/A'}</strong></div>
            <div class="invoice-row"><span>Project:</span> <strong>${t.projName}</strong></div>
            <div class="invoice-row"><span>Milestone:</span> <strong>${t.milestoneName}</strong></div>
            <div class="invoice-divider"></div>
            <div class="invoice-row align-center">
                <span class="font-600">Total Paid:</span> 
                <strong class="invoice-total">₱${this.formatMoney(t.amount)}</strong>
            </div>
        `;
        document.getElementById('invoiceModal').classList.remove('hidden');
    },

    closeInvoiceModal() {
        document.getElementById('invoiceModal').classList.add('hidden');
    },

    // --- Seed Data ---
    seedData() {
        this.projects = [
            {
                id: 'PRJ-M1001',
                customer: { name: "Maria Clara", mobile: "09170001234", email: "maria@example.com" },
                name: "Custom Corporate Giveaways",
                total: 25000,
                expectedDate: "2026-09-15",
                status: "IN_PROGRESS",
                createdAt: new Date().toISOString(),
                milestones: [
                    { name: "50% Downpayment", amount: 12500, date: new Date().toISOString(), requested: true, paid: true, paidDate: new Date(Date.now() - 86400000).toISOString() },
                    { name: "50% Upon Delivery", amount: 12500, date: "2026-09-15", requested: false, paid: false, paidDate: null }
                ]
            },
            {
                id: 'PRJ-M1002',
                customer: { name: "Juan Dela Cruz", mobile: "09180005678", email: "" },
                name: "Wedding Event Catering",
                total: 50000,
                expectedDate: "2026-10-10",
                status: "PAYMENT_REQUESTED",
                createdAt: new Date().toISOString(),
                milestones: [
                    { name: "Reservation Fee", amount: 10000, date: new Date().toISOString(), requested: true, paid: false, paidDate: null },
                    { name: "Progress Payment", amount: 20000, date: "2026-09-20", requested: false, paid: false, paidDate: null },
                    { name: "Final Balance", amount: 20000, date: "2026-10-10", requested: false, paid: false, paidDate: null }
                ]
            }
        ];

        this.transactions = [
            {
                id: 'TXN-A1B2C3D',
                projName: "Custom Corporate Giveaways",
                customerName: "Maria Clara",
                milestoneName: "50% Downpayment",
                amount: 12500,
                date: new Date(Date.now() - 86400000).toISOString()
            }
        ];
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => app.init());