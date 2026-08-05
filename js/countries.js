const COUNTRIES = [
    { code: 'AD', ru: 'Андорра', en: 'Andorra' },
    { code: 'AE', ru: 'Объединённые Арабские Эмираты', en: 'United Arab Emirates' },
    { code: 'AF', ru: 'Афганистан', en: 'Afghanistan' },
    { code: 'AG', ru: 'Антигуа и Барбуда', en: 'Antigua and Barbuda' },
    { code: 'AI', ru: 'Ангилья', en: 'Anguilla' },
    { code: 'AL', ru: 'Албания', en: 'Albania' },
    { code: 'AM', ru: 'Армения', en: 'Armenia' },
    { code: 'AO', ru: 'Ангола', en: 'Angola' },
    { code: 'AQ', ru: 'Антарктида', en: 'Antarctica' },
    { code: 'AR', ru: 'Аргентина', en: 'Argentina' },
    { code: 'AS', ru: 'Американское Самоа', en: 'American Samoa' },
    { code: 'AT', ru: 'Австрия', en: 'Austria' },
    { code: 'AU', ru: 'Австралия', en: 'Australia' },
    { code: 'AW', ru: 'Аруба', en: 'Aruba' },
    { code: 'AX', ru: 'Аландские острова', en: 'Åland Islands' },
    { code: 'AZ', ru: 'Азербайджан', en: 'Azerbaijan' },
    { code: 'BA', ru: 'Босния и Герцеговина', en: 'Bosnia and Herzegovina' },
    { code: 'BB', ru: 'Барбадос', en: 'Barbados' },
    { code: 'BD', ru: 'Бангладеш', en: 'Bangladesh' },
    { code: 'BE', ru: 'Бельгия', en: 'Belgium' },
    { code: 'BF', ru: 'Буркина-Фасо', en: 'Burkina Faso' },
    { code: 'BG', ru: 'Болгария', en: 'Bulgaria' },
    { code: 'BH', ru: 'Бахрейн', en: 'Bahrain' },
    { code: 'BI', ru: 'Бурунди', en: 'Burundi' },
    { code: 'BJ', ru: 'Бенин', en: 'Benin' },
    { code: 'BL', ru: 'Сен-Бартелеми', en: 'Saint Barthélemy' },
    { code: 'BM', ru: 'Бермуды', en: 'Bermuda' },
    { code: 'BN', ru: 'Бруней', en: 'Brunei Darussalam' },
    { code: 'BO', ru: 'Боливия', en: 'Bolivia' },
    { code: 'BQ', ru: 'Бонайре, Синт-Эстатиус и Саба', en: 'Bonaire, Sint Eustatius and Saba' },
    { code: 'BR', ru: 'Бразилия', en: 'Brazil' },
    { code: 'BS', ru: 'Багамы', en: 'Bahamas' },
    { code: 'BT', ru: 'Бутан', en: 'Bhutan' },
    { code: 'BV', ru: 'Остров Буве', en: 'Bouvet Island' },
    { code: 'BW', ru: 'Ботсвана', en: 'Botswana' },
    { code: 'BY', ru: 'Беларусь', en: 'Belarus' },
    { code: 'BZ', ru: 'Белиз', en: 'Belize' },
    { code: 'CA', ru: 'Канада', en: 'Canada' },
    { code: 'CC', ru: 'Кокосовые острова', en: 'Cocos (Keeling) Islands' },
    { code: 'CD', ru: 'Демократическая Республика Конго', en: 'Congo, Democratic Republic of the' },
    { code: 'CF', ru: 'Центральноафриканская Республика', en: 'Central African Republic' },
    { code: 'CG', ru: 'Конго', en: 'Congo' },
    { code: 'CH', ru: 'Швейцария', en: 'Switzerland' },
    { code: 'CI', ru: "Кот-д'Ивуар", en: "Côte d'Ivoire" },
    { code: 'CK', ru: 'Острова Кука', en: 'Cook Islands' },
    { code: 'CL', ru: 'Чили', en: 'Chile' },
    { code: 'CM', ru: 'Камерун', en: 'Cameroon' },
    { code: 'CN', ru: 'Китай', en: 'China' },
    { code: 'CO', ru: 'Колумбия', en: 'Colombia' },
    { code: 'CR', ru: 'Коста-Рика', en: 'Costa Rica' },
    { code: 'CU', ru: 'Куба', en: 'Cuba' },
    { code: 'CV', ru: 'Кабо-Верде', en: 'Cape Verde' },
    { code: 'CW', ru: 'Кюрасао', en: 'Curaçao' },
    { code: 'CX', ru: 'Остров Рождества', en: 'Christmas Island' },
    { code: 'CY', ru: 'Кипр', en: 'Cyprus' },
    { code: 'CZ', ru: 'Чехия', en: 'Czechia' },
    { code: 'DE', ru: 'Германия', en: 'Germany' },
    { code: 'DJ', ru: 'Джибути', en: 'Djibouti' },
    { code: 'DK', ru: 'Дания', en: 'Denmark' },
    { code: 'DM', ru: 'Доминика', en: 'Dominica' },
    { code: 'DO', ru: 'Доминиканская Республика', en: 'Dominican Republic' },
    { code: 'DZ', ru: 'Алжир', en: 'Algeria' },
    { code: 'EC', ru: 'Эквадор', en: 'Ecuador' },
    { code: 'EE', ru: 'Эстония', en: 'Estonia' },
    { code: 'EG', ru: 'Египет', en: 'Egypt' },
    { code: 'EH', ru: 'Западная Сахара', en: 'Western Sahara' },
    { code: 'ER', ru: 'Эритрея', en: 'Eritrea' },
    { code: 'ES', ru: 'Испания', en: 'Spain' },
    { code: 'ET', ru: 'Эфиопия', en: 'Ethiopia' },
    { code: 'FI', ru: 'Финляндия', en: 'Finland' },
    { code: 'FJ', ru: 'Фиджи', en: 'Fiji' },
    { code: 'FK', ru: 'Фолклендские острова', en: 'Falkland Islands (Malvinas)' },
    { code: 'FM', ru: 'Микронезия', en: 'Micronesia (Federated States of)' },
    { code: 'FO', ru: 'Фарерские острова', en: 'Faroe Islands' },
    { code: 'FR', ru: 'Франция', en: 'France' },
    { code: 'GA', ru: 'Габон', en: 'Gabon' },
    { code: 'GB', ru: 'Великобритания', en: 'United Kingdom' },
    { code: 'GD', ru: 'Гренада', en: 'Grenada' },
    { code: 'GE', ru: 'Грузия', en: 'Georgia' },
    { code: 'GF', ru: 'Французская Гвиана', en: 'French Guiana' },
    { code: 'GG', ru: 'Гернси', en: 'Guernsey' },
    { code: 'GH', ru: 'Гана', en: 'Ghana' },
    { code: 'GI', ru: 'Гибралтар', en: 'Gibraltar' },
    { code: 'GL', ru: 'Гренландия', en: 'Greenland' },
    { code: 'GM', ru: 'Гамбия', en: 'Gambia' },
    { code: 'GN', ru: 'Гвинея', en: 'Guinea' },
    { code: 'GP', ru: 'Гваделупа', en: 'Guadeloupe' },
    { code: 'GQ', ru: 'Экваториальная Гвинея', en: 'Equatorial Guinea' },
    { code: 'GR', ru: 'Греция', en: 'Greece' },
    { code: 'GS', ru: 'Южная Георгия и Южные Сандвичевы острова', en: 'South Georgia and the South Sandwich Islands' },
    { code: 'GT', ru: 'Гватемала', en: 'Guatemala' },
    { code: 'GU', ru: 'Гуам', en: 'Guam' },
    { code: 'GW', ru: 'Гвинея-Бисау', en: 'Guinea-Bissau' },
    { code: 'GY', ru: 'Гайана', en: 'Guyana' },
    { code: 'HK', ru: 'Гонконг', en: 'Hong Kong' },
    { code: 'HM', ru: 'Остров Херд и острова Макдональд', en: 'Heard Island and McDonald Islands' },
    { code: 'HN', ru: 'Гондурас', en: 'Honduras' },
    { code: 'HR', ru: 'Хорватия', en: 'Croatia' },
    { code: 'HT', ru: 'Гаити', en: 'Haiti' },
    { code: 'HU', ru: 'Венгрия', en: 'Hungary' },
    { code: 'ID', ru: 'Индонезия', en: 'Indonesia' },
    { code: 'IE', ru: 'Ирландия', en: 'Ireland' },
    { code: 'IL', ru: 'Израиль', en: 'Israel' },
    { code: 'IM', ru: 'Остров Мэн', en: 'Isle of Man' },
    { code: 'IN', ru: 'Индия', en: 'India' },
    { code: 'IO', ru: 'Британская территория в Индийском океане', en: 'British Indian Ocean Territory' },
    { code: 'IQ', ru: 'Ирак', en: 'Iraq' },
    { code: 'IR', ru: 'Иран', en: 'Iran (Islamic Republic of)' },
    { code: 'IS', ru: 'Исландия', en: 'Iceland' },
    { code: 'IT', ru: 'Италия', en: 'Italy' },
    { code: 'JE', ru: 'Джерси', en: 'Jersey' },
    { code: 'JM', ru: 'Ямайка', en: 'Jamaica' },
    { code: 'JO', ru: 'Иордания', en: 'Jordan' },
    { code: 'JP', ru: 'Япония', en: 'Japan' },
    { code: 'KE', ru: 'Кения', en: 'Kenya' },
    { code: 'KG', ru: 'Киргизия', en: 'Kyrgyzstan' },
    { code: 'KH', ru: 'Камбоджа', en: 'Cambodia' },
    { code: 'KI', ru: 'Кирибати', en: 'Kiribati' },
    { code: 'KM', ru: 'Коморы', en: 'Comoros' },
    { code: 'KN', ru: 'Сент-Китс и Невис', en: 'Saint Kitts and Nevis' },
    { code: 'KP', ru: 'Северная Корея', en: "Korea (Democratic People's Republic of)" },
    { code: 'KR', ru: 'Южная Корея', en: 'Korea (Republic of)' },
    { code: 'KW', ru: 'Кувейт', en: 'Kuwait' },
    { code: 'KY', ru: 'Каймановы острова', en: 'Cayman Islands' },
    { code: 'KZ', ru: 'Казахстан', en: 'Kazakhstan' },
    { code: 'LA', ru: 'Лаос', en: "Lao People's Democratic Republic" },
    { code: 'LB', ru: 'Ливан', en: 'Lebanon' },
    { code: 'LC', ru: 'Сент-Люсия', en: 'Saint Lucia' },
    { code: 'LI', ru: 'Лихтенштейн', en: 'Liechtenstein' },
    { code: 'LK', ru: 'Шри-Ланка', en: 'Sri Lanka' },
    { code: 'LR', ru: 'Либерия', en: 'Liberia' },
    { code: 'LS', ru: 'Лесото', en: 'Lesotho' },
    { code: 'LT', ru: 'Литва', en: 'Lithuania' },
    { code: 'LU', ru: 'Люксембург', en: 'Luxembourg' },
    { code: 'LV', ru: 'Латвия', en: 'Latvia' },
    { code: 'LY', ru: 'Ливия', en: 'Libya' },
    { code: 'MA', ru: 'Марокко', en: 'Morocco' },
    { code: 'MC', ru: 'Монако', en: 'Monaco' },
    { code: 'MD', ru: 'Молдова', en: 'Moldova (Republic of)' },
    { code: 'ME', ru: 'Черногория', en: 'Montenegro' },
    { code: 'MF', ru: 'Сен-Мартен', en: 'Saint Martin (French part)' },
    { code: 'MG', ru: 'Мадагаскар', en: 'Madagascar' },
    { code: 'MH', ru: 'Маршалловы Острова', en: 'Marshall Islands' },
    { code: 'MK', ru: 'Северная Македония', en: 'North Macedonia' },
    { code: 'ML', ru: 'Мали', en: 'Mali' },
    { code: 'MM', ru: 'Мьянма', en: 'Myanmar' },
    { code: 'MN', ru: 'Монголия', en: 'Mongolia' },
    { code: 'MO', ru: 'Макао', en: 'Macao' },
    { code: 'MP', ru: 'Северные Марианские острова', en: 'Northern Mariana Islands' },
    { code: 'MQ', ru: 'Мартиника', en: 'Martinique' },
    { code: 'MR', ru: 'Мавритания', en: 'Mauritania' },
    { code: 'MS', ru: 'Монтсеррат', en: 'Montserrat' },
    { code: 'MT', ru: 'Мальта', en: 'Malta' },
    { code: 'MU', ru: 'Маврикий', en: 'Mauritius' },
    { code: 'MV', ru: 'Мальдивы', en: 'Maldives' },
    { code: 'MW', ru: 'Малави', en: 'Malawi' },
    { code: 'MX', ru: 'Мексика', en: 'Mexico' },
    { code: 'MY', ru: 'Малайзия', en: 'Malaysia' },
    { code: 'MZ', ru: 'Мозамбик', en: 'Mozambique' },
    { code: 'NA', ru: 'Намибия', en: 'Namibia' },
    { code: 'NC', ru: 'Новая Каледония', en: 'New Caledonia' },
    { code: 'NE', ru: 'Нигер', en: 'Niger' },
    { code: 'NF', ru: 'Остров Норфолк', en: 'Norfolk Island' },
    { code: 'NG', ru: 'Нигерия', en: 'Nigeria' },
    { code: 'NI', ru: 'Никарагуа', en: 'Nicaragua' },
    { code: 'NL', ru: 'Нидерланды', en: 'Netherlands' },
    { code: 'NO', ru: 'Норвегия', en: 'Norway' },
    { code: 'NP', ru: 'Непал', en: 'Nepal' },
    { code: 'NR', ru: 'Науру', en: 'Nauru' },
    { code: 'NU', ru: 'Ниуэ', en: 'Niue' },
    { code: 'NZ', ru: 'Новая Зеландия', en: 'New Zealand' },
    { code: 'OM', ru: 'Оман', en: 'Oman' },
    { code: 'PA', ru: 'Панама', en: 'Panama' },
    { code: 'PE', ru: 'Перу', en: 'Peru' },
    { code: 'PF', ru: 'Французская Полинезия', en: 'French Polynesia' },
    { code: 'PG', ru: 'Папуа — Новая Гвинея', en: 'Papua New Guinea' },
    { code: 'PH', ru: 'Филиппины', en: 'Philippines' },
    { code: 'PK', ru: 'Пакистан', en: 'Pakistan' },
    { code: 'PL', ru: 'Польша', en: 'Poland' },
    { code: 'PM', ru: 'Сен-Пьер и Микелон', en: 'Saint Pierre and Miquelon' },
    { code: 'PN', ru: 'Острова Питкэрн', en: 'Pitcairn' },
    { code: 'PR', ru: 'Пуэрто-Рико', en: 'Puerto Rico' },
    { code: 'PS', ru: 'Палестина', en: 'Palestine, State of' },
    { code: 'PT', ru: 'Португалия', en: 'Portugal' },
    { code: 'PW', ru: 'Палау', en: 'Palau' },
    { code: 'PY', ru: 'Парагвай', en: 'Paraguay' },
    { code: 'QA', ru: 'Катар', en: 'Qatar' },
    { code: 'RE', ru: 'Реюньон', en: 'Réunion' },
    { code: 'RO', ru: 'Румыния', en: 'Romania' },
    { code: 'RS', ru: 'Сербия', en: 'Serbia' },
    { code: 'RU', ru: 'Россия', en: 'Russia' },
    { code: 'RW', ru: 'Руанда', en: 'Rwanda' },
    { code: 'SA', ru: 'Саудовская Аравия', en: 'Saudi Arabia' },
    { code: 'SB', ru: 'Соломоновы Острова', en: 'Solomon Islands' },
    { code: 'SC', ru: 'Сейшелы', en: 'Seychelles' },
    { code: 'SD', ru: 'Судан', en: 'Sudan' },
    { code: 'SE', ru: 'Швеция', en: 'Sweden' },
    { code: 'SG', ru: 'Сингапур', en: 'Singapore' },
    { code: 'SH', ru: 'Остров Святой Елены', en: 'Saint Helena, Ascension and Tristan da Cunha' },
    { code: 'SI', ru: 'Словения', en: 'Slovenia' },
    { code: 'SJ', ru: 'Шпицберген и Ян-Майен', en: 'Svalbard and Jan Mayen' },
    { code: 'SK', ru: 'Словакия', en: 'Slovakia' },
    { code: 'SL', ru: 'Сьерра-Леоне', en: 'Sierra Leone' },
    { code: 'SM', ru: 'Сан-Марино', en: 'San Marino' },
    { code: 'SN', ru: 'Сенегал', en: 'Senegal' },
    { code: 'SO', ru: 'Сомали', en: 'Somalia' },
    { code: 'SR', ru: 'Суринам', en: 'Suriname' },
    { code: 'SS', ru: 'Южный Судан', en: 'South Sudan' },
    { code: 'ST', ru: 'Сан-Томе и Принсипи', en: 'Sao Tome and Principe' },
    { code: 'SV', ru: 'Сальвадор', en: 'El Salvador' },
    { code: 'SX', ru: 'Синт-Мартен', en: 'Sint Maarten (Dutch part)' },
    { code: 'SY', ru: 'Сирия', en: 'Syrian Arab Republic' },
    { code: 'SZ', ru: 'Эсватини', en: 'Eswatini' },
    { code: 'TC', ru: 'Теркс и Кайкос', en: 'Turks and Caicos Islands' },
    { code: 'TD', ru: 'Чад', en: 'Chad' },
    { code: 'TF', ru: 'Французские Южные территории', en: 'French Southern Territories' },
    { code: 'TG', ru: 'Того', en: 'Togo' },
    { code: 'TH', ru: 'Таиланд', en: 'Thailand' },
    { code: 'TJ', ru: 'Таджикистан', en: 'Tajikistan' },
    { code: 'TK', ru: 'Токелау', en: 'Tokelau' },
    { code: 'TL', ru: 'Восточный Тимор', en: 'Timor-Leste' },
    { code: 'TM', ru: 'Туркменистан', en: 'Turkmenistan' },
    { code: 'TN', ru: 'Тунис', en: 'Tunisia' },
    { code: 'TO', ru: 'Тонга', en: 'Tonga' },
    { code: 'TR', ru: 'Турция', en: 'Türkiye' },
    { code: 'TT', ru: 'Тринидад и Тобаго', en: 'Trinidad and Tobago' },
    { code: 'TV', ru: 'Тувалу', en: 'Tuvalu' },
    { code: 'TW', ru: 'Тайвань', en: 'Taiwan (Province of China)' },
    { code: 'TZ', ru: 'Танзания', en: 'Tanzania, United Republic of' },
    { code: 'UA', ru: 'Украина', en: 'Ukraine' },
    { code: 'UG', ru: 'Уганда', en: 'Uganda' },
    { code: 'UM', ru: 'Малые отдалённые острова США', en: 'United States Minor Outlying Islands' },
    { code: 'US', ru: 'США', en: 'United States of America' },
    { code: 'UY', ru: 'Уругвай', en: 'Uruguay' },
    { code: 'UZ', ru: 'Узбекистан', en: 'Uzbekistan' },
    { code: 'VA', ru: 'Ватикан', en: 'Holy See' },
    { code: 'VC', ru: 'Сент-Винсент и Гренадины', en: 'Saint Vincent and the Grenadines' },
    { code: 'VE', ru: 'Венесуэла', en: 'Venezuela (Bolivarian Republic of)' },
    { code: 'VG', ru: 'Британские Виргинские острова', en: 'Virgin Islands (British)' },
    { code: 'VI', ru: 'Виргинские острова (США)', en: 'Virgin Islands (U.S.)' },
    { code: 'VN', ru: 'Вьетнам', en: 'Viet Nam' },
    { code: 'VU', ru: 'Вануату', en: 'Vanuatu' },
    { code: 'WF', ru: 'Уоллис и Футуна', en: 'Wallis and Futuna' },
    { code: 'WS', ru: 'Самоа', en: 'Samoa' },
    { code: 'YE', ru: 'Йемен', en: 'Yemen' },
    { code: 'YT', ru: 'Майотта', en: 'Mayotte' },
    { code: 'ZA', ru: 'ЮАР', en: 'South Africa' },
    { code: 'ZM', ru: 'Замбия', en: 'Zambia' },
    { code: 'ZW', ru: 'Зимбабве', en: 'Zimbabwe' }
];

