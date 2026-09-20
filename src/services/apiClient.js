// API Client for Zen Caption AI
class ApiClient {
  constructor() {
    this.token = localStorage.getItem('zen_auth_token') || null;
    this.currentUser = null;
    this.listeners = [];
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('zen_auth_token', token);
    } else {
      localStorage.removeItem('zen_auth_token');
    }
    this.notify();
  }

  onAuthChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach(cb => cb(this.currentUser));
  }

  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`/api${path}`, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${path}:`, err);
      throw err;
    }
  }

  // Auth Methods
  async getSuggestedUsernames(name) {
    return this.request(`/auth/suggest-username?name=${encodeURIComponent(name || '')}`);
  }

  async checkUsernameAvailable(username) {
    return this.request(`/auth/check-username?username=${encodeURIComponent(username || '')}`);
  }

  async signup({ name, username, email, password }) {
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, username, email, password })
    });
  }

  async verifyOtp({ email, code, name, username, password }) {
    const res = await this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code, name, username, password })
    });
    if (res.token) {
      this.currentUser = res.user;
      this.setToken(res.token);
    }
    return res;
  }

  async signin({ identifier, password }) {
    const res = await this.request('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });
    if (res.token) {
      this.currentUser = res.user;
      this.setToken(res.token);
    }
    return res;
  }

  async checkMe() {
    if (!this.token) {
      this.currentUser = null;
      return null;
    }
    try {
      const res = await this.request('/auth/me');
      this.currentUser = res.user;
      this.notify();
      return this.currentUser;
    } catch (err) {
      this.currentUser = null;
      this.setToken(null);
      return null;
    }
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (e) {}
    this.currentUser = null;
    this.setToken(null);
  }

  // Public Methods
  async getPlans() {
    return this.request('/public/plans');
  }

  async getSettings() {
    return this.request('/public/settings');
  }

  async submitContact(data) {
    return this.request('/public/contact', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async submitPurchase(data) {
    return this.request('/public/purchase', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getBlogs() {
    return this.request('/public/blogs');
  }

  async getBlogBySlug(slug) {
    return this.request(`/public/blogs/${encodeURIComponent(slug)}`);
  }

  async checkQuota() {
    return this.request('/public/quota-check', { method: 'POST' });
  }

  async consumeQuota() {
    return this.request('/public/quota-consume', { method: 'POST' });
  }

  // User Dashboard Methods
  async getUserTemplates() {
    return this.request('/user/templates');
  }

  async saveUserTemplate(templateId, config) {
    return this.request(`/user/templates/${templateId}`, {
      method: 'POST',
      body: JSON.stringify({ config })
    });
  }

  async revertUserTemplate(templateId) {
    return this.request(`/user/templates/${templateId}`, {
      method: 'DELETE'
    });
  }

  // Admin Dashboard Methods
  async getAdminStats() {
    return this.request('/admin/stats');
  }

  async getAdminUsers(search) {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/admin/users${q}`);
  }

  async createAdminUser(data) {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateAdminUser(id, data) {
    return this.request(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteAdminUser(id) {
    return this.request(`/admin/users/${id}`, {
      method: 'DELETE'
    });
  }

  async getAdminPlans() {
    return this.request('/admin/plans');
  }

  async createAdminPlan(data) {
    return this.request('/admin/plans', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateAdminPlan(id, data) {
    return this.request(`/admin/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteAdminPlan(id) {
    return this.request(`/admin/plans/${id}`, {
      method: 'DELETE'
    });
  }

  async getAdminContacts() {
    return this.request('/admin/contacts');
  }

  async replyAdminContact(id, data) {
    return this.request(`/admin/contacts/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getAdminPurchases() {
    return this.request('/admin/purchases');
  }

  async updateAdminPurchaseStatus(id, status) {
    return this.request(`/admin/purchases/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async getAdminBlogs() {
    return this.request('/admin/blogs');
  }

  async createAdminBlog(data) {
    return this.request('/admin/blogs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateAdminBlog(id, data) {
    return this.request(`/admin/blogs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteAdminBlog(id) {
    return this.request(`/admin/blogs/${id}`, {
      method: 'DELETE'
    });
  }

  async getAdminSettings() {
    return this.request('/admin/settings');
  }

  async updateAdminSettings(settings) {
    return this.request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }
}

export const api = new ApiClient();
