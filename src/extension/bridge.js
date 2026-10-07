(function() {
    var defaults = {};
    SETTINGS.forEach(function(setting) {
        defaults[setting.key] = setting.default;
    });

    function send() {
        chrome.storage.sync.get(defaults, function(settings) {
            document.dispatchEvent(new CustomEvent('copyright-bypass-skip:settings', {
                detail: JSON.stringify(settings),
            }));
        });
    }

    document.addEventListener('copyright-bypass-skip:ready', send);
    chrome.storage.onChanged.addListener(function(changes, area) {
        if (area === 'sync') send();
    });
    send();
})();