function isFlagWindows() {
    try {
        if (typeof navigator === 'undefined') return true;
        const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
        return /win/i.test(p);
    } catch (e) {
        return true;
    }
}

function countryFlag(code) {
    if (isFlagWindows() || !code || !/^[A-Z]{2}$/.test(code)) return '';
    return code.split('').map((ch) => String.fromCodePoint(127397 + ch.charCodeAt(0))).join('');
}

function countryName(code, lang) {
    const c = COUNTRIES.find((x) => x.code === code);
    if (!c) return code || '';
    return lang === 'ru' ? c.ru : c.en;
}

function countryList(lang) {
    const list = COUNTRIES.slice();
    const locale = lang === 'ru' ? 'ru' : 'en';
    list.sort((a, b) => {
        const na = lang === 'ru' ? a.ru : a.en;
        const nb = lang === 'ru' ? b.ru : b.en;
        return na.localeCompare(nb, locale);
    });
    return list;
}

function resolveCountryLabel(key, lang) {
    try {
        const dict = window.businessTranslations && window.businessTranslations[lang];
        if (dict && dict[key]) return dict[key];
    } catch (e) {}
    return key;
}

function renderCountryOptions(select, lang) {
    if (!select) return;
    const current = select.value;
    const phKey = select.getAttribute('data-placeholder-i18n');
    select.innerHTML = '';
    if (phKey) {
        const ph = document.createElement('option');
        ph.value = '';
        ph.disabled = true;
        ph.selected = !current;
        ph.textContent = resolveCountryLabel(phKey, lang);
        select.appendChild(ph);
    }
    countryList(lang).forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.code;
        opt.textContent = lang === 'ru' ? c.ru : c.en;
        opt.setAttribute('data-aliases', [c.ru, c.en].join(';'));
        const flag = countryFlag(c.code);
        if (flag) {
            opt.setAttribute('data-icon', flag);
        }
        select.appendChild(opt);
    });
    if (current && COUNTRIES.some((c) => c.code === current)) {
        select.value = current;
    }
}

window.COUNTRIES = COUNTRIES;
window.countryName = countryName;
window.countryList = countryList;
window.countryFlag = countryFlag;
window.renderCountryOptions = renderCountryOptions;
