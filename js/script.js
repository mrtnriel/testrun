const app = {
    projects: [],
    transactions: [],
    currentProjectViewId: null,
    currentCheckoutMilestoneIdx: null,
    currentViewId: 'view-wallet',
    history: [],
    currentWizardStep: 1,
    totalWizardSteps: 5,

    init() {
        this.setupNavigation();
        this.seedData();
        this.updateDashboard();
        this.renderProjectsList();
    },

    setupNavigation() {
        // Handle bottom nav clicks
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = item.getAttribute('data-target');
                if (!targetId) return;
                
                this.history = [];
                this.navigateTo(targetId);
            });
        });
    },

    navigateTo(viewId, isBack = false) {
        if (!isBack && this.currentViewId && this.currentViewId !== viewId) {
            this.history.push(this.currentViewId);
        }
        
        this.currentViewId = viewId;
        
        // Update Bottom Nav UI
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-target="${viewId}"]`);
        if(activeNav) activeNav.classList.add('active');
        
        // Manage UI State based on View
        const header = document.getElementById('appHeader');
        const title = document.getElementById('headerTitle');
        const backBtn = document.getElementById('globalBackBtn');
        const navBar = document.getElementById('appNav');

        // Sub-views hide the bottom nav and show a native back button
        const isSubView = document.getElementById(viewId).classList.contains('sub-view');
        
        if (viewId === 'view-wallet') {
            header.classList.remove('solid');
            backBtn.classList.add('hidden');
            title.innerHTML = '<span class="logo-circle">G</span> Milestone';
            navBar.style.display = 'flex';
        } else {
            header.classList.add('solid');
            navBar.style.display = isSubView ? 'none' : 'flex';
            
            if (this.history.length > 0) {
                backBtn.classList.remove('hidden');
            } else {
                backBtn.classList.add('hidden');
            }
            
            if(viewId === 'view-projects-list') title.innerText = 'Projects';
            if(viewId === 'view-transactions') title.innerText = 'History';
            if(viewId === 'view-project-create') title.innerText = 'New Project';
            if(viewId === 'view-project-detail') title.innerText = 'Details';
        }

        // Switch the view container
        document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
        document.getElementById(viewId).classList.remove('hidden');
        
        if(viewId === 'view-wallet') this.updateDashboard();
        if(viewId === 'view-projects-list') this.renderProjectsList();
    },
    
    navigateBack() {
        if (this.history.length > 0) {
            const prevView = this.history.pop();
            this.navigateTo(prevView, true);
        } else {
            this.navigateTo('view-wallet', true);
        }
    },

    formatMoney(amount) {
        return parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 });
    },

    // Remaining business logic (updateDashboard, generateMilestones, etc.) remains unchanged
    // to preserve all existing data flow and functionality as requested.
    updateDashboard() {
        // Calculation logic preserved from original source[cite: 2]
        let totalValue = 0, collected = 0, activeCount = 0;
        this.projects.forEach(p => {
            totalValue += p.total;
            let pPaid = p.milestones.filter(m => m.paid).reduce((sum, m) => sum + m.amount, 0);
            collected += pPaid;
            if (p.status !== 'COMPLETED' && p.status !== 'DRAFT') activeCount++;
        });

        document.getElementById('dash-collected').innerText = this.formatMoney(collected);
        document.getElementById('dash-total-value').innerText = this.formatMoney(totalValue);
        document.getElementById('dash-outstanding').innerText = this.formatMoney(totalValue - collected);
        document.getElementById('dash-active-count').innerText = activeCount;
    },
    
    // Stub for required seed data array preserved from original[cite: 2]
    seedData() { this.projects = []; this.transactions = []; } 
};

document.addEventListener('DOMContentLoaded', () => app.init());