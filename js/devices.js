const DEVICE_TYPES = [
    { value: 'laptop', icon: 'fa-laptop', emoji: '💻', ru: 'Ноутбук', en: 'Laptop' },
    { value: 'phone', icon: 'fa-mobile-screen-button', emoji: '📱', ru: 'Смартфон', en: 'Phone' },
    { value: 'tablet', icon: 'fa-tablet-screen-button', emoji: '📟', ru: 'Планшет', en: 'Tablet' },
    { value: 'watch', icon: 'fa-stopwatch', emoji: '⌚', ru: 'Часы', en: 'Watch' },
    { value: 'headphones', icon: 'fa-headphones-simple', emoji: '🎧', ru: 'Наушники', en: 'Headphones' },
    { value: 'camera', icon: 'fa-camera', emoji: '📷', ru: 'Камера', en: 'Camera' },
    { value: 'console', icon: 'fa-gamepad', emoji: '🎮', ru: 'Консоль', en: 'Console' },
    { value: 'tv', icon: 'fa-tv', emoji: '📺', ru: 'Телевизор', en: 'TV' },
    { value: 'monitor', icon: 'fa-display', emoji: '🖥️', ru: 'Монитор', en: 'Monitor' },
    { value: 'speaker', icon: 'fa-volume-high', emoji: '🔊', ru: 'Колонка', en: 'Speaker' },
    { value: 'printer', icon: 'fa-print', emoji: '🖨️', ru: 'Принтер', en: 'Printer' },
    { value: 'appliance', icon: 'fa-blender', emoji: '🏠', ru: 'Бытовая техника', en: 'Appliance' },
    { value: 'furniture', icon: 'fa-couch', emoji: '🛋️', ru: 'Мебель', en: 'Furniture' },
    { value: 'clothing', icon: 'fa-shirt', emoji: '👕', ru: 'Одежда', en: 'Clothing' },
    { value: 'shoes', icon: 'fa-shoe-prints', emoji: '👟', ru: 'Обувь', en: 'Shoes' },
    { value: 'bag', icon: 'fa-bag-shopping', emoji: '🎒', ru: 'Сумка', en: 'Bag' },
    { value: 'jewelry', icon: 'fa-gem', emoji: '💍', ru: 'Украшения', en: 'Jewelry' },
    { value: 'bicycle', icon: 'fa-bicycle', emoji: '🚲', ru: 'Велосипед', en: 'Bicycle' },
    { value: 'car', icon: 'fa-car', emoji: '🚗', ru: 'Автомобиль', en: 'Car' },
    { value: 'sport', icon: 'fa-dumbbell', emoji: '🏋️', ru: 'Спортинвентарь', en: 'Sports gear' },
    { value: 'instrument', icon: 'fa-music', emoji: '🎸', ru: 'Муз. инструмент', en: 'Instrument' },
    { value: 'tool', icon: 'fa-screwdriver-wrench', emoji: '🔧', ru: 'Инструменты', en: 'Tools' },
    { value: 'toy', icon: 'fa-puzzle-piece', emoji: '🧸', ru: 'Игрушка', en: 'Toy' },
    { value: 'other', icon: 'fa-box-open', emoji: '📦', ru: 'Другое', en: 'Other' }
];

window.DEVICE_ICONS = DEVICE_TYPES.reduce((map, t) => {
    map[t.value] = t.icon;
    return map;
}, {});

function deviceTypeList(lang) {
    const key = lang === 'en' ? 'en' : 'ru';
    const locale = key === 'en' ? 'en' : 'ru';
    const real = DEVICE_TYPES.filter((t) => t.value !== 'other');
    real.sort((a, b) => a[key].localeCompare(b[key], locale));
    const other = DEVICE_TYPES.find((t) => t.value === 'other');
    return [...real, other].map((t) => ({ value: t.value, label: `${t.emoji} ${t[key]}` }));
}

function renderDeviceTypeOptions(select, lang) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = '';
    deviceTypeList(lang).forEach(({ value, label }) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        select.appendChild(opt);
    });
    if (current && DEVICE_TYPES.some((t) => t.value === current)) {
        select.value = current;
    }
}

function deviceIconMarkup(type) {
    const icon = window.DEVICE_ICONS[type] || window.DEVICE_ICONS.other;
    return '<i class="fa-solid ' + icon + '"></i>';
}

window.deviceTypeList = deviceTypeList;
window.renderDeviceTypeOptions = renderDeviceTypeOptions;
window.deviceIconMarkup = deviceIconMarkup;
