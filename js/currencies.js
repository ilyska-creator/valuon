const CURRENCIES = [
    { code: 'AED', symbol: 'د.إ', ru: 'Дирхам ОАЭ', en: 'UAE Dirham' },
    { code: 'AFN', symbol: '؋', ru: 'Афгани', en: 'Afghan Afghani' },
    { code: 'ALL', symbol: 'L', ru: 'Албанский лек', en: 'Albanian Lek' },
    { code: 'AMD', symbol: '֏', ru: 'Армянский драм', en: 'Armenian Dram' },
    { code: 'ANG', symbol: 'ƒ', ru: 'Нидерландский антильский гульден', en: 'Netherlands Antillean Guilder' },
    { code: 'AOA', symbol: 'Kz', ru: 'Ангольская кванза', en: 'Angolan Kwanza' },
    { code: 'ARS', symbol: '$', ru: 'Аргентинское песо', en: 'Argentine Peso' },
    { code: 'AUD', symbol: 'A$', ru: 'Австралийский доллар', en: 'Australian Dollar' },
    { code: 'AWG', symbol: 'ƒ', ru: 'Арубанский флорин', en: 'Aruban Florin' },
    { code: 'AZN', symbol: '₼', ru: 'Азербайджанский манат', en: 'Azerbaijani Manat' },
    { code: 'BAM', symbol: 'KM', ru: 'Конвертируемая марка БиГ', en: 'Bosnia-Herzegovina Convertible Mark' },
    { code: 'BBD', symbol: '$', ru: 'Барбадосский доллар', en: 'Barbadian Dollar' },
    { code: 'BDT', symbol: '৳', ru: 'Бангладешская така', en: 'Bangladeshi Taka' },
    { code: 'BGN', symbol: 'лв', ru: 'Болгарский лев', en: 'Bulgarian Lev' },
    { code: 'BHD', symbol: '.د.ب', ru: 'Бахрейнский динар', en: 'Bahraini Dinar' },
    { code: 'BIF', symbol: 'FBu', ru: 'Бурундийский франк', en: 'Burundian Franc' },
    { code: 'BMD', symbol: '$', ru: 'Бермудский доллар', en: 'Bermudian Dollar' },
    { code: 'BND', symbol: '$', ru: 'Брунейский доллар', en: 'Brunei Dollar' },
    { code: 'BOB', symbol: 'Bs.', ru: 'Боливиано', en: 'Bolivian Boliviano' },
    { code: 'BRL', symbol: 'R$', ru: 'Бразильский реал', en: 'Brazilian Real' },
    { code: 'BSD', symbol: '$', ru: 'Багамский доллар', en: 'Bahamian Dollar' },
    { code: 'BTN', symbol: 'Nu.', ru: 'Бутанский нгултрум', en: 'Bhutanese Ngultrum' },
    { code: 'BWP', symbol: 'P', ru: 'Ботсванская пула', en: 'Botswanan Pula' },
    { code: 'BYN', symbol: 'Br', ru: 'Белорусский рубль', en: 'Belarusian Ruble' },
    { code: 'BZD', symbol: 'BZ$', ru: 'Белизский доллар', en: 'Belize Dollar' },
    { code: 'CAD', symbol: 'C$', ru: 'Канадский доллар', en: 'Canadian Dollar' },
    { code: 'CDF', symbol: 'FC', ru: 'Конголезский франк', en: 'Congolese Franc' },
    { code: 'CHF', symbol: 'CHF', ru: 'Швейцарский франк', en: 'Swiss Franc' },
    { code: 'CLP', symbol: '$', ru: 'Чилийское песо', en: 'Chilean Peso' },
    { code: 'CNY', symbol: '¥', ru: 'Китайский юань', en: 'Chinese Yuan' },
    { code: 'COP', symbol: '$', ru: 'Колумбийское песо', en: 'Colombian Peso' },
    { code: 'CRC', symbol: '₡', ru: 'Костариканский колон', en: 'Costa Rican Colón' },
    { code: 'CUP', symbol: '$', ru: 'Кубинское песо', en: 'Cuban Peso' },
    { code: 'CVE', symbol: '$', ru: 'Эскудо Кабо-Верде', en: 'Cape Verdean Escudo' },
    { code: 'CZK', symbol: 'Kč', ru: 'Чешская крона', en: 'Czech Koruna' },
    { code: 'DJF', symbol: 'Fdj', ru: 'Джибутийский франк', en: 'Djiboutian Franc' },
    { code: 'DKK', symbol: 'kr', ru: 'Датская крона', en: 'Danish Krone' },
    { code: 'DOP', symbol: 'RD$', ru: 'Доминиканское песо', en: 'Dominican Peso' },
    { code: 'DZD', symbol: 'دج', ru: 'Алжирский динар', en: 'Algerian Dinar' },
    { code: 'EGP', symbol: 'E£', ru: 'Египетский фунт', en: 'Egyptian Pound' },
    { code: 'ERN', symbol: 'Nfk', ru: 'Эритрейская накфа', en: 'Eritrean Nakfa' },
    { code: 'ETB', symbol: 'Br', ru: 'Эфиопский быр', en: 'Ethiopian Birr' },
    { code: 'EUR', symbol: '€', ru: 'Евро', en: 'Euro' },
    { code: 'FJD', symbol: 'FJ$', ru: 'Доллар Фиджи', en: 'Fijian Dollar' },
    { code: 'FKP', symbol: '£', ru: 'Фунт Фолклендских островов', en: 'Falkland Islands Pound' },
    { code: 'GBP', symbol: '£', ru: 'Фунт стерлингов', en: 'British Pound' },
    { code: 'GEL', symbol: '₾', ru: 'Грузинский лари', en: 'Georgian Lari' },
    { code: 'GHS', symbol: 'GH₵', ru: 'Ганский седи', en: 'Ghanaian Cedi' },
    { code: 'GIP', symbol: '£', ru: 'Гибралтарский фунт', en: 'Gibraltar Pound' },
    { code: 'GMD', symbol: 'D', ru: 'Гамбийский даласи', en: 'Gambian Dalasi' },
    { code: 'GNF', symbol: 'FG', ru: 'Гвинейский франк', en: 'Guinean Franc' },
    { code: 'GTQ', symbol: 'Q', ru: 'Гватемальский кетсаль', en: 'Guatemalan Quetzal' },
    { code: 'GYD', symbol: '$', ru: 'Гайанский доллар', en: 'Guyanaese Dollar' },
    { code: 'HKD', symbol: 'HK$', ru: 'Гонконгский доллар', en: 'Hong Kong Dollar' },
    { code: 'HNL', symbol: 'L', ru: 'Гондурасская лемпира', en: 'Honduran Lempira' },
    { code: 'HRK', symbol: 'kn', ru: 'Хорватская куна', en: 'Croatian Kuna' },
    { code: 'HTG', symbol: 'G', ru: 'Гаитянский гурд', en: 'Haitian Gourde' },
    { code: 'HUF', symbol: 'Ft', ru: 'Венгерский форинт', en: 'Hungarian Forint' },
    { code: 'IDR', symbol: 'Rp', ru: 'Индонезийская рупия', en: 'Indonesian Rupiah' },
    { code: 'ILS', symbol: '₪', ru: 'Новый израильский шекель', en: 'Israeli New Shekel' },
    { code: 'INR', symbol: '₹', ru: 'Индийская рупия', en: 'Indian Rupee' },
    { code: 'IQD', symbol: 'ع.د', ru: 'Иракский динар', en: 'Iraqi Dinar' },
    { code: 'IRR', symbol: '﷼', ru: 'Иранский риал', en: 'Iranian Rial' },
    { code: 'ISK', symbol: 'kr', ru: 'Исландская крона', en: 'Icelandic Króna' },
    { code: 'JMD', symbol: 'J$', ru: 'Ямайский доллар', en: 'Jamaican Dollar' },
    { code: 'JOD', symbol: 'د.ا', ru: 'Иорданский динар', en: 'Jordanian Dinar' },
    { code: 'JPY', symbol: '¥', ru: 'Японская иена', en: 'Japanese Yen' },
    { code: 'KES', symbol: 'KSh', ru: 'Кенийский шиллинг', en: 'Kenyan Shilling' },
    { code: 'KGS', symbol: 'с', ru: 'Киргизский сом', en: 'Kyrgystani Som' },
    { code: 'KHR', symbol: '៛', ru: 'Камбоджийский риель', en: 'Cambodian Riel' },
    { code: 'KMF', symbol: 'CF', ru: 'Коморский франк', en: 'Comorian Franc' },
    { code: 'KPW', symbol: '₩', ru: 'Северокорейская вона', en: 'North Korean Won' },
    { code: 'KRW', symbol: '₩', ru: 'Южнокорейская вона', en: 'South Korean Won' },
    { code: 'KWD', symbol: 'د.ك', ru: 'Кувейтский динар', en: 'Kuwaiti Dinar' },
    { code: 'KYD', symbol: '$', ru: 'Доллар Островов Кайман', en: 'Cayman Islands Dollar' },
    { code: 'KZT', symbol: '₸', ru: 'Казахстанский тенге', en: 'Kazakhstani Tenge' },
    { code: 'LAK', symbol: '₭', ru: 'Лаосский кип', en: 'Laotian Kip' },
    { code: 'LBP', symbol: 'ل.ل', ru: 'Ливанский фунт', en: 'Lebanese Pound' },
    { code: 'LKR', symbol: 'Rs', ru: 'Шри-ланкийская рупия', en: 'Sri Lankan Rupee' },
    { code: 'LRD', symbol: '$', ru: 'Либерийский доллар', en: 'Liberian Dollar' },
    { code: 'LSL', symbol: 'L', ru: 'Лесотский лоти', en: 'Lesotho Loti' },
    { code: 'LYD', symbol: 'ل.د', ru: 'Ливийский динар', en: 'Libyan Dinar' },
    { code: 'MAD', symbol: 'د.م.', ru: 'Марокканский дирхам', en: 'Moroccan Dirham' },
    { code: 'MDL', symbol: 'L', ru: 'Молдавский лей', en: 'Moldovan Leu' },
    { code: 'MGA', symbol: 'Ar', ru: 'Малагасийский ариари', en: 'Malagasy Ariary' },
    { code: 'MKD', symbol: 'ден', ru: 'Македонский денар', en: 'Macedonian Denar' },
    { code: 'MMK', symbol: 'K', ru: 'Мьянманский кьят', en: 'Myanma Kyat' },
    { code: 'MNT', symbol: '₮', ru: 'Монгольский тугрик', en: 'Mongolian Tugrik' },
    { code: 'MOP', symbol: 'MOP$', ru: 'Патака Макао', en: 'Macanese Pataca' },
    { code: 'MRU', symbol: 'UM', ru: 'Мавританская угия', en: 'Mauritanian Ouguiya' },
    { code: 'MUR', symbol: '₨', ru: 'Маврикийская рупия', en: 'Mauritian Rupee' },
    { code: 'MVR', symbol: '.ރ', ru: 'Мальдивская руфия', en: 'Maldivian Rufiyaa' },
    { code: 'MWK', symbol: 'MK', ru: 'Малавийская квача', en: 'Malawian Kwacha' },
    { code: 'MXN', symbol: '$', ru: 'Мексиканское песо', en: 'Mexican Peso' },
    { code: 'MYR', symbol: 'RM', ru: 'Малайзийский ринггит', en: 'Malaysian Ringgit' },
    { code: 'MZN', symbol: 'MT', ru: 'Мозамбикский метикал', en: 'Mozambican Metical' },
    { code: 'NAD', symbol: '$', ru: 'Намибийский доллар', en: 'Namibian Dollar' },
    { code: 'NGN', symbol: '₦', ru: 'Нигерийская найра', en: 'Nigerian Naira' },
    { code: 'NIO', symbol: 'C$', ru: 'Никарагуанская кордоба', en: 'Nicaraguan Córdoba' },
    { code: 'NOK', symbol: 'kr', ru: 'Норвежская крона', en: 'Norwegian Krone' },
    { code: 'NPR', symbol: '₨', ru: 'Непальская рупия', en: 'Nepalese Rupee' },
    { code: 'NZD', symbol: 'NZ$', ru: 'Новозеландский доллар', en: 'New Zealand Dollar' },
    { code: 'OMR', symbol: 'ر.ع.', ru: 'Оманский риал', en: 'Omani Rial' },
    { code: 'PAB', symbol: 'B/.', ru: 'Панамский бальбоа', en: 'Panamanian Balboa' },
    { code: 'PEN', symbol: 'S/.', ru: 'Перуанский соль', en: 'Peruvian Sol' },
    { code: 'PGK', symbol: 'K', ru: 'Кина Папуа — Новой Гвинеи', en: 'Papua New Guinean Kina' },
    { code: 'PHP', symbol: '₱', ru: 'Филиппинское песо', en: 'Philippine Peso' },
    { code: 'PKR', symbol: '₨', ru: 'Пакистанская рупия', en: 'Pakistani Rupee' },
    { code: 'PLN', symbol: 'zł', ru: 'Польский злотый', en: 'Polish Złoty' },
    { code: 'PYG', symbol: '₲', ru: 'Парагвайский гуарани', en: 'Paraguayan Guarani' },
    { code: 'QAR', symbol: 'ر.ق', ru: 'Катарский риал', en: 'Qatari Rial' },
    { code: 'RON', symbol: 'lei', ru: 'Румынский лей', en: 'Romanian Leu' },
    { code: 'RSD', symbol: 'дин.', ru: 'Сербский динар', en: 'Serbian Dinar' },
    { code: 'RUB', symbol: '₽', ru: 'Российский рубль', en: 'Russian Ruble' },
    { code: 'RWF', symbol: 'FRw', ru: 'Руандийский франк', en: 'Rwandan Franc' },
    { code: 'SAR', symbol: 'ر.س', ru: 'Саудовский риял', en: 'Saudi Riyal' },
    { code: 'SBD', symbol: '$', ru: 'Доллар Соломоновых Островов', en: 'Solomon Islands Dollar' },
    { code: 'SCR', symbol: '₨', ru: 'Сейшельская рупия', en: 'Seychellois Rupee' },
    { code: 'SDG', symbol: 'ج.س.', ru: 'Суданский фунт', en: 'Sudanese Pound' },
    { code: 'SEK', symbol: 'kr', ru: 'Шведская крона', en: 'Swedish Krona' },
    { code: 'SGD', symbol: 'S$', ru: 'Сингапурский доллар', en: 'Singapore Dollar' },
    { code: 'SHP', symbol: '£', ru: 'Фунт Святой Елены', en: 'Saint Helena Pound' },
    { code: 'SLE', symbol: 'Le', ru: 'Леоне Сьерра-Леоне', en: 'Sierra Leonean Leone' },
    { code: 'SOS', symbol: 'S', ru: 'Сомалийский шиллинг', en: 'Somali Shilling' },
    { code: 'SRD', symbol: '$', ru: 'Суринамский доллар', en: 'Surinamese Dollar' },
    { code: 'SSP', symbol: '£', ru: 'Южносуданский фунт', en: 'South Sudanese Pound' },
    { code: 'STN', symbol: 'Db', ru: 'Добра Сан-Томе и Принсипи', en: 'São Tomé and Príncipe Dobra' },
    { code: 'SYP', symbol: '£', ru: 'Сирийский фунт', en: 'Syrian Pound' },
    { code: 'SZL', symbol: 'L', ru: 'Свазилендский лилангени', en: 'Swazi Lilangeni' },
    { code: 'THB', symbol: '฿', ru: 'Таиландский бат', en: 'Thai Baht' },
    { code: 'TJS', symbol: 'ЅМ', ru: 'Таджикский сомони', en: 'Tajikistani Somoni' },
    { code: 'TMT', symbol: 'm', ru: 'Туркменский манат', en: 'Turkmenistani Manat' },
    { code: 'TND', symbol: 'د.ت', ru: 'Тунисский динар', en: 'Tunisian Dinar' },
    { code: 'TOP', symbol: 'T$', ru: 'Тонганская паанга', en: 'Tongan Paʻanga' },
    { code: 'TRY', symbol: '₺', ru: 'Турецкая лира', en: 'Turkish Lira' },
    { code: 'TTD', symbol: 'TT$', ru: 'Доллар Тринидада и Тобаго', en: 'Trinidad and Tobago Dollar' },
    { code: 'TWD', symbol: 'NT$', ru: 'Новый тайваньский доллар', en: 'New Taiwan Dollar' },
    { code: 'TZS', symbol: 'TSh', ru: 'Танзанийский шиллинг', en: 'Tanzanian Shilling' },
    { code: 'UAH', symbol: '₴', ru: 'Украинская гривна', en: 'Ukrainian Hryvnia' },
    { code: 'UGX', symbol: 'USh', ru: 'Угандийский шиллинг', en: 'Ugandan Shilling' },
    { code: 'USD', symbol: '$', ru: 'Доллар США', en: 'US Dollar' },
    { code: 'UYU', symbol: '$U', ru: 'Уругвайское песо', en: 'Uruguayan Peso' },
    { code: 'UZS', symbol: 'soʼm', ru: 'Узбекский сум', en: 'Uzbekistan Som' },
    { code: 'VES', symbol: 'Bs.', ru: 'Венесуэльский боливар', en: 'Venezuelan Bolívar' },
    { code: 'VND', symbol: '₫', ru: 'Вьетнамский донг', en: 'Vietnamese Dong' },
    { code: 'VUV', symbol: 'VT', ru: 'Вануатский вату', en: 'Vanuatu Vatu' },
    { code: 'WST', symbol: 'WS$', ru: 'Самоанская тала', en: 'Samoan Tala' },
    { code: 'XAF', symbol: 'FCFA', ru: 'Франк КФА BEAC', en: 'CFA Franc BEAC' },
    { code: 'XCD', symbol: '$', ru: 'Восточно-карибский доллар', en: 'East Caribbean Dollar' },
    { code: 'XOF', symbol: 'CFA', ru: 'Франк КФА BCEAO', en: 'CFA Franc BCEAO' },
    { code: 'XPF', symbol: '₣', ru: 'Франк КФП', en: 'CFP Franc' },
    { code: 'YER', symbol: '﷼', ru: 'Йеменский риал', en: 'Yemeni Rial' },
    { code: 'ZAR', symbol: 'R', ru: 'Южноафриканский рэнд', en: 'South African Rand' },
    { code: 'ZMW', symbol: 'ZK', ru: 'Замбийская квача', en: 'Zambian Kwacha' },
    { code: 'ZWL', symbol: 'Z$', ru: 'Зимбабвийский доллар', en: 'Zimbabwean Dollar' }
];

