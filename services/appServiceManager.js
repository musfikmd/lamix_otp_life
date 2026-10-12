'use strict';

const fs = require('fs');
const path = require('path');

const SERVICES_FILE = path.join(__dirname, '..', 'data', 'app_services.json');
const MAPPINGS_FILE = path.join(__dirname, '..', 'data', 'service_mappings.json');

function readJson(file, fallback = []) {
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8').trim();
      return content ? JSON.parse(content) : fallback;
    }
  } catch (e) {
    console.error('Error reading json file:', file, e.message);
  }
  return fallback;
}

function writeJson(file, data) {
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing json file:', file, e.message);
  }
}

class AppServiceManager {
  constructor(supabase) {
    this.supabase = supabase;
  }

  // 1. Get all App Services (Supabase primary + JSON sync)
  async getAppServices() {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('app_services')
          .select('*')
          .order('display_order', { ascending: true });

        if (!error && Array.isArray(data)) {
          // Keep local JSON in sync
          writeJson(SERVICES_FILE, data);
          return data;
        }
      } catch (err) {
        console.error('getAppServices Supabase error:', err.message);
      }
    }
    return readJson(SERVICES_FILE, []);
  }

  // 2. Create new App Service
  async createAppService({ id, name, icon = '📱' }) {
    const rawClean = name.replace(/[\p{Emoji}\u200d]/gu, '').trim();
    const slug = rawClean.toLowerCase().replace(/[^a-z0-9]/g, '') || 'service';
    const serviceId = id || `${slug}_${Date.now().toString().slice(-4)}`;

    const newService = {
      id: serviceId,
      name: name.trim(),
      icon: icon || '📱',
      category: 'general',
      is_popular: true,
      display_order: Math.floor(Date.now() / 1000) % 100000
    };

    // Save to Supabase
    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('app_services').upsert(newService);
        if (error) {
          console.error('Supabase app_services upsert error:', error.message);
        }
      } catch (e) {
        console.error('Supabase upsert exception:', e.message);
      }
    }

    // Save to local JSON
    const list = readJson(SERVICES_FILE, []);
    const existingIdx = list.findIndex(s => s.id === serviceId);
    if (existingIdx >= 0) {
      list[existingIdx] = newService;
    } else {
      list.push(newService);
    }
    writeJson(SERVICES_FILE, list);

    return newService;
  }

  // 3. Delete App Service
  async deleteAppService(serviceId) {
    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('app_services').delete().eq('id', serviceId);
        if (error) console.error('Supabase delete error:', error.message);
      } catch (e) {
        console.error('Supabase delete exception:', e.message);
      }
    }

    const list = readJson(SERVICES_FILE, []).filter(s => s.id !== serviceId);
    writeJson(SERVICES_FILE, list);

    // Also remove mappings for this service
    const mappings = readJson(MAPPINGS_FILE, []).filter(m => m.app_service_id !== serviceId);
    writeJson(MAPPINGS_FILE, mappings);

    return true;
  }

  // 4. Get Mappings for an App Service
  async getRangesForService(serviceId) {
    const allMappings = readJson(MAPPINGS_FILE, []);
    return allMappings.filter(m => m.app_service_id === serviceId);
  }

  // 5. Link Range to App Service
  async linkRangeToService({
    serviceId,
    rangeId,
    rangeName,
    displayName,
    rateBdt = 1.50,
    prefix = '213',
    country = 'Algeria'
  }) {
    const allMappings = readJson(MAPPINGS_FILE, []);
    
    // Check if mapping already exists for this service and range
    const cleanPrefix = String(prefix).replace('+', '');
    const existingIdx = allMappings.findIndex(
      m => m.app_service_id === serviceId && (m.range_id === rangeId || m.prefix === cleanPrefix)
    );

    const mappingData = {
      id: existingIdx >= 0 ? allMappings[existingIdx].id : `map_${Date.now().toString().slice(-6)}`,
      app_service_id: serviceId,
      range_id: rangeId,
      range_name: rangeName,
      display_name: displayName || country || rangeName,
      country: displayName || country || 'Global',
      rate_bdt: parseFloat(rateBdt) || 1.50,
      prefix: cleanPrefix
    };

    if (existingIdx >= 0) {
      allMappings[existingIdx] = mappingData;
    } else {
      allMappings.push(mappingData);
    }

    writeJson(MAPPINGS_FILE, allMappings);

    // Update pool numbers payout in Supabase if exists
    if (this.supabase && rangeId) {
      try {
        await this.supabase
          .from('number_pool')
          .update({ payout_bdt: mappingData.rate_bdt })
          .eq('range_id', rangeId);
      } catch (e) {}
    }

    return mappingData;
  }

  // 6. Unlink Range from App Service
  async unlinkRangeFromService(serviceIdOrMappingId, mappingId = null) {
    const targetId = mappingId || serviceIdOrMappingId;
    const allMappings = readJson(MAPPINGS_FILE, []);
    const updated = allMappings.filter(
      m => m.id !== targetId && m.range_id !== targetId
    );
    writeJson(MAPPINGS_FILE, updated);
    return true;
  }

  // 7. Get Distinct Available Ranges from Pool (with real stock counts)
  async getAvailableRangesFromPool() {
    if (!this.supabase) return [];

    try {
      const { data: poolNumbers } = await this.supabase
        .from('number_pool')
        .select('range_id, range_name, prefix, country, payout_bdt, is_assigned');

      if (!poolNumbers) return [];

      const grouped = {};
      for (const item of poolNumbers) {
        const key = item.range_id || item.range_name || item.prefix;
        if (!grouped[key]) {
          grouped[key] = {
            range_id: item.range_id,
            range_name: item.range_name || `Range +${item.prefix}`,
            prefix: item.prefix,
            country: item.country || 'Global',
            default_rate: Number(item.payout_bdt) || 1.50,
            total_stock: 0,
            available_stock: 0
          };
        }
        grouped[key].total_stock++;
        if (!item.is_assigned) {
          grouped[key].available_stock++;
        }
      }

      return Object.values(grouped);
    } catch (e) {
      console.error('getAvailableRangesFromPool error:', e.message);
      return [];
    }
  }
}

module.exports = AppServiceManager;
