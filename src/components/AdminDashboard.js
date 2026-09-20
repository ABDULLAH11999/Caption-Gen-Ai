import { api } from '../services/apiClient.js';
import { generateContactReplyEmailHtml } from '../utils/emailPreviewGenerator.js';

export class AdminDashboard {
  constructor({ onNavigate, showToast }) {
    this.onNavigate = onNavigate;
    this.showToast = showToast || console.log;
    this.container = null;
    this.activeTab = 'overview'; // 'overview' | 'users' | 'plans' | 'contacts' | 'purchases' | 'blogs' | 'settings' | 'contact-reply'
    
    // State caches
    this.stats = null;
    this.users = [];
    this.plans = [];
    this.contacts = [];
    this.purchases = [];
    this.blogs = [];
    this.settings = {};
    this.activeContactForReply = null;
    this.visitorFilter = {
      period: 'all',
      unique: false,
      userType: 'all',
      search: ''
    };
  }

  async init() {
    try {
      this.stats = await api.getAdminStats();
    } catch (e) {
      console.warn('[AdminDashboard] init stats error:', e.message);
    }
  }

  render(parentElement) {
    this.container = document.createElement('div');
    this.container.className = 'admin-layout';
    this.container.innerHTML = `
      <!-- LEFT ADMIN SIDEBAR -->
      <aside class="admin-sidebar" id="admin-sidebar-nav">
        <div class="admin-sidebar-header">
          <div class="admin-sidebar-brand-group">
            <span class="brand-rhombus"></span>
            <span class="admin-brand-title">Admin Console</span>
          </div>
          <button class="admin-sidebar-toggle" id="btn-admin-sidebar-toggle" aria-label="Toggle navigation">
            <span></span><span></span><span></span>
          </button>
        </div>

        <div class="admin-sidebar-drawer" id="admin-sidebar-drawer">
          <ul class="admin-sidebar-menu">
            <li class="admin-menu-item active" data-tab="overview">
              <span>📊</span><span>Overview</span>
            </li>
            <li class="admin-menu-item" data-tab="users">
              <span>👥</span><span>Users (${this.users.length || '...'})</span>
            </li>
            <li class="admin-menu-item" data-tab="plans">
              <span>💳</span><span>Plans &amp; Quotas</span>
            </li>
            <li class="admin-menu-item" data-tab="contacts">
              <span>💬</span><span>Contact Requests</span>
            </li>
            <li class="admin-menu-item" data-tab="purchases">
              <span>🛒</span><span>Purchase Orders</span>
            </li>
            <li class="admin-menu-item" data-tab="blogs">
              <span>📝</span><span>SEO Blog Articles</span>
            </li>
            <li class="admin-menu-item" data-tab="visitors">
              <span>🌐</span><span>Visitor Tracking</span>
            </li>
            <li class="admin-menu-item" data-tab="settings">
              <span>⚙️</span><span>Site SEO &amp; Branding</span>
            </li>
          </ul>

          <div class="admin-sidebar-footer">
            <button class="btn btn-outline btn-sm btn-block" id="btn-admin-to-app">
              <span>⚡ Open App Studio</span>
            </button>
            <button class="btn btn-dark btn-sm btn-block" id="btn-admin-logout">
              <span>🚪 Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- MAIN ADMIN WORKSPACE -->
      <main class="admin-main" id="admin-main-view">
        <!-- Dynamically rendered by switchTab() -->
      </main>

      <!-- ADMIN MODALS CONTAINER -->
      <div id="admin-modals-root"></div>
    `;

    parentElement.appendChild(this.container);
    this.bindEvents();
    this.switchTab('overview');
    return this.container;
  }

  closeSidebarDrawer() {
    const sidebar = this.container?.querySelector('#admin-sidebar-nav');
    const toggle = this.container?.querySelector('#btn-admin-sidebar-toggle');
    sidebar?.classList.remove('open');
    toggle?.classList.remove('active');
  }