function currencySymbol(code) {
    const c = CURRENCIES.find((x) => x.code === code);
    return c ? c.symbol : (code || '');
}

function currencyName(code, lang) {
    const c = CURRENCIES.find((x) => x.code === code);
    if (!c) return code || '';
    return lang === 'ru' ? c.ru : c.en;
}

function currencyList(lang) {
    const list = CURRENCIES.slice();
    const locale = lang === 'ru' ? 'ru' : 'en';
    list.sort((a, b) => {
        const na = lang === 'ru' ? a.ru : a.en;
        const nb = lang === 'ru' ? b.ru : b.en;
        return na.localeCompare(nb, locale);
    });
    return list;
}

function resolveCurrencyLabel(key, lang) {
    try {
        const dict = window.businessTranslations && window.businessTranslations[lang];
        if (dict && dict[key]) return dict[key];
    } catch (e) {}
    return key;
}

function renderCurrencyOptions(select, lang) {
    if (!select) return;
    const current = select.value;
    const phKey = select.getAttribute('data-placeholder-i18n');
    select.innerHTML = '';
    if (phKey) {
        const ph = document.createElement('option');
        ph.value = '';
        ph.disabled = true;
        ph.selected = !current;
        ph.textContent = resolveCurrencyLabel(phKey, lang);
        select.appendChild(ph);
    }
    currencyList(lang).forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.code;
        opt.textContent = `${c.code} — ${lang === 'ru' ? c.ru : c.en}`;
        opt.setAttribute('data-aliases', [c.code, c.ru, c.en].join(';'));
        opt.setAttribute('data-icon', c.symbol);
        select.appendChild(opt);
    });
    if (current && CURRENCIES.some((c) => c.code === current)) {
        select.value = current;
    }
}

function formatCurrency(amount, code, lang) {
    const value = Number(amount);
    const safeAmount = Number.isFinite(value) ? value : 0;
    const locale = String(lang || '').toLowerCase().startsWith('en') ? 'en-US' : 'ru-RU';
    const currencyCode = code || 'EUR';
    try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(safeAmount);
    } catch (e) {
        return currencyCode + ' ' + safeAmount.toFixed(2);
    }
}

window.CURRENCIES = CURRENCIES;
window.currencySymbol = currencySymbol;
window.currencyName = currencyName;
window.currencyList = currencyList;
window.renderCurrencyOptions = renderCurrencyOptions;
window.formatCurrency = formatCurrency;
