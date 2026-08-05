window.DEVICE_ICONS = {
    laptop: 'fa-laptop',
    phone: 'fa-mobile-screen-button',
    tablet: 'fa-tablet-screen-button',
    watch: 'fa-stopwatch',
    headphones: 'fa-headphones-simple',
    camera: 'fa-camera',
    console: 'fa-gamepad',
    appliance: 'fa-blender',
    other: 'fa-box-open'
};

function deviceIconMarkup(type) {
    const icon = window.DEVICE_ICONS[type] || window.DEVICE_ICONS.other;
    return '<i class="fa-solid ' + icon + '"></i>';
}
window.deviceIconMarkup = deviceIconMarkup;
