// app.js - Centralized entry point for NewKet services
// This file aggregates all the main modules to optimize loading and maintainability (Phases 5 & 6)

import { inject } from '@vercel/analytics';
import './supabase-client.js';
import './supabase-adapter.js';
import './api-client.js';
import './sanitize.js';

import './config-manager.js';

import './auth.js';
import './profile-manager.js';
import './user-manager.js';
import './products.js';
import './orders.js';
import './favorites.js';
import './currency.js';
import './managers.js';

import './ui-helpers.js';
import './ui.js';
import './search.js';
import './components-loader.js';
import './realtime-notifications.js';

// main.js is usually the last one as it depends on initialized UI
import './main.js';

// Initialize Vercel Analytics
inject();

