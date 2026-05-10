/* newket EMarket Currency Manager */

const CurrencyManager = {
    currentCurrency: localStorage.getItem('newketCurrency') || 'CDF',
    defaultRate: 2500, // 1 USD = 2500 CDF
    _delegatedBound: false,

    init() {
        this.updateCurrencyUI();
        this.bindEvents();
        this.updateAllPrices();
        this.updatePriceFilter();
    },

    bindEvents() {
        if (this._delegatedBound) return;
        this._delegatedBound = true;

        document.addEventListener('click', (event) => {
            const target = event.target;

            // Legacy option buttons
            const optionBtn = target?.closest?.('.currency-option');
            const optionCurrency = optionBtn?.dataset?.currency;
            if (optionCurrency === 'USD' || optionCurrency === 'CDF') {
                event.preventDefault();
                this.setCurrency(optionCurrency);
                return;
            }

            // Admin button group
            const adminBtn = target?.closest?.('#currencyToggle button[data-currency]');
            const adminCurrency = adminBtn?.getAttribute?.('data-currency');
            if (adminCurrency === 'USD' || adminCurrency === 'CDF') {
                event.preventDefault();
                event.stopPropagation();
                this.setCurrency(adminCurrency);
                return;
            }

            // Segmented toggle labels (explicit currency)
            const segmentedLabel = target?.closest?.('.currency-switch-segmented [data-currency]');
            const segmentedCurrency = segmentedLabel?.getAttribute?.('data-currency');
            if (segmentedCurrency === 'USD' || segmentedCurrency === 'CDF') {
                event.preventDefault();
                this.setCurrency(segmentedCurrency);

                const segmentedToggle = segmentedLabel.closest('.currency-switch-segmented');
                if (segmentedToggle) {
                    segmentedToggle.style.transform = 'scale(0.95)';
                    setTimeout(() => segmentedToggle.style.transform = 'scale(1)', 100);
                }
                return;
            }

            // Segmented toggle container (toggle between currencies)
            const segmentedToggle = target?.closest?.('.currency-switch-segmented');
            if (segmentedToggle) {
                event.preventDefault();
                const newCurrency = this.currentCurrency === 'CDF' ? 'USD' : 'CDF';
                this.setCurrency(newCurrency);

                segmentedToggle.style.transform = 'scale(0.95)';
                setTimeout(() => segmentedToggle.style.transform = 'scale(1)', 100);
                return;
            }

            // Legacy one-click toggle containers
            const legacyToggle = target?.closest?.('.currency-switch, .currency-toggle');
            if (legacyToggle) {
                event.preventDefault();
                const newCurrency = this.currentCurrency === 'CDF' ? 'USD' : 'CDF';
                this.setCurrency(newCurrency);

                legacyToggle.style.transform = 'scale(0.95)';
                setTimeout(() => legacyToggle.style.transform = 'scale(1)', 100);
            }
        });
    },

    setCurrency(currency) {
        this.currentCurrency = currency;
        localStorage.setItem('newketCurrency', currency);
        this.updateCurrencyUI();
        this.updateAllPrices();
        this.updatePriceFilter();

        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('currencyChanged', { detail: { currency } }));
    },

    updateCurrencyUI() {
        // Update Toggles
        document.querySelectorAll('.currency-switch, .currency-toggle, .currency-switch-segmented, #currencyToggle').forEach(toggle => {
            toggle.setAttribute('data-active', this.currentCurrency);

            // Old label support (if any)
            const label = toggle.querySelector('.currency-switch-label');
            if (label) label.textContent = this.currentCurrency;

            // Sync active class on segmented labels
            toggle.querySelectorAll('.segmented-label').forEach(lbl => {
                if (lbl.getAttribute('data-currency') === this.currentCurrency) {
                    lbl.classList.add('active');
                } else {
                    lbl.classList.remove('active');
                }
            });

            // For the legacy slider toggle classes (if still present)
            toggle.classList.remove('usd', 'cdf');
            toggle.classList.add(this.currentCurrency.toLowerCase());

            toggle.querySelectorAll('button[data-currency]').forEach(btn => {
                const isActive = btn.getAttribute('data-currency') === this.currentCurrency;
                btn.classList.toggle('active', isActive);

                // Admin button-group styling parity (Tailwind classes embedded in markup)
                if (toggle.id === 'currencyToggle') {
                    btn.classList.toggle('bg-white', isActive);
                    btn.classList.toggle('shadow-sm', isActive);
                    btn.classList.toggle('text-black', isActive);
                    btn.classList.toggle('text-gray-400', !isActive);
                }
            });
        });

        // Update legacy options
        document.querySelectorAll('.currency-option').forEach(btn => {
            if (btn.dataset.currency === this.currentCurrency) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Sync parent data-active for sliding effects if any
        document.querySelectorAll('.currency-selector').forEach(selector => {
            selector.setAttribute('data-active', this.currentCurrency);
        });
    },

    formatPrice(amount, currency = this.currentCurrency, isBaseAmount = true, customRate = null) {
        let value = amount;

        // If isBaseAmount is true, input is CDF. If false, input is USD.
        if (isBaseAmount) {
            // If input is CDF and we want USD, convert it
            if (currency === 'USD') {
                value = this.convert(amount, true, customRate);
            }
        } else {
            // If input is USD and we want CDF, convert it
            if (currency === 'CDF') {
                value = this.convert(amount, false, customRate);
            } else {
                // Current currency is USD, we already have USD, no change needed
                value = amount;
            }
        }

        if (currency === 'CDF') {
            let formatted = new Intl.NumberFormat('fr-FR', {
                useGrouping: true,
                maximumFractionDigits: 0
            }).format(Number(value) || 0);

            // fr-FR often uses narrow no-break spaces (U+202F) for grouping; normalize to regular spaces for visibility.
            formatted = formatted.replace(/[\u202F\u00A0]/g, ' ');
            return `${formatted} FC`;
        }

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            useGrouping: true,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(Number(value) || 0);
    },

    // Convert between currencies
    // If toUSD is true, converts CDF -> USD
    // If toUSD is false, converts USD -> CDF
    // customRate: optional per-product exchange rate
    convert(amount, toUSD = true, customRate = null) {
        const config = window.newketConfig || this.getConfigFallback();
        const rate = customRate || config.exchangeRate || 2500;
        if (toUSD) return amount / rate;
        return amount * rate;
    },

    getConfigFallback() {
        return { exchangeRate: 2500 };
    },

    updateAllPrices() {
        document.querySelectorAll('[data-price-cdf]').forEach(el => {
            const price = parseFloat(el.dataset.priceCdf);
            // Important: most data-price-cdf attributes actually contain the RAW price from DB which is USD
            // We need to know if this element's source is USD or CDF.
            const isUSDSource = el.hasAttribute('data-price-usd');
            el.textContent = this.formatPrice(price, this.currentCurrency, !isUSDSource);
        });
    },

    updatePriceFilter() {
        const minInput = document.querySelector('.input-min');
        const maxInput = document.querySelector('.input-max');
        const currencyLabels = document.querySelectorAll('.price-inputs .currency-label');

        if (!minInput || !maxInput) return;

        // Update Labels
        const formattedCurrency = this.currentCurrency === 'CDF' ? 'FC' : '$';
        currencyLabels.forEach(label => label.textContent = formattedCurrency);

        // Update Values
        [minInput, maxInput].forEach(input => {
            if (input.dataset.priceCdf !== undefined && input.dataset.priceCdf !== "") {
                const basePrice = parseFloat(input.dataset.priceCdf);
                if (!isNaN(basePrice)) {
                    if (this.currentCurrency === 'CDF') {
                        input.value = basePrice;
                    } else {
                        // Convert to USD and round to 2 decimals
                        input.value = Math.round(this.convert(basePrice, true));
                    }
                }
            } else {
                input.value = ""; // Garder vide si pas de valeur définie
            }
        });
    }
};

window.CurrencyManager = CurrencyManager;
