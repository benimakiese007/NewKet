/* newket EMarket Currency Manager */

const CurrencyManager = {
    currentCurrency: localStorage.getItem('newketCurrency') || 'CDF',
    defaultRate: 2500, // 1 USD = 2500 CDF

    init() {
        this.updateCurrencyUI();
        this.bindEvents();
        this.updateAllPrices();
        this.updatePriceFilter();
    },

    bindEvents() {
        // Switch Bulle & Segmented Toggle Logic
        document.querySelectorAll('.currency-switch, .currency-toggle, .currency-switch-segmented').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const newCurrency = this.currentCurrency === 'CDF' ? 'USD' : 'CDF';
                this.setCurrency(newCurrency);

                // Small haptic animation
                toggle.style.transform = 'scale(0.95)';
                setTimeout(() => toggle.style.transform = 'scale(1)', 100);
            });
        });

        // Keep support for legacy .currency-option buttons
        document.querySelectorAll('.currency-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const currency = e.currentTarget.dataset.currency;
                this.setCurrency(currency);
            });
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
        document.querySelectorAll('.currency-switch, .currency-toggle, .currency-switch-segmented').forEach(toggle => {
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

            toggle.querySelectorAll('button').forEach(btn => {
                if (btn.getAttribute('data-currency') === this.currentCurrency) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
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
            return new Intl.NumberFormat('fr-CD', {
                style: 'currency',
                currency: 'CDF',
                maximumFractionDigits: 0
            }).format(value).replace('CDF', 'FC');
        } else {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(value);
        }
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