  bindEvents() {
    const toggle = this.container.querySelector('#btn-admin-sidebar-toggle');
    const sidebar = this.container.querySelector('#admin-sidebar-nav');
    toggle?.addEventListener('click', () => {
      const isOpen = sidebar?.classList.toggle('open');
      toggle.classList.toggle('active', isOpen);
    });

    this.container.querySelectorAll('.admin-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.getAttribute('data-tab');
        this.closeSidebarDrawer();
        this.switchTab(tab);
      });
    });

    this.container.querySelector('#btn-admin-to-app')?.addEventListener('click', () => {
      this.closeSidebarDrawer();
      this.onNavigate('app');
    });

    this.container.querySelector('#btn-admin-logout')?.addEventListener('click', async () => {
      this.closeSidebarDrawer();
      await api.logout();
      this.onNavigate('home');
    });
  }

  async switchTab(tab) {
    this.activeTab = tab;
    this.container.querySelectorAll('.admin-menu-item').forEach(i => {
      i.classList.toggle('active', i.getAttribute('data-tab') === tab);
    });

    const main = this.container.querySelector('#admin-main-view');
    main.innerHTML = '<div style="padding: 40px;"><p>Loading data...</p></div>';

    switch (tab) {
      case 'overview':
        await this.renderOverviewTab(main);
        break;
      case 'users':
        await this.renderUsersTab(main);
        break;
      case 'plans':
        await this.renderPlansTab(main);
        break;
      case 'contacts':
        await this.renderContactsTab(main);
        break;
      case 'purchases':
        await this.renderPurchasesTab(main);
        break;
      case 'blogs':
        await this.renderBlogsTab(main);
        break;
      case 'visitors':
        await this.renderVisitorsTab(main);
        break;
      case 'settings':
        await this.renderSettingsTab(main);
        break;
      case 'contact-reply':
        this.renderContactReplyTab(main);
        break;
    }
  }

  // 1. OVERVIEW TAB
  async renderOverviewTab(container) {
    try {
      this.stats = await api.getAdminStats();
    } catch (e) {}

    container.innerHTML = `
      <div class="admin-top-bar">
        <h1 class="admin-view-title">System Overview &amp; Analytics</h1>
      </div>

      <div class="admin-stats-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-label">Total Users</div>
          <div class="admin-stat-value">${this.stats?.totalUsers ?? 1}</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-label">Pending Purchases</div>
          <div class="admin-stat-value" style="color: var(--primary-coral);">${this.stats?.pendingPurchases ?? 0}</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-label">Inquiries</div>
          <div class="admin-stat-value">${this.stats?.totalContacts ?? 0}</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-label">Seeded SEO Blogs</div>
          <div class="admin-stat-value">${this.stats?.totalBlogs ?? 30}</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-label">Today's Captions</div>
          <div class="admin-stat-value" style="color: var(--success);">${this.stats?.todayGenerations ?? 0}</div>
        </div>
      </div>

      <div class="admin-table-card">
        <div class="admin-table-header">
          <h3 style="font-size: 17px; font-weight: 800;">Quick Action Shortcuts</h3>
        </div>
        <div style="padding: 24px; display: flex; gap: 14px; flex-wrap: wrap;">
          <button class="btn btn-primary" id="btn-quick-new-user">+ Create New User</button>
          <button class="btn btn-dark" id="btn-quick-new-blog">+ Add SEO Blog</button>
          <button class="btn btn-outline" id="btn-quick-plans">Manage Plans &amp; Quotas</button>
          <button class="btn btn-outline" id="btn-quick-settings">Site SEO Settings</button>
        </div>
      </div>
    `;

    container.querySelector('#btn-quick-new-user')?.addEventListener('click', () => this.openUserModal());
    container.querySelector('#btn-quick-new-blog')?.addEventListener('click', () => this.openBlogModal());
    container.querySelector('#btn-quick-plans')?.addEventListener('click', () => this.switchTab('plans'));
    container.querySelector('#btn-quick-settings')?.addEventListener('click', () => this.switchTab('settings'));
  }

  // 2. USERS MANAGEMENT TAB
  async renderUsersTab(container) {
    try {
      const res = await api.getAdminUsers();
      this.users = res.users || [];
    } catch (e) {}

    container.innerHTML = `
      <div class="admin-top-bar">
        <div>
          <h1 class="admin-view-title">User Management</h1>
          <p style="color: #64748b; font-size: 14px;">Manage accounts, assign plans, and configure daily/monthly quota limits.</p>
        </div>
        <button class="btn btn-primary" id="btn-add-user">+ Add User</button>
      </div>

      <div class="admin-table-card">
        <div class="admin-table-header">
          <input type="text" class="form-control" id="search-users-input" placeholder="🔍 Search by name, email, or username..." style="max-width: 380px;">
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Username</th>
                <th>Role</th>
                <th>Plan</th>
                <th>Daily Limit</th>
                <th>Monthly Limit</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="users-table-body">
              ${this.renderUserRows(this.users)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.querySelector('#btn-add-user')?.addEventListener('click', () => this.openUserModal());
    this.bindUserTableActions(container);
  }

  renderUserRows(users) {
    if (users.length === 0) {
      return `<tr><td colspan="8" style="text-align:center; padding: 40px; color:#94a3b8;">No users found.</td></tr>`;
    }

    return users.map(u => `
      <tr data-user-id="${u.id}">
        <td>
          <div style="font-weight: 800; color: #0c0c0e;">${u.name}</div>
          <div style="font-size: 12px; color: #64748b;">${u.email}</div>
        </td>
        <td><code>${u.username}</code></td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-dark' : 'badge-coral'}">${u.role}</span></td>
        <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${u.plan_id}</span></td>
        <td>${u.daily_quota} / day</td>
        <td>${u.monthly_quota} / mo</td>
        <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-warning'}">${u.is_active ? 'Active' : 'Suspended'}</span></td>
        <td>
          <button class="btn btn-outline btn-sm btn-edit-user" data-id="${u.id}">Edit</button>
          <button class="btn btn-dark btn-sm btn-delete-user" data-id="${u.id}" style="background:#fee2e2; color:#ef4444; border-color:#fecaca;">Delete</button>
        </td>
      </tr>
    `).join('');
  }

  bindUserTableActions(container) {
    container.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const user = this.users.find(u => u.id == id);
        if (user) this.openUserModal(user);
      });
    });

    container.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to permanently delete this user?')) {
          try {
            await api.deleteAdminUser(id);
            this.showToast('User deleted successfully.', 'success');
            await this.renderUsersTab(container);
          } catch (e) {
            this.showToast(e.message, 'error');
          }
        }
      });
    });
  }

  openUserModal(user = null) {
    const isEdit = Boolean(user);
    const root = this.container.querySelector('#admin-modals-root');
    root.innerHTML = `
      <div class="saas-modal-backdrop open" id="user-modal-backdrop">
        <div class="saas-modal-dialog">
          <div class="saas-modal-header">
            <h3 class="saas-modal-title">${isEdit ? 'Edit User' : 'Create New User'}</h3>
            <button class="saas-modal-close" id="btn-close-user-modal">&times;</button>
          </div>

          <form id="form-user-modal">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" class="form-control" id="u-name" required value="${user?.name || ''}">
            </div>

            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" class="form-control" id="u-username" required ${isEdit ? 'readonly' : ''} value="${user?.username || ''}">
            </div>

            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-control" id="u-email" required value="${user?.email || ''}">
            </div>

            <div class="form-group">
              <label class="form-label">${isEdit ? 'Reset Password (leave blank to keep current)' : 'Password'}</label>
              <input type="password" class="form-control" id="u-pass" ${isEdit ? '' : 'required'} placeholder="••••••••">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label class="form-label">Role</label>
                <select class="form-control" id="u-role">
                  <option value="user" ${user?.role === 'user' ? 'selected' : ''}>Standard User</option>
                  <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Administrator</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Assigned Plan</label>
                <select class="form-control" id="u-plan">
                  <option value="free" ${user?.plan_id === 'free' ? 'selected' : ''}>Free Starter</option>
                  <option value="creator-pro" ${user?.plan_id === 'creator-pro' ? 'selected' : ''}>Creator Pro</option>
                  <option value="agency-elite" ${user?.plan_id === 'agency-elite' ? 'selected' : ''}>Agency Elite</option>
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label class="form-label">Daily Caption Quota</label>
                <input type="number" class="form-control" id="u-daily" required value="${user?.daily_quota ?? 5}">
              </div>
              <div class="form-group">
                <label class="form-label">Monthly Quota</label>
                <input type="number" class="form-control" id="u-monthly" required value="${user?.monthly_quota ?? 50}">
              </div>
            </div>

            ${isEdit ? `
              <div class="form-group">
                <label class="form-label">Account Status</label>
                <select class="form-control" id="u-active">
                  <option value="true" ${user?.is_active ? 'selected' : ''}>Active</option>
                  <option value="false" ${!user?.is_active ? 'selected' : ''}>Suspended</option>
                </select>
              </div>
            ` : ''}

            <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top: 16px;">
              <span>${isEdit ? 'Save Changes' : 'Create User'}</span>
            </button>
          </form>
        </div>
      </div>
    `;

    const close = () => { root.innerHTML = ''; };
    root.querySelector('#btn-close-user-modal')?.addEventListener('click', close);

    root.querySelector('#form-user-modal')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: root.querySelector('#u-name').value.trim(),
        username: root.querySelector('#u-username').value.trim(),
        email: root.querySelector('#u-email').value.trim(),
        password: root.querySelector('#u-pass').value,
        role: root.querySelector('#u-role').value,
        plan_id: root.querySelector('#u-plan').value,
        daily_quota: parseInt(root.querySelector('#u-daily').value),
        monthly_quota: parseInt(root.querySelector('#u-monthly').value),
        is_active: root.querySelector('#u-active')?.value === 'true'
      };

      try {
        if (isEdit) {
          await api.updateAdminUser(user.id, payload);
          this.showToast('User updated successfully.', 'success');
        } else {
          await api.createAdminUser(payload);
          this.showToast('User created successfully.', 'success');
        }
        close();
        this.switchTab('users');
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });
  }

  // 3. PLANS MANAGEMENT TAB (Full CRUD with +/- dynamic keypoints)
  async renderPlansTab(container) {
    try {
      const res = await api.getAdminPlans();
      this.plans = res.plans || [];
    } catch (e) {}

    container.innerHTML = `
      <div class="admin-top-bar">
        <div>
          <h1 class="admin-view-title">Subscription Plans &amp; Feature Limits</h1>
          <p style="color: #64748b; font-size: 14px;">Configure subscription tiers, feature keypoints (+/- items), and daily generation limits.</p>
        </div>
        <button class="btn btn-primary" id="btn-add-plan">+ Create New Plan</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-bottom: 40px;">
        ${this.plans.map(p => {
          const features = Array.isArray(p.features) ? p.features : JSON.parse(p.features || '[]');
          return `
            <div class="card pricing-card ${p.id === 'creator-pro' ? 'featured' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="font-size: 20px; font-weight: 900;">${p.name}</h3>
                ${p.is_default_free ? `<span class="badge badge-success">DEFAULT FREE</span>` : `<span class="badge badge-coral">$${p.price}/${p.billing_cycle}</span>`}
              </div>
              <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">${p.short_desc || ''}</p>

              <div style="font-size: 13px; font-weight: 700; color: #0c0c0e; margin-bottom: 12px;">
                ⚡ ${p.daily_limit} captions/day &bull; ${p.monthly_limit} captions/mo
              </div>

              <ul class="plan-features-list" style="margin-bottom: 24px;">
                ${features.map(f => `<li class="${f.included ? 'included' : 'not-included'}">${f.text}</li>`).join('')}
              </ul>

              <div style="display: flex; gap: 10px; margin-top: auto;">
                <button class="btn btn-outline btn-sm btn-block btn-edit-plan" data-id="${p.id}">Edit Plan</button>
                <button class="btn btn-dark btn-sm btn-delete-plan" data-id="${p.id}" style="background:#fee2e2; color:#ef4444; border-color:#fecaca;">Delete</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.querySelector('#btn-add-plan')?.addEventListener('click', () => this.openPlanModal());
    container.querySelectorAll('.btn-edit-plan').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const plan = this.plans.find(p => p.id === id);
        if (plan) this.openPlanModal(plan);
      });
    });
    container.querySelectorAll('.btn-delete-plan').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this plan?')) {
          try {
            await api.deleteAdminPlan(id);
            this.showToast('Plan deleted.', 'success');
            this.switchTab('plans');
          } catch (e) {
            this.showToast(e.message, 'error');
          }
        }
      });
    });
  }

  openPlanModal(plan = null) {
    const isEdit = Boolean(plan);
    const root = this.container.querySelector('#admin-modals-root');
    let featuresList = plan ? (Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]')) : [
      { text: '3 Video captions per day', included: true },
      { text: 'Access to all 16 viral presets', included: true }
    ];

    const renderFeatureRows = () => {
      return featuresList.map((f, idx) => `
        <div class="feature-input-row" data-idx="${idx}">
          <input type="text" class="form-control feat-text" value="${f.text}" placeholder="Feature description">
          <select class="form-control feat-inc" style="width: 120px;">
            <option value="true" ${f.included ? 'selected' : ''}>Included</option>
            <option value="false" ${!f.included ? 'selected' : ''}>Locked</option>
          </select>
          <button type="button" class="btn-remove-feature" data-idx="${idx}" title="Remove feature">&times;</button>
        </div>
      `).join('');
    };

    root.innerHTML = `
      <div class="saas-modal-backdrop open">
        <div class="saas-modal-dialog" style="max-width: 680px;">
          <div class="saas-modal-header">
            <h3 class="saas-modal-title">${isEdit ? 'Edit Plan' : 'Create New Plan'}</h3>
            <button class="saas-modal-close" id="btn-close-plan-modal">&times;</button>
          </div>

          <form id="form-plan-modal">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label class="form-label">Plan ID</label>
                <input type="text" class="form-control" id="p-id" required ${isEdit ? 'readonly' : ''} value="${plan?.id || ''}" placeholder="e.g. pro-tier">
              </div>
              <div class="form-group">
                <label class="form-label">Plan Name</label>
                <input type="text" class="form-control" id="p-name" required value="${plan?.name || ''}">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label class="form-label">Price ($)</label>
                <input type="number" step="0.01" class="form-control" id="p-price" required value="${plan?.price ?? 19}">
              </div>
              <div class="form-group">
                <label class="form-label">Billing Cycle</label>
                <input type="text" class="form-control" id="p-cycle" value="${plan?.billing_cycle || 'month'}">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Short Description</label>
              <input type="text" class="form-control" id="p-desc" value="${plan?.short_desc || ''}">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div class="form-group">
                <label class="form-label">Daily Generation Limit</label>
                <input type="number" class="form-control" id="p-daily" required value="${plan?.daily_limit ?? 10}">
              </div>
              <div class="form-group">
                <label class="form-label">Monthly Limit</label>
                <input type="number" class="form-control" id="p-monthly" required value="${plan?.monthly_limit ?? 100}">
              </div>
            </div>

            <div class="form-group">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" id="p-default-free" ${plan?.is_default_free ? 'checked' : ''}>
                <span style="font-size: 14px; font-weight: 700;">Set as System Default Free Plan (for guests &amp; new users)</span>
              </label>
            </div>

            <!-- Dynamic Keypoints List (+ / - Items) -->
            <div class="form-group" style="margin-top: 24px;">
              <label class="form-label">Features &amp; Keypoints List (+ / -)</label>
              <div id="features-container">${renderFeatureRows()}</div>
              <button type="button" class="btn-add-feature" id="btn-add-feat-row">+ Add Feature Point</button>
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top: 20px;">
              <span>${isEdit ? 'Save Plan' : 'Create Plan'}</span>
            </button>
          </form>
        </div>
      </div>
    `;

    const close = () => { root.innerHTML = ''; };
    root.querySelector('#btn-close-plan-modal')?.addEventListener('click', close);

    const bindFeatButtons = () => {
      root.querySelectorAll('.btn-remove-feature').forEach(b => {
        b.onclick = () => {
          const idx = parseInt(b.getAttribute('data-idx'));
          featuresList.splice(idx, 1);
          root.querySelector('#features-container').innerHTML = renderFeatureRows();
          bindFeatButtons();
        };
      });
    };
    bindFeatButtons();

    root.querySelector('#btn-add-feat-row')?.addEventListener('click', () => {
      featuresList.push({ text: 'New feature capability', included: true });
      root.querySelector('#features-container').innerHTML = renderFeatureRows();
      bindFeatButtons();
    });

    root.querySelector('#form-plan-modal')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Gather updated features list
      const rows = root.querySelectorAll('.feature-input-row');
      const compiledFeatures = [];
      rows.forEach(r => {
        compiledFeatures.push({
          text: r.querySelector('.feat-text').value.trim(),
          included: r.querySelector('.feat-inc').value === 'true'
        });
      });

      const payload = {
        id: root.querySelector('#p-id').value.trim(),
        name: root.querySelector('#p-name').value.trim(),
        price: parseFloat(root.querySelector('#p-price').value),
        billing_cycle: root.querySelector('#p-cycle').value.trim(),
        short_desc: root.querySelector('#p-desc').value.trim(),
        daily_limit: parseInt(root.querySelector('#p-daily').value),
        monthly_limit: parseInt(root.querySelector('#p-monthly').value),
        is_default_free: root.querySelector('#p-default-free').checked,
        features: compiledFeatures
      };

      try {
        if (isEdit) {
          await api.updateAdminPlan(plan.id, payload);
          this.showToast('Plan updated.', 'success');
        } else {
          await api.createAdminPlan(payload);
          this.showToast('Plan created.', 'success');
        }
        close();
        this.switchTab('plans');
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });
  }

  // 4. CONTACT REQUESTS & SPLIT-VIEW LIVE EMAIL REPLY
  async renderContactsTab(container) {
    try {
      const res = await api.getAdminContacts();
      this.contacts = res.contacts || [];
    } catch (e) {}

    container.innerHTML = `
      <div class="admin-top-bar">
        <div>
          <h1 class="admin-view-title">Contact Inquiries</h1>
          <p style="color: #64748b; font-size: 14px;">Incoming support requests with instant split-view theme email reply.</p>
        </div>
      </div>

      <div class="admin-table-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Sender</th>
                <th>Subject</th>
                <th>Message Preview</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.contacts.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:40px; color:#94a3b8;">No inquiries yet.</td></tr>` : ''}
              ${this.contacts.map(c => `
                <tr>
                  <td>
                    <strong>${c.name}</strong>
                    <div style="font-size: 12px; color: #64748b;">${c.email}</div>
                  </td>
                  <td>${c.subject || 'No subject'}</td>
                  <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.message}</td>
                  <td>${new Date(c.created_at).toLocaleDateString()}</td>
                  <td><span class="badge ${c.status === 'replied' ? 'badge-success' : 'badge-warning'}">${c.status}</span></td>
                  <td>
                    <button class="btn btn-primary btn-sm btn-reply-contact" data-id="${c.id}">
                      <span>Reply via Email</span>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.querySelectorAll('.btn-reply-contact').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const contact = this.contacts.find(c => c.id == id);
        if (contact) {
          this.activeContactForReply = contact;
          this.switchTab('contact-reply');
        }
      });
    });
  }

  // Split-View Live Email Reply Screen
  renderContactReplyTab(container) {
    const contact = this.activeContactForReply;
    if (!contact) {
      this.switchTab('contacts');
      return;
    }

    let defaultHeading = `Regarding Your Inquiry: ${contact.subject || 'Support Request'}`;
    let defaultMsg = `Hi ${contact.name},\n\nThank you for reaching out to Zen Caption AI. We have reviewed your question:\n"${contact.message}"\n\nHere is what you need to know:\n\nBest regards,\nZen Caption AI Team`;
    let defaultRepliedBy = 'Chief Architect';

    container.innerHTML = `
      <div class="admin-top-bar">
        <div>
          <button class="btn btn-outline btn-sm" id="btn-back-to-contacts" style="margin-bottom: 12px;">&larr; Back to Inquiries</button>
          <h1 class="admin-view-title">Split-View Email Reply</h1>
          <p style="color: #64748b; font-size: 14px;">Compose your response on the left and see the live rendered themed email preview on the right.</p>
        </div>
      </div>

      <div class="split-view-container">
        <!-- LEFT INPUT FORM -->
        <div class="split-left-panel">
          <div class="card-peach" style="padding: 16px; border-radius: 12px; margin-bottom: 20px;">
            <strong style="font-size: 13px; color: var(--primary-coral);">Inquiry from:</strong>
            <div style="font-size: 14px; font-weight: 700; color: #0c0c0e;">${contact.name} (${contact.email})</div>
            <div style="font-size: 13px; color: #4b5563; margin-top: 6px; font-style: italic;">"${contact.message}"</div>
          </div>

          <form id="form-reply-email">
            <div class="form-group">
              <label class="form-label">Email Main Heading</label>
              <input type="text" class="form-control" id="reply-heading" required value="${defaultHeading}">
            </div>

            <div class="form-group">
              <label class="form-label">Response Message Body</label>
              <textarea class="form-control" id="reply-msg" rows="8" required style="min-height: 180px;">${defaultMsg}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Replied By (Name / Signature)</label>
              <input type="text" class="form-control" id="reply-by" required value="${defaultRepliedBy}">
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" id="btn-send-email-reply" style="margin-top: 24px;">
              <span>🚀 Send Reply Email to ${contact.email}</span>
            </button>
          </form>
        </div>

        <!-- RIGHT LIVE PREVIEW PANEL -->
        <div class="split-right-panel">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <span style="font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase;">Live Rendered Email Preview</span>
            <span class="badge badge-coral">Theme Styled</span>
          </div>
          <iframe class="email-preview-frame" id="email-preview-iframe" title="Email Live Preview"></iframe>
        </div>
      </div>
    `;

    container.querySelector('#btn-back-to-contacts')?.addEventListener('click', () => this.switchTab('contacts'));

    const headingInput = container.querySelector('#reply-heading');
    const msgInput = container.querySelector('#reply-msg');
    const byInput = container.querySelector('#reply-by');
    const iframe = container.querySelector('#email-preview-iframe');

    const updateLivePreview = () => {
      const html = generateContactReplyEmailHtml({
        recipientName: contact.name,
        heading: headingInput.value,
        message: msgInput.value,
        repliedBy: byInput.value
      });
      iframe.srcdoc = html;
    };

    headingInput.addEventListener('input', updateLivePreview);
    msgInput.addEventListener('input', updateLivePreview);
    byInput.addEventListener('input', updateLivePreview);
    updateLivePreview(); // Initial render

    container.querySelector('#form-reply-email')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sendBtn = container.querySelector('#btn-send-email-reply');
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<span>Sending Email...</span>';

      try {
        await api.replyAdminContact(contact.id, {
          heading: headingInput.value.trim(),
          message: msgInput.value.trim(),
          repliedBy: byInput.value.trim()
        });

        this.showToast(`Email delivered to ${contact.email}!`, 'success');
        this.switchTab('contacts');
      } catch (err) {
        this.showToast(err.message, 'error');
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<span>🚀 Send Reply Email to ${contact.email}</span>`;
      }
    });
  }

  // 5. PURCHASE REQUESTS TAB
  async renderPurchasesTab(container) {
    try {
      const res = await api.getAdminPurchases();
      this.purchases = res.purchases || [];
    } catch (e) {}

    container.innerHTML = `
      <div class="admin-top-bar">
        <div>
          <h1 class="admin-view-title">Purchase Orders &amp; Upgrade Requests</h1>
          <p style="color: #64748b; font-size: 14px;">Automated purchase requests submitted from pricing cards.</p>
        </div>
      </div>

      <div class="admin-table-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Plan Requested</th>
                <th>Price</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.purchases.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding:40px; color:#94a3b8;">No purchase orders yet.</td></tr>` : ''}
              ${this.purchases.map(p => `
                <tr>
                  <td>
                    <strong>${p.name}</strong>
                    <div style="font-size: 12px; color: #64748b;">${p.email}</div>
                  </td>
                  <td>${p.phone || '<span style="color:#94a3b8;">Not provided</span>'}</td>
                  <td><span class="badge badge-coral">${p.plan_name || p.plan_id}</span></td>
                  <td><strong>$${p.price}</strong></td>
                  <td>${new Date(p.created_at).toLocaleDateString()}</td>
                  <td><span class="badge ${p.status === 'approved' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
                  <td>
                    ${p.status === 'pending' ? `
                      <button class="btn btn-outline btn-sm btn-approve-purchase" data-id="${p.id}" style="color:var(--success); border-color:var(--success-border);">Approve</button>
                    ` : `<span style="font-size:12px; color:#64748b;">Completed</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.querySelectorAll('.btn-approve-purchase').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          await api.updateAdminPurchaseStatus(id, 'approved');
          this.showToast('Order approved.', 'success');
          this.switchTab('purchases');
        } catch (e) {
          this.showToast(e.message, 'error');
        }
      });
    });
  }

  // 6. BLOGS MANAGEMENT TAB (Full CRUD + SEO)
  async renderBlogsTab(container) {
    try {
      const res = await api.getAdminBlogs();
      this.blogs = res.blogs || [];
    } catch (e) {}

    container.innerHTML = `
      <div class="admin-top-bar">
        <div>
          <h1 class="admin-view-title">SEO Blog Articles (${this.blogs.length})</h1>
          <p style="color: #64748b; font-size: 14px;">Manage high-ranking SEO content. Changes automatically update the XML sitemap.</p>
        </div>
        <button class="btn btn-primary" id="btn-add-blog">+ New Article</button>
      </div>

      <div class="admin-table-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Title &amp; Slug</th>
                <th>Keywords</th>
                <th>Views</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.blogs.map(b => `
                <tr>
                  <td style="max-width: 320px;">
                    <div style="font-weight: 800; color: #0c0c0e;">${b.title}</div>
                    <code style="font-size: 12px; color: #64748b;">/blog/${b.slug}</code>
                  </td>
                  <td style="max-width: 240px; font-size: 12px; color: #64748b;">${b.keywords || 'None'}</td>
                  <td>${b.views || 0}</td>
                  <td><span class="badge badge-success">${b.status}</span></td>
                  <td>
                    <button class="btn btn-outline btn-sm btn-edit-blog" data-id="${b.id}">Edit</button>
                    <button class="btn btn-dark btn-sm btn-delete-blog" data-id="${b.id}" style="background:#fee2e2; color:#ef4444; border-color:#fecaca;">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.querySelector('#btn-add-blog')?.addEventListener('click', () => this.openBlogModal());
    container.querySelectorAll('.btn-edit-blog').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const blog = this.blogs.find(b => b.id == id);
        if (blog) this.openBlogModal(blog);
      });
    });
    container.querySelectorAll('.btn-delete-blog').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Delete this article?')) {
          try {
            await api.deleteAdminBlog(id);
            this.showToast('Article deleted.', 'success');
            this.switchTab('blogs');
          } catch (e) {
            this.showToast(e.message, 'error');
          }
        }
      });
    });
  }

  openBlogModal(blog = null) {
    const isEdit = Boolean(blog);
    const root = this.container.querySelector('#admin-modals-root');

    root.innerHTML = `
      <div class="saas-modal-backdrop open">
        <div class="saas-modal-dialog" style="max-width: 780px;">
          <div class="saas-modal-header">
            <h3 class="saas-modal-title">${isEdit ? 'Edit Blog Article' : 'New Blog Article'}</h3>
            <button class="saas-modal-close" id="btn-close-blog-modal">&times;</button>
          </div>

          <form id="form-blog-modal">
            <div class="form-group">
              <label class="form-label">Article Title</label>
              <input type="text" class="form-control" id="b-title" required value="${blog?.title || ''}">
            </div>

            <div class="form-group">
              <label class="form-label">URL Slug</label>
              <input type="text" class="form-control" id="b-slug" value="${blog?.slug || ''}" placeholder="auto-generated from title">
            </div>

            <div class="form-group">
              <label class="form-label">Short Excerpt</label>
              <input type="text" class="form-control" id="b-excerpt" value="${blog?.excerpt || ''}">
            </div>

            <div class="form-group">
              <label class="form-label">SEO Keywords (comma separated)</label>
              <input type="text" class="form-control" id="b-keywords" value="${blog?.keywords || ''}" placeholder="ai captions, reels subtitles, hormozi text">
            </div>

            <div class="form-group">
              <label class="form-label">Article Markdown Content</label>
              <textarea class="form-control" id="b-content" rows="10" required style="min-height: 220px; font-family: monospace;">${blog?.content || ''}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Featured Image URL</label>
              <input type="url" class="form-control" id="b-image" value="${blog?.featured_image || ''}">
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top: 20px;">
              <span>${isEdit ? 'Save Article' : 'Publish Article'}</span>
            </button>
          </form>
        </div>
      </div>
    `;

    const close = () => { root.innerHTML = ''; };
    root.querySelector('#btn-close-blog-modal')?.addEventListener('click', close);

    root.querySelector('#form-blog-modal')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: root.querySelector('#b-title').value.trim(),
        slug: root.querySelector('#b-slug').value.trim(),
        excerpt: root.querySelector('#b-excerpt').value.trim(),
        keywords: root.querySelector('#b-keywords').value.trim(),
        content: root.querySelector('#b-content').value,
        featured_image: root.querySelector('#b-image').value.trim(),
        status: 'published'
      };

      try {
        if (isEdit) {
          await api.updateAdminBlog(blog.id, payload);
          this.showToast('Article updated.', 'success');
        } else {
          await api.createAdminBlog(payload);
          this.showToast('Article published.', 'success');
        }
        close();
        this.switchTab('blogs');
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });
  }

  // 7. SITE SETTINGS & SEO
  async renderSettingsTab(container) {
    try {
      const res = await api.getAdminSettings();
      this.settings = res.settings || {};
    } catch (e) {}

    const s = this.settings;

    container.innerHTML = `
      <div class="admin-top-bar">
        <div>
          <h1 class="admin-view-title">Site Settings &amp; SEO Configuration</h1>
          <p style="color: #64748b; font-size: 14px;">Manage site name, OpenGraph meta tags, JSON-LD structured schema, and tracking scripts.</p>
        </div>
      </div>

      <div class="card" style="max-width: 860px; padding: 36px; margin-bottom: 40px;">
        <form id="form-site-settings">
          <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 18px; border-bottom: 1px solid #edf0f7; padding-bottom: 8px;">Branding</h3>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label class="form-label">Site Name</label>
              <input type="text" class="form-control" id="set-name" value="${s.site_name || 'Zen Caption AI'}">
            </div>
            <div class="form-group">
              <label class="form-label">Site Title (Browser Tab)</label>
              <input type="text" class="form-control" id="set-title" value="${s.site_title || ''}">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label class="form-label">Site Logo URL</label>
              <input type="text" class="form-control" id="set-logo" value="${s.site_logo || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Favicon URL</label>
              <input type="text" class="form-control" id="set-favicon" value="${s.site_favicon || ''}">
            </div>
          </div>

          <h3 style="font-size: 18px; font-weight: 800; margin: 28px 0 18px 0; border-bottom: 1px solid #edf0f7; padding-bottom: 8px;">SEO &amp; OpenGraph Social Tags</h3>

          <div class="form-group">
            <label class="form-label">Meta Description</label>
            <textarea class="form-control" id="set-desc" rows="3">${s.meta_desc || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Meta Keywords</label>
            <input type="text" class="form-control" id="set-keywords" value="${s.meta_keywords || ''}">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label class="form-label">OG Social Title</label>
              <input type="text" class="form-control" id="set-og-title" value="${s.og_title || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">OG Image URL</label>
              <input type="text" class="form-control" id="set-og-image" value="${s.og_image || ''}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">OG Social Description</label>
            <input type="text" class="form-control" id="set-og-desc" value="${s.og_desc || ''}">
          </div>

          <h3 style="font-size: 18px; font-weight: 800; margin: 28px 0 18px 0; border-bottom: 1px solid #edf0f7; padding-bottom: 8px;">JSON-LD Structured Data Schema</h3>

          <div class="form-group">
            <label class="form-label">JSON-LD Schema (application/ld+json)</label>
            <textarea class="form-control" id="set-json-ld" rows="6" style="font-family: monospace;">${s.json_ld || ''}</textarea>
          </div>

          <h3 style="font-size: 18px; font-weight: 800; margin: 28px 0 18px 0; border-bottom: 1px solid #edf0f7; padding-bottom: 8px;">Custom Code Injection</h3>

          <div class="form-group">
            <label class="form-label">Header Scripts (&lt;head&gt;)</label>
            <textarea class="form-control" id="set-head-scripts" rows="3" style="font-family: monospace;" placeholder="<!-- Google Analytics, Meta Pixel, etc -->">${s.header_scripts || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Footer Scripts (&lt;footer&gt;)</label>
            <textarea class="form-control" id="set-foot-scripts" rows="3" style="font-family: monospace;" placeholder="<!-- Custom JavaScript widgets -->">${s.footer_scripts || ''}</textarea>
          </div>

          <button type="submit" class="btn btn-primary btn-lg" style="margin-top: 16px;">
            <span>Save All Settings</span>
          </button>
        </form>
      </div>
    `;

    container.querySelector('#form-site-settings')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        site_name: container.querySelector('#set-name').value.trim(),
        site_title: container.querySelector('#set-title').value.trim(),
        site_logo: container.querySelector('#set-logo').value.trim(),
        site_favicon: container.querySelector('#set-favicon').value.trim(),
        meta_desc: container.querySelector('#set-desc').value.trim(),
        meta_keywords: container.querySelector('#set-keywords').value.trim(),
        og_title: container.querySelector('#set-og-title').value.trim(),
        og_image: container.querySelector('#set-og-image').value.trim(),
        og_desc: container.querySelector('#set-og-desc').value.trim(),
        json_ld: container.querySelector('#set-json-ld').value.trim(),
        header_scripts: container.querySelector('#set-head-scripts').value,
        footer_scripts: container.querySelector('#set-foot-scripts').value
      };

      try {
        await api.updateAdminSettings(payload);
        this.showToast('Settings saved successfully!', 'success');
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });
  }

  // ==========================================================================
  // 8. VISITOR TRACKING TAB
  // ==========================================================================
  async renderVisitorsTab(container) {
    if (!this.visitorFilter) {
      this.visitorFilter = {
        period: 'all',
        unique: false,
        userType: 'all',
        search: ''
      };
    }

    container.innerHTML = `
      <div class="admin-top-bar">
        <div>
          <h1 class="admin-view-title">🌐 Visitor Tracking &amp; Intelligence</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">
            Real-time landed user tracking, geo-located IP analytics, and unique visitor filters.
          </p>
        </div>
        <button class="btn btn-outline" id="btn-refresh-visitors">
          <span>🔄 Refresh Data</span>
        </button>
      </div>

      <!-- Quick Metrics Overview -->
      <div class="admin-stats-grid" id="visitor-stats-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-label">Total Visits</div>
          <div class="admin-stat-value" id="stat-total-visits">...</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-label">Unique Visitors (IPs)</div>
          <div class="admin-stat-value" id="stat-unique-visitors" style="color: var(--primary-coral);">...</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-label">Registered Creators</div>
          <div class="admin-stat-value" id="stat-auth-users" style="color: #3b82f6;">...</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-label">Top Location</div>
          <div class="admin-stat-value" id="stat-top-country" style="font-size: 20px; font-weight: 800; color: #10b981;">...</div>
        </div>
      </div>

      <!-- Controls & Filter Bar -->
      <div class="admin-table-card">
        <div class="admin-table-header" style="flex-wrap: wrap; gap: 14px;">
          <!-- Period Filter -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 13px; font-weight: 700; color: #475569;">Period:</label>
            <select class="form-control" id="filter-visitor-period" style="width: 160px; font-size: 13px; font-weight: 600;">
              <option value="all" ${this.visitorFilter.period === 'all' ? 'selected' : ''}>All Time</option>
              <option value="hour" ${this.visitorFilter.period === 'hour' ? 'selected' : ''}>Last Hour</option>
              <option value="today" ${this.visitorFilter.period === 'today' ? 'selected' : ''}>Today</option>
              <option value="week" ${this.visitorFilter.period === 'week' ? 'selected' : ''}>This Week (7 Days)</option>
              <option value="month" ${this.visitorFilter.period === 'month' ? 'selected' : ''}>This Month (30 Days)</option>
            </select>
          </div>

          <!-- User Type Filter -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 13px; font-weight: 700; color: #475569;">User Type:</label>
            <select class="form-control" id="filter-visitor-usertype" style="width: 170px; font-size: 13px; font-weight: 600;">
              <option value="all" ${this.visitorFilter.userType === 'all' ? 'selected' : ''}>All Visitors</option>
              <option value="auth" ${this.visitorFilter.userType === 'auth' ? 'selected' : ''}>Registered Creators</option>
              <option value="guest" ${this.visitorFilter.userType === 'guest' ? 'selected' : ''}>Guests Only</option>
            </select>
          </div>

          <!-- Unique Users Checkbox Toggle -->
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; font-weight: 700; color: #0f172a; background: #f8fafc; padding: 6px 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <input type="checkbox" id="filter-visitor-unique" ${this.visitorFilter.unique ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--primary-coral); cursor: pointer;">
            <span>Unique Users Only (Latest per IP)</span>
          </label>

          <!-- Search Input -->
          <div style="flex: 1; min-width: 200px; display: flex; justify-content: flex-end;">
            <input type="text" class="form-control" id="search-visitor-input" placeholder="🔍 Search IP, Country, User, or URL..." value="${this.visitorFilter.search || ''}" style="max-width: 320px; font-size: 13px;">
          </div>
        </div>

        <!-- Visitor Data Table -->
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Visitor Identity</th>
                <th>IP Address</th>
                <th>Country</th>
                <th>Landed URL</th>
                <th>Device</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody id="visitor-table-body">
              <tr><td colspan="6" style="text-align: center; padding: 40px; color: #94a3b8;">Loading visitor data...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Load and bind table
    await this.fetchAndRenderVisitorData(container);
    this.bindVisitorFilterEvents(container);
  }

  async fetchAndRenderVisitorData(container) {
    const tbody = container.querySelector('#visitor-table-body');
    if (!tbody) return;

    try {
      const res = await api.getAdminVisitors(this.visitorFilter);
      const visitors = res.visitors || [];
      const stats = res.stats || {};

      // Update stat cards
      const elTotal = container.querySelector('#stat-total-visits');
      const elUnique = container.querySelector('#stat-unique-visitors');
      const elAuth = container.querySelector('#stat-auth-users');
      const elTopCountry = container.querySelector('#stat-top-country');

      if (elTotal) elTotal.textContent = stats.totalVisits ?? 0;
      if (elUnique) elUnique.textContent = stats.uniqueVisitors ?? 0;
      if (elAuth) elAuth.textContent = stats.authUsers ?? 0;
      
      const topCountry = stats.topCountries && stats.topCountries[0] ? `${stats.topCountries[0].country} (${stats.topCountries[0].count})` : 'None yet';
      if (elTopCountry) elTopCountry.textContent = topCountry;

      if (visitors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: #94a3b8;">No visitor records found for the selected filter.</td></tr>`;
        return;
      }

      tbody.innerHTML = visitors.map(v => {
        const isAuth = !!v.user_id;
        const timeAgo = this.formatTimeAgo(new Date(v.created_at));
        const formattedDate = new Date(v.created_at).toLocaleString();

        return `
          <tr>
            <td>
              ${isAuth ? `
                <div style="font-weight: 800; color: #0c0c0e;">${v.user_name || 'Creator'}</div>
                <div style="font-size: 12px; color: #64748b;">${v.user_email || ''}</div>
                <span class="badge badge-coral" style="font-size: 10px; font-weight: 700; padding: 2px 6px;">Signed In Creator</span>
              ` : `
                <div style="font-weight: 700; color: #64748b;">Guest Visitor</div>
                <span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 10px;">Anonymous</span>
              `}
            </td>
            <td>
              <code style="font-weight: 700; color: #0f172a; background: #f1f5f9; padding: 3px 6px; border-radius: 4px;">${v.ip_address}</code>
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 14px;">📍</span>
                <span style="font-weight: 700; color: #1e293b;">${v.country || 'Unknown'}</span>
                <span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 10px;">${v.country_code || 'UN'}</span>
              </div>
            </td>
            <td>
              <span style="font-family: monospace; font-size: 12px; background: #f0fdf4; color: #166534; padding: 3px 8px; border-radius: 4px; border: 1px solid #bbf7d0;">
                ${v.landed_url || '/'}
              </span>
            </td>
            <td>
              <span class="badge" style="background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; font-weight: 700;">
                ${v.device_type === 'Mobile' ? '📱 Mobile' : (v.device_type === 'Tablet' ? '📟 Tablet' : '💻 Desktop')}
              </span>
            </td>
            <td>
              <div style="font-weight: 700; color: #1e293b; font-size: 13px;">${timeAgo}</div>
              <div style="font-size: 11px; color: #94a3b8;">${formattedDate}</div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: #ef4444;">Failed to load visitor logs: ${err.message}</td></tr>`;
    }
  }

  bindVisitorFilterEvents(container) {
    container.querySelector('#filter-visitor-period')?.addEventListener('change', (e) => {
      this.visitorFilter.period = e.target.value;
      this.fetchAndRenderVisitorData(container);
    });

    container.querySelector('#filter-visitor-usertype')?.addEventListener('change', (e) => {
      this.visitorFilter.userType = e.target.value;
      this.fetchAndRenderVisitorData(container);
    });

    container.querySelector('#filter-visitor-unique')?.addEventListener('change', (e) => {
      this.visitorFilter.unique = e.target.checked;
      this.fetchAndRenderVisitorData(container);
    });

    let searchTimer = null;
    container.querySelector('#search-visitor-input')?.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        this.visitorFilter.search = e.target.value.trim();
        this.fetchAndRenderVisitorData(container);
      }, 300);
    });

    container.querySelector('#btn-refresh-visitors')?.addEventListener('click', () => {
      this.fetchAndRenderVisitorData(container);
      this.showToast('Visitor data refreshed', 'info');
    });
  }

  formatTimeAgo(date) {
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}d ago`;
  }
}
